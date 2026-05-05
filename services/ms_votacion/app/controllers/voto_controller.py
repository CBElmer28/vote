from flask import Blueprint, request, jsonify
from app.services.voto_service import VoteService

voto_bp = Blueprint("votes", __name__)
service = VoteService()


@voto_bp.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "service": "ms_votacion", "port": 5003}), 200


@voto_bp.route("/", methods=["POST"])
def cast_vote():
    """
    POST /api/votos/
    Registers a vote after passing face + fingerprint verification.

    Form-data fields:
        user_id            — ID of the voter
        candidate_id       — ID of the chosen candidate
        reference_url      — URL of the voter's stored reference photo
        stored_hash        — Voter's stored fingerprint hash
        face_photo         — image file (current face scan)
        fingerprint_sample — raw fingerprint bytes from scanner
    """
    # ── Validate required text fields ──────────────────────────────────────
    required_fields = ["user_id", "candidate_id", "reference_url", "stored_hash"]
    missing = [f for f in required_fields if not request.form.get(f)]
    if missing:
        return jsonify({"error": f"Missing fields: {', '.join(missing)}"}), 400

    required_files = ["face_photo", "fingerprint_sample"]
    missing_files = [f for f in required_files if f not in request.files]
    if missing_files:
        return jsonify({"error": f"Missing files: {', '.join(missing_files)}"}), 400

    vote, error = service.cast_vote(
        user_id           = int(request.form["user_id"]),
        candidate_id      = int(request.form["candidate_id"]),
        face_bytes        = request.files["face_photo"].read(),
        reference_url     = request.form["reference_url"],
        fingerprint_bytes = request.files["fingerprint_sample"].read(),
        stored_hash       = request.form["stored_hash"],
        ip_address        = request.remote_addr,
    )

    if error:
        return jsonify({"error": error}), 422

    return jsonify({"message": "Vote registered successfully", "data": vote}), 201


@voto_bp.route("/user/<int:user_id>", methods=["GET"])
def check_user_vote(user_id):
    """
    GET /api/votos/user/<user_id>
    Returns whether the user has already voted.
    """
    has_voted = service.repo.already_voted(user_id)
    return jsonify({"has_voted": has_voted}), 200
