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
    def verify(self, face_bytes: bytes, reference_url: str) -> dict:
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

    def verify(self, face_bytes: bytes, reference_url: str) -> dict:
        logger.info(f"AWS: Comparando contra {reference_url}")
        try:
            # 1. Descargar referencia
            response_ref = requests.get(reference_url, timeout=10)
            response_ref.raise_for_status()
            reference_bytes = response_ref.content

            # 2. AWS Compare
            threshold = current_app.config.get("FACE_CONFIDENCE_THRESHOLD", 0.6) * 100
            response = self.client.compare_faces(
                SourceImage={'Bytes': reference_bytes},
                TargetImage={'Bytes': face_bytes},
                SimilarityThreshold=threshold
            )

            matches = response.get('FaceMatches', [])
            if matches:
                similarity = matches[0]['Similarity'] / 100
                return {
                    "verified":   True,
                    "confidence": round(similarity, 4),
                    "message":    "Verificado con AWS Rekognition",
                }
            return {"verified": False, "confidence": 0.0, "message": "No coincide (AWS)"}
        except Exception as e:
            logger.error(f"Error AWS: {str(e)}")
            return {"verified": False, "message": f"Error AWS: {str(e)}"}


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
