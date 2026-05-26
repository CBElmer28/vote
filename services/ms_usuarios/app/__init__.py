from flask import Flask
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from config import get_config
from prometheus_flask_exporter import PrometheusMetrics

from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

from flask import request

db = SQLAlchemy()
limiter = Limiter(
    """ key_func=get_remote_address,
    default_limits=["200 per day", "50 per hour"],
    storage_uri="memory://", """
)


def create_app(test_config=None):
    app = Flask(__name__)
    metrics = PrometheusMetrics(app)
    if test_config:
        app.config.update(test_config)
    else:
        app.config.from_object(get_config())

    CORS(app)
    db.init_app(app)
    limiter.init_app(app)

    @limiter.request_filter
    def exempt_metrics():
        return request.path == "/metrics" or request.path == "/api/usuarios/health"

    # Registrar blueprints (controladores)
    from app.controllers.usuario_controller import usuario_bp
    app.register_blueprint(usuario_bp, url_prefix="/api/usuarios")

    # Crear tablas si no existen
    with app.app_context():
        db.create_all()

    return app
