from flask import Blueprint, request, jsonify
from app.services.voto_service import VoteService
from app.utils.jwt_utils import require_token
from app import limiter
from app.utils.security_logger import log_security_event

voto_bp = Blueprint("votes", __name__)
service = VoteService()


@voto_bp.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "service": "ms_votacion", "port": 5003}), 200


@voto_bp.route("/", methods=["POST"])
@require_token
@limiter.limit("1 per minute", error_message="You can only vote once per minute")
def cast_vote(token_payload):
    """
    Registers a vote. 
    Can accept JSON or Form-data.
    Identity is verified via JWT (token_payload['sub']).
    Biometrics are optional in this endpoint (validated at login).
    """
    if request.is_json:
        data = request.get_json()
    else:
        data = request.form

    # ── User identity from JWT (Secure) ────────────────────────────────────
    user_id = token_payload.get("sub")
    candidate_id = data.get("candidate_id")

    if not candidate_id:
        return jsonify({"error": "Missing candidate_id"}), 400

    # ── Biometrics (Optional) ──────────────────────────────────────────────
    # If provided (form-data), we use them. If not, we pass None.
    face_photo = request.files.get("face_photo")
    fingerprint_sample = request.files.get("fingerprint_sample")
    
    face_bytes = face_photo.read() if face_photo else None
    fingerprint_bytes = fingerprint_sample.read() if fingerprint_sample else None
    
    reference_url = data.get("reference_url")
    stored_hash = data.get("stored_hash")

    vote, error = service.cast_vote(
        user_id           = int(user_id),
        candidate_id      = int(candidate_id),
        face_bytes        = face_bytes,
        reference_url     = reference_url,
        fingerprint_bytes = fingerprint_bytes,
        stored_hash       = stored_hash,
        ip_address        = request.remote_addr,
    )

    if error:
        log_security_event("VOTE_FAILED", f"User {user_id} failed to vote: {error}", level="WARNING")
        return jsonify({"error": error}), 400

    log_security_event("VOTE_SUCCESS", f"User {user_id} successfully cast their vote")
    return jsonify({"message": "Voto registrado con éxito", "data": vote}), 201


@voto_bp.route("/user/<int:user_id>", methods=["GET"])
def check_user_vote(user_id):
    """
    GET /api/votos/user/<user_id>
    Returns whether the user has already voted.
    """
    has_voted = service.repo.already_voted(user_id)
    return jsonify({"has_voted": has_voted}), 200
