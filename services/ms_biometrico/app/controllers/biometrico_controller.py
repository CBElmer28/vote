import os
import logging
from flask import Blueprint, request, jsonify, current_app
from webauthn.helpers import options_to_json
import json
from app.services.face_service import get_face_service
from app.services.fingerprint_service import get_fingerprint_service
from app.services.fingerprint_minutiae_service import get_fingerprint_minutiae_service

logger = logging.getLogger(__name__)
biometrico_bp = Blueprint("biometrico", __name__)

# Almacén temporal de challenges (en producción usar Redis)
challenges_db = {}

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

    # Transformamos el objeto a JSON string y luego a dict de Python
    options_json = options_to_json(result["options"])
    resp_data = json.loads(options_json)
    
    # Guardamos el challenge asociado al usuario para el Paso 2
    challenges_db[f"auth_{user_id}"] = result["challenge"]
    
    return jsonify({"options": resp_data}), 200


@biometrico_bp.route("/register/fingerprint/options", methods=["POST"])
def get_registration_options():
    """
    PASO 1 (Registro): El frontend pide opciones para crear nueva huella.
    """
    data = request.get_json()
    user_id = data.get("user_id")
    user_name = data.get("user_name", "User")
    
    if not user_id:
        return jsonify({"error": "user_id is required"}), 400

    service = get_fingerprint_service()
    result = service.generate_registration_options(user_id, user_name)

    if not result["success"]:
        return jsonify({"error": result["error"]}), 500

    challenges_db[f"reg_{user_id}"] = result["challenge"]
    
    # Serialización correcta para la versión actual de la librería
    options_json = options_to_json(result["options"])
    resp_data = json.loads(options_json)
    
    return jsonify({"options": resp_data}), 200


@biometrico_bp.route("/register/fingerprint/verify", methods=["POST"])
def verify_registration():
    """
    PASO 2 (Registro): El frontend envía la nueva credencial generada.
    """
    data = request.get_json()
    user_id = data.get("user_id")
    credential_response = data.get("credential_response")

    if not user_id or not credential_response:
        return jsonify({"error": "Datos incompletos"}), 400

    expected_challenge = challenges_db.get(f"reg_{user_id}")
    if not expected_challenge:
        return jsonify({"error": "Sesión de registro expirada o no iniciada"}), 400

    service = get_fingerprint_service()
    result = service.verify_registration_response(credential_response, expected_challenge)

    if result.get("verified"):
        # Limpiamos el challenge
        del challenges_db[f"reg_{user_id}"]
        return jsonify(result), 200
    else:
        return jsonify(result), 400


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
    expected_challenge = challenges_db.get(f"auth_{user_id}")
    if not expected_challenge:
        return jsonify({"error": "Sesión de autenticación expirada o no iniciada"}), 400
    
    # TODO: 2. Recuperar la llave pública del usuario (esto debería venir de la DB real)
    # Por ahora simulamos que la recuperamos del body para esta prueba técnica, 
    # pero en un sistema real se lee de la tabla 'users' por su DNI/ID.
    public_key_hex = data.get("public_key")
    if not public_key_hex:
        return jsonify({"error": "public_key is required for verification"}), 400
    
    public_key = bytes.fromhex(public_key_hex)

    service = get_fingerprint_service()
    result = service.verify_response(credential_response, expected_challenge, public_key)

    if result.get("verified"):
        return jsonify(result), 200
    else:
        return jsonify(result), 401

# ----------------- NUEVOS ENDPOINTS MINUCIAS (ISO/IEC 19794-2) -----------------

@biometrico_bp.route("/register/fingerprint/minutiae", methods=["POST"])
def register_fingerprint_minutiae():
    """
    Extrae un template de minucias a partir de una imagen para registro inicial.
    """
    if "fingerprint_image" not in request.files:
        return jsonify({"error": "File 'fingerprint_image' is required"}), 400

    image_bytes = request.files["fingerprint_image"].read()
    service = get_fingerprint_minutiae_service()
    
    skeleton = service.preprocess(image_bytes)
    if skeleton is None:
        return jsonify({"error": "Error al procesar la imagen de la huella"}), 400
        
    minutiae_list = service.extract_minutiae(skeleton)
    template = service.generate_iso_template(minutiae_list)
    
    return jsonify({
        "message": "Template de minucias generado correctamente",
        "iso_template": template
    }), 200

@biometrico_bp.route("/verify/fingerprint/minutiae", methods=["POST"])
def verify_fingerprint_minutiae():
    """
    Compara una imagen de huella contra un template de referencia almacenado.
    """
    if "fingerprint_image" not in request.files:
        return jsonify({"error": "File 'fingerprint_image' is required"}), 400
    
    # El template de referencia debe ser enviado como JSON string o cargado de DB
    reference_template_str = request.form.get("reference_template")
    if not reference_template_str:
        return jsonify({"error": "Field 'reference_template' (JSON) is required"}), 400
    
    try:
        reference_template = json.loads(reference_template_str)
        image_bytes = request.files["fingerprint_image"].read()
        
        service = get_fingerprint_minutiae_service()
        
        # Procesar captura actual
        skeleton = service.preprocess(image_bytes)
        if skeleton is None:
            return jsonify({"error": "Error al procesar la captura actual"}), 400
            
        current_minutiae = service.extract_minutiae(skeleton)
        current_template = service.generate_iso_template(current_minutiae)
        
        # Calcular score
        score = service.calculate_score(current_template, reference_template)
        
        # Umbral de aceptación (Threshold)
        # Un score > 40 suele ser suficiente para sets de minucias bien extraídos
        threshold = 45.0
        verified = score >= threshold
        
        return jsonify({
            "verified": verified,
            "score": score,
            "threshold": threshold,
            "message": "Huella verificada" if verified else "Huella no coincide"
        }), 200
        
    except Exception as e:
        logger.error(f"Error en verificación de minucias: {str(e)}")
        return jsonify({"error": str(e)}), 500

@biometrico_bp.route("/verify/full", methods=["POST"])
def verify_full():
    # Este endpoint combinado podría actualizarse para usar el nuevo FingerprintService si se desea.
    # Por ahora se mantiene para no romper compatibilidad si se usa externamente.
    return jsonify({"error": "Endpoint verify/full debe ser actualizado para el nuevo flujo"}), 501
