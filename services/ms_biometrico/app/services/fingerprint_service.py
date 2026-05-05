"""
Fingerprint Verification Service
----------------------------------
Supports two modes controlled by BIOMETRIC_MODE:

  mock  — Always returns a successful match (for local development).

  azure — Placeholder for real fingerprint verification.
          You can swap this for any fingerprint API
          (e.g., Azure Custom Vision, a local SDK, etc.)
"""

import hashlib
from flask import current_app


# ─────────────────────────────────────────────────────────────────────────────
#  Mock
# ─────────────────────────────────────────────────────────────────────────────
class MockFingerprintService:
    def verify(self, fingerprint_bytes: bytes, stored_hash: str) -> dict:
        return {
            "verified":   True,
            "confidence": 0.98,
            "message":    "mock — fingerprint accepted",
        }


# ─────────────────────────────────────────────────────────────────────────────
#  Simple hash-based verification (real but lightweight)
# ─────────────────────────────────────────────────────────────────────────────
class HashFingerprintService:
    """
    Compares the SHA-256 hash of the incoming fingerprint template
    against the hash stored in the user's record.
    
    In a real scenario you would use a proper minutiae-matching SDK
    (e.g., Neurotechnology VeriFinger, Digital Persona SDK).
    This serves as a structural placeholder.
    """

    def verify(self, fingerprint_bytes: bytes, stored_hash: str) -> dict:
        threshold = current_app.config.get("FP_CONFIDENCE_THRESHOLD", 0.7)
        incoming_hash = hashlib.sha256(fingerprint_bytes).hexdigest()

        matched = (incoming_hash == stored_hash)
        confidence = 1.0 if matched else 0.0
        return {
            "verified":   matched and confidence >= threshold,
            "confidence": confidence,
            "message":    "Fingerprint verified" if matched else "Fingerprint not matched",
        }


# ─────────────────────────────────────────────────────────────────────────────
#  Factory
# ─────────────────────────────────────────────────────────────────────────────
def get_fingerprint_service():
    mode = current_app.config.get("BIOMETRIC_MODE", "mock")
    return MockFingerprintService() if mode == "mock" else HashFingerprintService()
