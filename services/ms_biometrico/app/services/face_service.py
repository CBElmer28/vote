"""
Face Verification Service
--------------------------
Supports three modes controlled by the BIOMETRIC_MODE env var:

  mock  — Always returns a successful verification (for local development).
  azure — Calls Microsoft Azure Face API.
  aws   — Calls AWS Rekognition.
"""

import requests
import logging
from flask import current_app

# Configuración de logging básico
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────────────────────────────────────
#  Mock
# ─────────────────────────────────────────────────────────────────────────────
class MockFaceService:
    def register_face(self, face_bytes: bytes) -> str:
        logger.info("Modo MOCK — Simulando registro de rostro")
        return "mock-face-id-12345"

    def verify(self, face_bytes: bytes, reference_id: str) -> dict:
        logger.info("Utilizando MockFaceService (Modo desarrollo)")
        return {
            "verified":   True,
            "confidence": 0.99,
            "message":    "Modo MOCK — Rostro aceptado automáticamente",
        }


# ─────────────────────────────────────────────────────────────────────────────
#  Azure Face API
# ─────────────────────────────────────────────────────────────────────────────
class AzureFaceService:
    def verify(self, face_bytes: bytes, reference_url: str) -> dict:
        api_key   = current_app.config.get("AZURE_FACE_API_KEY")
        endpoint  = current_app.config.get("AZURE_FACE_ENDPOINT", "").rstrip("/")
        threshold = current_app.config.get("FACE_CONFIDENCE_THRESHOLD", 0.6)

        if not api_key or not endpoint:
            raise ValueError("Azure Face API Key o Endpoint no configurados.")

        octet_headers = {"Ocp-Apim-Subscription-Key": api_key, "Content-Type": "application/octet-stream"}
        json_headers  = {"Ocp-Apim-Subscription-Key": api_key, "Content-Type": "application/json"}

        detect_url = f"{endpoint}/face/v1.0/detect?returnFaceId=true&recognitionModel=recognition_04&detectionModel=detection_03"

        try:
            # Paso 1 — Detectar en vivo
            r1 = requests.post(detect_url, headers=octet_headers, data=face_bytes, timeout=15)
            r1.raise_for_status()
            faces_live = r1.json()
            if not faces_live:
                return {"verified": False, "confidence": 0.0, "message": "No se detectó rostro en la foto enviada"}

            # Paso 2 — Detectar referencia
            r2 = requests.post(detect_url, headers=json_headers, json={"url": reference_url}, timeout=15)
            r2.raise_for_status()
            faces_ref = r2.json()
            if not faces_ref:
                return {"verified": False, "confidence": 0.0, "message": "No se detectó rostro en la referencia"}

            # Paso 3 — Verificar
            verify_url = f"{endpoint}/face/v1.0/verify"
            r3 = requests.post(verify_url, headers=json_headers, json={
                "faceId1": faces_live[0]["faceId"],
                "faceId2": faces_ref[0]["faceId"],
            }, timeout=15)
            r3.raise_for_status()
            result = r3.json()

            confidence = round(result.get("confidence", 0.0), 4)
            verified   = result.get("isIdentical", False) and confidence >= threshold
            return {
                "verified":   verified,
                "confidence": confidence,
                "message":    "Verificado con Azure" if verified else "No coincide (Azure)",
            }
        except Exception as e:
            logger.error(f"Error Azure: {str(e)}")
            raise e


# ─────────────────────────────────────────────────────────────────────────────
#  AWS Rekognition
# ─────────────────────────────────────────────────────────────────────────────
class AwsRekognitionService:
    def __init__(self):
        import boto3
        self.client = boto3.client(
            'rekognition',
            aws_access_key_id=current_app.config["AWS_ACCESS_KEY_ID"],
            aws_secret_access_key=current_app.config["AWS_SECRET_ACCESS_KEY"],
            region_name=current_app.config["AWS_REGION"]
        )
        # Nombre de la colección que creaste en AWS
        self.collection_id = 'votos_collection'

    def register_face(self, face_bytes: bytes) -> str:
        """
        Envía la imagen a AWS para generar el vector y guardarlo en la colección.
        Retorna el FaceId generado.
        """
        logger.info("AWS: Indexando nuevo rostro en la colección...")
        try:
            response = self.client.index_faces(
                CollectionId=self.collection_id,
                Image={'Bytes': face_bytes},
                MaxFaces=1,
                QualityFilter="AUTO"
            )
            
            if response.get('FaceRecords'):
                face_id = response['FaceRecords'][0]['Face']['FaceId']
                logger.info(f"Rostro registrado exitosamente con ID: {face_id}")
                return face_id
                
            logger.warning("AWS: No se detectó ningún rostro válido en la imagen.")
            return None
            
        except Exception as e:
            logger.error(f"Error registrando rostro en AWS: {str(e)}")
            raise e

    def verify(self, face_bytes: bytes, reference_face_id: str) -> dict:
        """
        Busca el rostro de la cámara en la colección y verifica si el 
        FaceId resultante coincide con el del usuario en la base de datos.
        """
        logger.info(f"AWS: Verificando rostro contra el FaceId guardado: {reference_face_id}")
        try:
            threshold = current_app.config.get("FACE_CONFIDENCE_THRESHOLD", 0.90) * 100
            
            # Buscamos la imagen en vivo dentro de la colección
            response = self.client.search_faces_by_image(
                CollectionId=self.collection_id,
                Image={'Bytes': face_bytes},
                MaxFaces=5, # Trae los 5 más parecidos
                FaceMatchThreshold=threshold
            )

            matches = response.get('FaceMatches', [])
            
            # Recorremos los matches para ver si el ID de la base de datos está ahí
            for match in matches:
                matched_id = match['Face']['FaceId']
                
                if matched_id == reference_face_id:
                    similarity = match['Similarity'] / 100
                    return {
                        "verified":   True,
                        "confidence": round(similarity, 4),
                        "message":    "Verificado con AWS Rekognition (Colección)",
                    }
                    
            # Si termina el bucle y no hubo match con el ID esperado
            return {
                "verified": False, 
                "confidence": 0.0, 
                "message": "El rostro no corresponde al usuario registrado (AWS)"
            }

        except self.client.exceptions.InvalidParameterException:
            return {"verified": False, "message": "AWS no detectó un rostro claro en la captura de la cámara."}
        except Exception as e:
            logger.error(f"Error en verificación AWS: {str(e)}")
            return {"verified": False, "message": f"Error interno AWS: {str(e)}"}

# ─────────────────────────────────────────────────────────────────────────────
#  Factory
# ─────────────────────────────────────────────────────────────────────────────
def get_face_service():
    mode = current_app.config.get("BIOMETRIC_MODE", "mock").lower()
    if mode == "aws":
        return AwsRekognitionService()
    if mode == "azure":
        return AzureFaceService()
    return MockFaceService()
