from flask import Flask
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from config import Config

db = SQLAlchemy()

def create_app():
    app = Flask(__name__, static_url_path='/api/candidatos/static')
    app.config.from_object(Config)

    CORS(app)
    db.init_app(app)

    from app.controllers.candidate_controller import candidate_bp
    app.register_blueprint(candidate_bp, url_prefix="/api/candidatos")

    with app.app_context():
        db.create_all()

    return app
