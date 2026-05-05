import re
from app.repositories.usuario_repository import UserRepository


class UserService:
    """Business logic for User management."""

    def __init__(self):
        self.repo = UserRepository()

    # ------------------------------------------------------------------ #
    #  Helpers
    # ------------------------------------------------------------------ #
    def _validate_dni(self, dni: str) -> str | None:
        """DNI must be exactly 8 numeric digits."""
        if not re.fullmatch(r"\d{8}", str(dni)):
            return "DNI must be exactly 8 numeric digits"
        return None

    # ------------------------------------------------------------------ #
    #  CRUD
    # ------------------------------------------------------------------ #
    def list_users(self):
        return [u.to_dict() for u in self.repo.get_all()]

    def get_user(self, user_id: int):
        user = self.repo.get_by_id(user_id)
        if not user:
            return None, "User not found"
        return user.to_dict(), None

    def create_user(self, data: dict):
        # Required fields
        for field in ["first_name", "last_name", "dni", "email"]:
            if not data.get(field):
                return None, f"Field '{field}' is required"

        # DNI format
        err = self._validate_dni(data["dni"])
        if err:
            return None, err

        # DNI uniqueness
        if self.repo.get_by_dni(data["dni"]):
            return None, f"A user with DNI {data['dni']} already exists"

        user = self.repo.create(data)
        return user.to_dict(), None

    def update_user(self, user_id: int, data: dict):
        user = self.repo.get_by_id(user_id)
        if not user:
            return None, "User not found"

        if "dni" in data:
            err = self._validate_dni(data["dni"])
            if err:
                return None, err
            existing = self.repo.get_by_dni(data["dni"])
            if existing and existing.id != user_id:
                return None, "DNI already in use by another user"

        updated = self.repo.update(user, data)
        return updated.to_dict(), None

    def delete_user(self, user_id: int):
        user = self.repo.get_by_id(user_id)
        if not user:
            return False, "User not found"
        self.repo.delete(user)
        return True, None

    # ------------------------------------------------------------------ #
    #  Auth
    # ------------------------------------------------------------------ #
    def authenticate_user(self, dni: str):
        """Authenticates a user via DNI (no password required for this demo, 
        real security will be biometric in MS3)"""
        if not dni:
            return None, "DNI is required"
        
        user = self.repo.get_by_dni(dni)
        if not user:
            return None, "Invalid DNI: User not found"
        
        if not user.is_active:
            return None, "User account is disabled"
            
        return user.to_dict(), None
