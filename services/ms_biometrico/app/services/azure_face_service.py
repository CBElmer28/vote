import requests
from flask import current_app


class AzureFaceService:
    """
    Servicio que se conecta a Microsoft Azure Face API.

    Documentación Azure:
    https://learn.microsoft.com/en-us/azure/ai-services/computer-vision/overview-identity
    """

    def verificar_identidad(self, foto_bytes: bytes, foto_referencia_url: str) -> dict:
        """
        Compara una foto recibida contra la foto de referencia del usuario.

        Parámetros:
            foto_bytes       — bytes de la foto a verificar (la foto tomada al votar)
            foto_referencia_url — URL pública de la foto registrada del usuario

        Retorna:
            dict con: { "es_la_persona": bool, "confianza": float, "mensaje": str }
        """
        api_key = current_app.config["AZURE_FACE_API_KEY"]
        endpoint = current_app.config["AZURE_FACE_ENDPOINT"].rstrip("/")
        threshold = current_app.config["CONFIDENCE_THRESHOLD"]

        headers = {
            "Ocp-Apim-Subscription-Key": api_key,
            "Content-Type": "application/octet-stream",
        }

        # Paso 1: Detectar rostro en la foto recibida
        detect_url = f"{endpoint}/face/v1.0/detect?returnFaceId=true"
        response_detect = requests.post(detect_url, headers=headers, data=foto_bytes, timeout=10)
        response_detect.raise_for_status()

        caras_detectadas = response_detect.json()
        if not caras_detectadas:
            return {
                "es_la_persona": False,
                "confianza": 0.0,
                "mensaje": "No se detectó ningún rostro en la imagen enviada",
            }

        face_id_enviado = caras_detectadas[0]["faceId"]

        # Paso 2: Detectar rostro en la foto de referencia
        headers_url = {
            "Ocp-Apim-Subscription-Key": api_key,
            "Content-Type": "application/json",
        }
        response_ref = requests.post(
            detect_url,
            headers=headers_url,
            json={"url": foto_referencia_url},
            timeout=10,
        )
        response_ref.raise_for_status()

        caras_referencia = response_ref.json()
        if not caras_referencia:
            return {
                "es_la_persona": False,
                "confianza": 0.0,
                "mensaje": "No se detectó rostro en la foto de referencia del usuario",
            }

        face_id_referencia = caras_referencia[0]["faceId"]

        # Paso 3: Verificar si son la misma persona
        verify_url = f"{endpoint}/face/v1.0/verify"
        response_verify = requests.post(
            verify_url,
            headers=headers_url,
            json={"faceId1": face_id_enviado, "faceId2": face_id_referencia},
            timeout=10,
        )
        response_verify.raise_for_status()
        resultado = response_verify.json()

        confianza = resultado.get("confidence", 0.0)
        es_identica = resultado.get("isIdentical", False) and confianza >= threshold

        return {
            "es_la_persona": es_identica,
            "confianza": round(confianza, 4),
            "mensaje": "Sí, es él" if es_identica else "No, no es él",
        }
