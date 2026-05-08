"""
JWT utilities — shared auth logic for ms_usuarios.

Token payload structure:
    {
        "sub":   <user_id>,
        "dni":   <dni>,
        "name":  <first_name + last_name>,
        "role":  <role_name>,
        "iat":   <issued_at>,
        "exp":   <expiry>
    }
"""

import jwt
import datetime
from functools import wraps
from flask import request, jsonify, current_app


# ─────────────────────────────────────────────────────────────────────────────
#  Token generation
# ─────────────────────────────────────────────────────────────────────────────
def generate_token(user: dict, expires_hours: int = 8) -> str:
    """Creates a signed JWT for the given user dict (output of User.to_dict())."""
    payload = {
        "sub":  user["id"],
        "dni":  user["dni"],
        "name": f"{user['first_name']} {user['paternal_last_name']} {user['maternal_last_name']}",
        "role": user.get("role", "VOTER"),
        "iat":  datetime.datetime.utcnow(),
        "exp":  datetime.datetime.utcnow() + datetime.timedelta(hours=expires_hours),
    }
    return jwt.encode(payload, current_app.config["SECRET_KEY"], algorithm="HS256")


# ─────────────────────────────────────────────────────────────────────────────
#  Token validation decorator
# ─────────────────────────────────────────────────────────────────────────────
def require_token(f):
    """
    Decorator that validates the Bearer JWT on protected endpoints.
    On success, injects `token_payload` into kwargs.
    """
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return jsonify({"error": "Authorization header missing or malformed"}), 401

        token = auth_header.split(" ", 1)[1]
        try:
            payload = jwt.decode(
                token,
                current_app.config["SECRET_KEY"],
                algorithms=["HS256"],
            )
        except jwt.ExpiredSignatureError:
            return jsonify({"error": "Token has expired"}), 401
        except jwt.InvalidTokenError as e:
            return jsonify({"error": f"Invalid token: {str(e)}"}), 401

        kwargs["token_payload"] = payload
        return f(*args, **kwargs)
    return decorated
