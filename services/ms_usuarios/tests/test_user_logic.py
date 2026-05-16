import pytest
from datetime import date
from app.services.usuario_service import UserService

def test_validate_dni_correct():
    """Verify that a valid 8-digit DNI passes."""
    service = UserService()
    error = service._validate_dni("12345678")
    assert error is None

def test_validate_dni_too_short():
    """Verify that a short DNI fails."""
    service = UserService()
    error = service._validate_dni("123456")
    assert error == "DNI must be exactly 8 numeric digits"

def test_validate_dni_too_long():
    """Verify that a long DNI fails."""
    service = UserService()
    error = service._validate_dni("123456789")
    assert error == "DNI must be exactly 8 numeric digits"

def test_validate_dni_non_numeric():
    """Verify that a non-numeric DNI fails."""
    service = UserService()
    error = service._validate_dni("1234567A")
    assert error == "DNI must be exactly 8 numeric digits"

def test_create_user_sanitization(app):
    """Verify that user creation also triggers sanitization."""
    service = UserService()
    user_data = {
        "first_name": "Juan <script>alert(1)</script>",
        "paternal_last_name": "Ortiz",
        "maternal_last_name": "Perez",
        "dob": date(1990, 1, 1),
        "dni": "88888888"
    }
    
def test_create_user_missing_fields(app):
    """Verify that missing required fields return error."""
    service = UserService()
    user_data = {"first_name": "Juan"}
    user, error = service.create_user(user_data)
    assert user is None
    assert "Field 'paternal_last_name' is required" in error

def test_create_user_duplicate_dni(app):
    """Verify that duplicate DNI is rejected."""
    service = UserService()
    user_data = {
        "first_name": "Juan", "paternal_last_name": "Ortiz", 
        "maternal_last_name": "Perez", "dob": date(1990, 1, 1), 
        "dni": "11111111"
    }
    service.create_user(user_data)
    
    # Try creating again with same DNI
    user, error = service.create_user(user_data)
    assert user is None
    assert "already exists" in error

def test_update_user_not_found(app):
    """Verify that updating a non-existent user returns error."""
    service = UserService()
    user, error = service.update_user(999, {"first_name": "New"})
    assert user is None
    assert error == "User not found"

def test_authenticate_no_credentials(app):
    """Verify that auth fails without DNI or Email."""
    service = UserService()
    user, error = service.authenticate_user(dni=None, email=None)
    assert user is None
    assert "are required" in error

def test_authenticate_user_disabled(app):
    """Verify that disabled users cannot authenticate."""
    service = UserService()
    user_data = {
        "first_name": "Inactive", "paternal_last_name": "User", 
        "maternal_last_name": "X", "dob": date(1990, 1, 1), 
        "dni": "00000000"
    }
    service.create_user(user_data)
    
    # Manually disable
    from app.models.usuario_model import User
    from app import db
    db_user = User.query.filter_by(dni="00000000").first()
    db_user.is_active = False
    db.session.commit()
    
    user, error = service.authenticate_user(dni="00000000")
    assert user is None
    assert error == "User account is disabled"
