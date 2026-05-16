import jwt
import datetime
from functools import wraps
from flask import request, jsonify, current_app


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
