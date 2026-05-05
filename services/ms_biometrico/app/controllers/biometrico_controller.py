from flask import Blueprint, request, jsonify
from app.services.face_service import get_face_service
from app.services.fingerprint_service import get_fingerprint_service

biometrico_bp = Blueprint("biometrico", __name__)


@biometrico_bp.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "service": "ms_biometrico", "port": 5002}), 200


@biometrico_bp.route("/verify/face", methods=["POST"])
def verify_face():
    """
    POST /api/biometrico/verify/face

    Form-data:
        face_photo    — image file (the photo taken at voting time)
        reference_url — URL of the stored user reference photo
    """
    if "face_photo" not in request.files:
        return jsonify({"error": "File 'face_photo' is required"}), 400

    reference_url = request.form.get("reference_url")
    if not reference_url:
        return jsonify({"error": "Field 'reference_url' is required"}), 400

    face_bytes = request.files["face_photo"].read()
    try:
        result = get_face_service().verify(face_bytes, reference_url)
        return jsonify(result), 200
    except Exception as e:
        return jsonify({"error": "Face verification failed", "detail": str(e)}), 500


@biometrico_bp.route("/verify/fingerprint", methods=["POST"])
def verify_fingerprint():
    """
    POST /api/biometrico/verify/fingerprint

    Form-data:
        fingerprint_sample — raw fingerprint file/bytes from the scanner
        stored_hash        — the fingerprint hash stored for that user
    """
    if "fingerprint_sample" not in request.files:
        return jsonify({"error": "File 'fingerprint_sample' is required"}), 400

    stored_hash = request.form.get("stored_hash")
    if not stored_hash:
        return jsonify({"error": "Field 'stored_hash' is required"}), 400

    fp_bytes = request.files["fingerprint_sample"].read()
    try:
        result = get_fingerprint_service().verify(fp_bytes, stored_hash)
        return jsonify(result), 200
    except Exception as e:
        return jsonify({"error": "Fingerprint verification failed", "detail": str(e)}), 500


@biometrico_bp.route("/verify/full", methods=["POST"])
def verify_full():
    """
    POST /api/biometrico/verify/full
    Combined endpoint — verifies face AND fingerprint in a single call.

    Form-data:
        face_photo          — image file
        reference_url       — URL of the stored user photo
        fingerprint_sample  — raw fingerprint bytes
        stored_hash         — stored fingerprint hash
    """
    errors = []
    if "face_photo" not in request.files:
        errors.append("File 'face_photo' is required")
    if not request.form.get("reference_url"):
        errors.append("Field 'reference_url' is required")
    if "fingerprint_sample" not in request.files:
        errors.append("File 'fingerprint_sample' is required")
    if not request.form.get("stored_hash"):
        errors.append("Field 'stored_hash' is required")
    if errors:
        return jsonify({"errors": errors}), 400

    try:
        face_result = get_face_service().verify(
            request.files["face_photo"].read(),
            request.form["reference_url"],
        )
        fp_result = get_fingerprint_service().verify(
            request.files["fingerprint_sample"].read(),
            request.form["stored_hash"],
        )
    except Exception as e:
        return jsonify({"error": "Biometric verification failed", "detail": str(e)}), 500

    both_verified = face_result["verified"] and fp_result["verified"]
    return jsonify({
        "verified":     both_verified,
        "face":         face_result,
        "fingerprint":  fp_result,
        "message":      "Identity confirmed" if both_verified else "Identity not confirmed",
    }), 200
