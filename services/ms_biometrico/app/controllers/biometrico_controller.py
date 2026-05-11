import os
import logging
from flask import Blueprint, request, jsonify, current_app
from app.services.face_service import get_face_service
from app.services.fingerprint_service import get_fingerprint_service

logger = logging.getLogger(__name__)
biometrico_bp = Blueprint("biometrico", __name__)

@biometrico_bp.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "service": "ms_biometrico", "port": 5002}), 200

# ----------------- NUEVA RUTA DE REGISTRO AWS -----------------
@biometrico_bp.route("/register/face", methods=["POST"])
def register_face():
    if "face_photo" not in request.files:
        return jsonify({"error": "File 'face_photo' is required"}), 400

    face_bytes = request.files["face_photo"].read()
    try:
        face_id = get_face_service().register_face(face_bytes)
        if not face_id:
            return jsonify({"error": "No se detectó un rostro válido para registrar"}), 400
            
        return jsonify({"message": "Rostro registrado", "aws_face_id": face_id}), 200
    except Exception as e:
        return jsonify({"error": "Face registration failed", "detail": str(e)}), 500

# ----------------- RUTA DE VERIFICACIÓN ACTUALIZADA -----------------
@biometrico_bp.route("/verify/face", methods=["POST"])
def verify_face():
    if "face_photo" not in request.files:
        return jsonify({"error": "File 'face_photo' is required"}), 400

    # AHORA PEDIMOS EL FACE_ID GUARDADO EN BASE DE DATOS, NO UNA URL
    reference_face_id = request.form.get("reference_face_id")
    if not reference_face_id:
        return jsonify({"error": "Field 'reference_face_id' is required"}), 400

    face_bytes = request.files["face_photo"].read()
    try:
        # PASAMOS EL ID AL SERVICIO
        result = get_face_service().verify(face_bytes, reference_face_id)
        return jsonify(result), 200
    except Exception as e:
        return jsonify({"error": "Face verification failed", "detail": str(e)}), 500

@biometrico_bp.route("/verify/fingerprint/options", methods=["POST"])
def get_fingerprint_options():
    """
    PASO 1: El frontend pide un desafío para iniciar la lectura de huella.
    JSON esperado: {"user_id": 123}
    """
    data = request.get_json()
    user_id = data.get("user_id")
    
    if not user_id:
        return jsonify({"error": "user_id is required"}), 400

    # TODO: Consultar DB para obtener el webauthn_credential_id de este user_id
    # usuario = Usuario.query.get(user_id)
    # credential_id = usuario.webauthn_credential_id
    credential_id = "simulated_base64_credential_id" # MOCK temporal

    service = get_fingerprint_service()
    result = service.generate_options(credential_id)

    if not result["success"]:
        return jsonify({"error": result["error"]}), 500

    # TODO: Debes guardar result["challenge"] en una base de datos temporal,
    # Redis o Cache atado al user_id para compararlo en el PASO 2.

    # options.json_dict() formatea la data para que el frontend (React) la consuma fácilmente
    return jsonify({"options": result["options"]}), 200


@biometrico_bp.route("/verify/fingerprint/verify", methods=["POST"])
def verify_fingerprint_signature():
    """
    PASO 2: El frontend envía la firma generada por el celular.
    JSON esperado: {"user_id": 123, "credential_response": {...}}
    """
    data = request.get_json()
    user_id = data.get("user_id")
    credential_response = data.get("credential_response") # Payload nativo de WebAuthn

    if not user_id or not credential_response:
        return jsonify({"error": "user_id y credential_response son requeridos"}), 400

    # TODO: 1. Recuperar el expected_challenge guardado en el Paso 1.
    expected_challenge = b'expected_challenge_from_db_or_redis'
    
    # TODO: 2. Recuperar la llave pública del usuario desde la DB
    # usuario = Usuario.query.get(user_id)
    # public_key = usuario.webauthn_public_key
    public_key = b'simulated_public_key'

    service = get_fingerprint_service()
    result = service.verify_response(credential_response, expected_challenge, public_key)

    if result.get("verified"):
        return jsonify(result), 200
    else:
        return jsonify(result), 401

@biometrico_bp.route("/verify/full", methods=["POST"])
def verify_full():
    # Este endpoint combinado podría actualizarse para usar el nuevo FingerprintService si se desea.
    # Por ahora se mantiene para no romper compatibilidad si se usa externamente.
    return jsonify({"error": "Endpoint verify/full debe ser actualizado para el nuevo flujo"}), 501
