"""
Face Verification Service
--------------------------
Supports two modes controlled by the BIOMETRIC_MODE env var:

  mock  — Always returns a successful verification (for local development).
          No Azure credentials required.

  azure — Calls Microsoft Azure Face API for real biometric comparison.
          Requires AZURE_FACE_API_KEY and AZURE_FACE_ENDPOINT to be set.
"""

import requests
from flask import current_app


# ─────────────────────────────────────────────────────────────────────────────
#  Mock
# ─────────────────────────────────────────────────────────────────────────────
class MockFaceService:
    def verify(self, face_bytes: bytes, reference_url: str) -> dict:
        return {
            "verified":   True,
            "confidence": 0.99,
            "message":    "mock — face accepted",
        }


# ─────────────────────────────────────────────────────────────────────────────
#  Azure Face API
# ─────────────────────────────────────────────────────────────────────────────
class AzureFaceService:
    """
    Calls the Azure Face API /detect + /verify endpoints.
    Docs: https://learn.microsoft.com/azure/ai-services/computer-vision/overview-identity
    """

    def verify(self, face_bytes: bytes, reference_url: str) -> dict:
        api_key   = current_app.config["AZURE_FACE_API_KEY"]
        endpoint  = current_app.config["AZURE_FACE_ENDPOINT"].rstrip("/")
        threshold = current_app.config["FACE_CONFIDENCE_THRESHOLD"]

        octet_headers = {"Ocp-Apim-Subscription-Key": api_key,
                         "Content-Type": "application/octet-stream"}
        json_headers  = {"Ocp-Apim-Subscription-Key": api_key,
                         "Content-Type": "application/json"}

        detect_url = f"{endpoint}/face/v1.0/detect?returnFaceId=true"

        # Step 1 — detect face in the incoming photo
        r1 = requests.post(detect_url, headers=octet_headers, data=face_bytes, timeout=10)
        r1.raise_for_status()
        faces_live = r1.json()
        if not faces_live:
            return {"verified": False, "confidence": 0.0,
                    "message": "No face detected in the submitted photo"}

        # Step 2 — detect face in the reference photo
        r2 = requests.post(detect_url, headers=json_headers,
                           json={"url": reference_url}, timeout=10)
        r2.raise_for_status()
        faces_ref = r2.json()
        if not faces_ref:
            return {"verified": False, "confidence": 0.0,
                    "message": "No face detected in the reference photo"}

        # Step 3 — compare
        verify_url = f"{endpoint}/face/v1.0/verify"
        r3 = requests.post(verify_url, headers=json_headers, json={
            "faceId1": faces_live[0]["faceId"],
            "faceId2": faces_ref[0]["faceId"],
        }, timeout=10)
        r3.raise_for_status()
        result = r3.json()

        confidence = round(result.get("confidence", 0.0), 4)
        verified   = result.get("isIdentical", False) and confidence >= threshold
        return {
            "verified":   verified,
            "confidence": confidence,
            "message":    "Face verified" if verified else "Face not matched",
        }


# ─────────────────────────────────────────────────────────────────────────────
#  Factory
# ─────────────────────────────────────────────────────────────────────────────
def get_face_service():
    mode = current_app.config.get("BIOMETRIC_MODE", "mock")
    return MockFaceService() if mode == "mock" else AzureFaceService()
