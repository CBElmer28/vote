from flask import Flask
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from config import Config

db = SQLAlchemy()


def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)

    CORS(app)
    db.init_app(app)

    from app.controllers.voto_controller import voto_bp
    app.register_blueprint(voto_bp, url_prefix="/api/votos")

    with app.app_context():
        db.create_all()

    return app
