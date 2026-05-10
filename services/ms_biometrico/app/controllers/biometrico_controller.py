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

@biometrico_bp.route("/verify/face", methods=["POST"])
def verify_face():
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
    Acepta fingerprint_image (archivo) y user_id (form-data).
    Compara contra imagen en storage/huellas/{user_id}.png
    """
    if "fingerprint_image" not in request.files:
        return jsonify({"error": "File 'fingerprint_image' is required"}), 400
    
    user_id = request.form.get("user_id")
    if not user_id:
        return jsonify({"error": "Field 'user_id' is required"}), 400

    try:
        # 1. Leer bytes de la imagen enviada (probe)
        probe_bytes = request.files["fingerprint_image"].read()

        # 2. Obtener imagen de referencia local (simulado)
        # Se asume que la ruta es relativa a la raíz del microservicio o absoluta
        storage_path = os.path.join(os.getcwd(), "storage", "huellas", f"{user_id}.png")
        
        if not os.path.exists(storage_path):
            logger.error(f"Referencia no encontrada: {storage_path}")
            return jsonify({"error": f"No se encontró huella de referencia para el usuario {user_id}"}), 404

        with open(storage_path, "rb") as f:
            reference_bytes = f.read()

        # 3. Verificar usando el servicio
        service = get_fingerprint_service()
        result = service.verify(probe_bytes, reference_bytes)

        return jsonify(result), 200

    except Exception as e:
        logger.error(f"Error en verificación dactilar: {str(e)}")
        return jsonify({"error": "Fingerprint verification failed", "detail": str(e)}), 500

@biometrico_bp.route("/verify/full", methods=["POST"])
def verify_full():
    # Este endpoint combinado podría actualizarse para usar el nuevo FingerprintService si se desea.
    # Por ahora se mantiene para no romper compatibilidad si se usa externamente.
    return jsonify({"error": "Endpoint verify/full debe ser actualizado para el nuevo flujo"}), 501
