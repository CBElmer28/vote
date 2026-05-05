from flask import Blueprint, request, jsonify
from app.services.candidate_service import CandidateService

candidate_bp = Blueprint("candidates", __name__)
service = CandidateService()


@candidate_bp.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "service": "ms_candidatos", "port": 5005}), 200


# ------------------------------------------------------------------ #
#  GET /api/candidates/          → list all (query param: active=true)
# ------------------------------------------------------------------ #
@candidate_bp.route("/", methods=["GET"])
def list_candidates():
    """
    GET /api/candidates/
    Optional query param:  ?active=true  → returns only active candidates
    """
    only_active = request.args.get("active", "").lower() == "true"
    candidates = service.list_candidates(only_active=only_active)
    return jsonify({"data": candidates, "total": len(candidates)}), 200


# ------------------------------------------------------------------ #
#  GET /api/candidates/<id>
# ------------------------------------------------------------------ #
@candidate_bp.route("/<int:candidate_id>", methods=["GET"])
def get_candidate(candidate_id):
    candidate, error = service.get_candidate(candidate_id)
    if error:
        return jsonify({"error": error}), 404
    return jsonify({"data": candidate}), 200


# ------------------------------------------------------------------ #
#  POST /api/candidates/
# ------------------------------------------------------------------ #
@candidate_bp.route("/", methods=["POST"])
def create_candidate():
    """
    POST /api/candidates/
    JSON body:
        full_name   (required)
        party       (optional)
        photo_url   (optional)
        description (optional) — bio / campaign summary
    """
    data = request.get_json()
    if not data:
        return jsonify({"error": "JSON body required"}), 400

    candidate, error = service.create_candidate(data)
    if error:
        return jsonify({"error": error}), 422

    return jsonify({"message": "Candidate created successfully", "data": candidate}), 201


# ------------------------------------------------------------------ #
#  PUT /api/candidates/<id>
# ------------------------------------------------------------------ #
@candidate_bp.route("/<int:candidate_id>", methods=["PUT"])
def update_candidate(candidate_id):
    data = request.get_json()
    if not data:
        return jsonify({"error": "JSON body required"}), 400

    candidate, error = service.update_candidate(candidate_id, data)
    if error:
        return jsonify({"error": error}), 422
    return jsonify({"message": "Candidate updated", "data": candidate}), 200


# ------------------------------------------------------------------ #
#  PATCH /api/candidates/<id>/toggle  → activate / deactivate
# ------------------------------------------------------------------ #
@candidate_bp.route("/<int:candidate_id>/toggle", methods=["PATCH"])
def toggle_active(candidate_id):
    """
    PATCH /api/candidates/<id>/toggle
    Flips the is_active flag — useful to disable a candidate
    without permanently deleting their record.
    """
    candidate, error = service.toggle_active(candidate_id)
    if error:
        return jsonify({"error": error}), 404
    status = "activated" if candidate["is_active"] else "deactivated"
    return jsonify({"message": f"Candidate {status}", "data": candidate}), 200


# ------------------------------------------------------------------ #
#  DELETE /api/candidates/<id>
# ------------------------------------------------------------------ #
@candidate_bp.route("/<int:candidate_id>", methods=["DELETE"])
def delete_candidate(candidate_id):
    ok, error = service.delete_candidate(candidate_id)
    if error:
        return jsonify({"error": error}), 404
    return jsonify({"message": "Candidate deleted"}), 200
