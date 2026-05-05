from flask import Blueprint, request, jsonify
from app.services.usuario_service import UserService

usuario_bp = Blueprint("users", __name__)
service = UserService()


@usuario_bp.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "service": "ms_usuarios", "port": 5001}), 200


@usuario_bp.route("/", methods=["GET"])
def list_users():
    """GET /api/usuarios/ — Returns all users."""
    users = service.list_users()
    return jsonify({"data": users, "total": len(users)}), 200


@usuario_bp.route("/<int:user_id>", methods=["GET"])
def get_user(user_id):
    """GET /api/usuarios/<id>"""
    user, error = service.get_user(user_id)
    if error:
        return jsonify({"error": error}), 404
    return jsonify({"data": user}), 200


@usuario_bp.route("/", methods=["POST"])
def create_user():
    """
    POST /api/usuarios/
    JSON body:
        first_name, last_name, dni (8 digits), email,
        photo_url (optional), fingerprint_hash (optional)
    """
    data = request.get_json()
    if not data:
        return jsonify({"error": "JSON body required"}), 400

    user, error = service.create_user(data)
    if error:
        return jsonify({"error": error}), 422

    return jsonify({"message": "User created successfully", "data": user}), 201


@usuario_bp.route("/<int:user_id>", methods=["PUT"])
def update_user(user_id):
    """PUT /api/usuarios/<id>"""
    data = request.get_json()
    if not data:
        return jsonify({"error": "JSON body required"}), 400

    user, error = service.update_user(user_id, data)
    if error:
        return jsonify({"error": error}), 422
    return jsonify({"message": "User updated", "data": user}), 200


@usuario_bp.route("/<int:user_id>", methods=["DELETE"])
def delete_user(user_id):
    """DELETE /api/usuarios/<id>"""
    ok, error = service.delete_user(user_id)
    if error:
        return jsonify({"error": error}), 404
    return jsonify({"message": "User deleted"}), 200


# ------------------------------------------------------------------ #
#  AUTH ENDPOINTS
# ------------------------------------------------------------------ #
from app.utils.jwt_utils import generate_token, require_token

@usuario_bp.route("/auth/login", methods=["POST"])
def login():
    """
    POST /api/usuarios/auth/login
    Authenticates a user by DNI and returns a JWT token.
    JSON body: { "dni": "12345678" }
    """
    data = request.get_json()
    if not data or "dni" not in data:
        return jsonify({"error": "DNI is required"}), 400

    user, error = service.authenticate_user(data["dni"])
    if error:
        return jsonify({"error": error}), 401

    token = generate_token(user)
    return jsonify({
        "message": "Login successful",
        "token": token,
        "user": user
    }), 200


@usuario_bp.route("/auth/me", methods=["GET"])
@require_token
def get_current_user(token_payload):
    """
    GET /api/usuarios/auth/me
    Returns the currently logged-in user's profile based on their token.
    Requires 'Authorization: Bearer <token>' header.
    """
    # The user ID is in the "sub" claim of the token
    user_id = token_payload["sub"]
    user, error = service.get_user(user_id)
    if error:
        return jsonify({"error": error}), 404
        
    return jsonify({"data": user}), 200
