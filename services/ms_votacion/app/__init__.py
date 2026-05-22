from flask import Flask
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from config import Config
from prometheus_flask_exporter import PrometheusMetrics

db = SQLAlchemy()
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

limiter = Limiter(
    key_func=get_remote_address,
    # default_limits=["200 per day", "50 per hour"],
    storage_uri="memory://",
)


def create_app(test_config=None):
    app = Flask(__name__)
    metrics = PrometheusMetrics(app)
    if test_config:
        app.config.update(test_config)
    else:
        app.config.from_object(Config)

    CORS(app)
    db.init_app(app)
    limiter.init_app(app)

    from app.controllers.voto_controller import voto_bp
    app.register_blueprint(voto_bp, url_prefix="/api/votacion")

    with app.app_context():
        db.create_all()

    return app
