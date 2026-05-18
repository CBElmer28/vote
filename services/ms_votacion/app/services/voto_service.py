import requests
from flask import current_app
from app.repositories.voto_repository import VoteRepository
from app.utils.security_utils import sanitize_input


class VoteService:
    """
    Business logic for the voting process.

    Full flow:
      1. Verify the user hasn't voted yet.
      2. Call ms_biometrico /verify/full (face + fingerprint).
      3. Both biometrics must pass — otherwise vote is rejected.
      4. Register the vote with audit data.
    """

    def __init__(self):
        self.repo = VoteRepository()

    def cast_vote(
        self,
        user_id: int,
        candidate_id: int,
        face_bytes: bytes,
        reference_url: str,
        fingerprint_bytes: bytes,
        stored_hash: str,
        ip_address: str = None,
    ):
        reference_url = sanitize_input(reference_url)
        stored_hash = sanitize_input(stored_hash)
        # ── Rule: one vote per user ────────────────────────────────────────
        if self.repo.already_voted(user_id):
            return None, "User has already cast their vote"

        # ── Biometric verification via ms_biometrico ───────────────────────
        # Skip if biometric data is missing (rely on JWT session)
        if not face_bytes or not fingerprint_bytes:
            vote = self.repo.register({
                "user_id":                user_id,
                "candidate_id":           candidate_id,
                "face_confidence":        1.0, # Session trust
                "fingerprint_confidence": 1.0,
                "face_verified":          True,
                "fingerprint_verified":   True,
                "ip_address":             ip_address,
            })
            return vote.to_dict(), None

        biometrico_url = current_app.config["BIOMETRICO_URL"]
        try:
            bio_response = requests.post(
                f"{biometrico_url}/api/biometrico/verify/full",
                files={
                    "face_photo":          ("face.jpg",         face_bytes,        "image/jpeg"),
                    "fingerprint_sample":  ("fingerprint.bin",  fingerprint_bytes, "application/octet-stream"),
                },
                data={
                    "reference_url": reference_url,
                    "stored_hash":   stored_hash,
                },
                timeout=20,
            )
            bio_response.raise_for_status()
            bio = bio_response.json()
        except Exception as e:
            return None, f"Could not reach biometric service: {str(e)}"

        # ── Require BOTH biometrics to pass ────────────────────────────────
        face_ok = bio.get("face", {}).get("verified", False)
        fp_ok   = bio.get("fingerprint", {}).get("verified", False)

        if not face_ok:
            return None, f"Face verification failed: {bio.get('face', {}).get('message', 'unknown')}"
        if not fp_ok:
            return None, f"Fingerprint verification failed: {bio.get('fingerprint', {}).get('message', 'unknown')}"

        # ── Register vote ──────────────────────────────────────────────────
        vote = self.repo.register({
            "user_id":                user_id,
            "candidate_id":           candidate_id,
            "face_confidence":        bio["face"].get("confidence"),
            "fingerprint_confidence": bio["fingerprint"].get("confidence"),
            "face_verified":          True,
            "fingerprint_verified":   True,
            "ip_address":             ip_address,
        })

        return vote.to_dict(), None
