import pytest
from app import create_app, db

@pytest.fixture
def app():
    # Pass a test config to override the real DB
    app = create_app({
        "TESTING": True,
        "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
        "RATELIMIT_ENABLED": False,
        "SECRET_KEY": "test-secret",
        "BIOMETRICO_URL": "http://mock-biometrico"
    })

    with app.app_context():
        db.create_all()
        yield app
        db.session.remove()
        db.drop_all()

@pytest.fixture
def client(app):
    return app.test_client()
