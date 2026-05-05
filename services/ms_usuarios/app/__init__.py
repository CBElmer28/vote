from flask import Flask
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from config import get_config

db = SQLAlchemy()


def create_app():
    app = Flask(__name__)
    app.config.from_object(get_config())

    CORS(app)
    db.init_app(app)

    # Registrar blueprints (controladores)
    from app.controllers.usuario_controller import usuario_bp
    app.register_blueprint(usuario_bp, url_prefix="/api/usuarios")

    # Crear tablas si no existen
    with app.app_context():
        db.create_all()

    return app
