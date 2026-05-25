from flask import Flask
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from config import Config
from prometheus_flask_exporter import PrometheusMetrics

db = SQLAlchemy()


def create_app():
    app = Flask(__name__)
    metrics = PrometheusMetrics(app)
    app.config.from_object(Config)

    CORS(app)
    db.init_app(app)

    from app.controllers.analisis_controller import analisis_bp
    app.register_blueprint(analisis_bp, url_prefix="/api/analisis")

    return app
