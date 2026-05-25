from flask import Flask
from flask_cors import CORS
from config import Config
from prometheus_flask_exporter import PrometheusMetrics


def create_app():
    app = Flask(__name__)
    metrics = PrometheusMetrics(app)
    app.config.from_object(Config)

    CORS(app)

    from app.controllers.biometrico_controller import biometrico_bp
    app.register_blueprint(biometrico_bp, url_prefix="/api/biometrico")

    return app
