from app.models.usuario_model import User
from app import db


class UserRepository:
    """Data access layer for User."""

    def get_all(self):
        return User.query.all()

    def get_by_id(self, user_id: int):
        return User.query.get(user_id)

    def get_by_dni(self, dni: str):
        return User.query.filter_by(dni=dni).first()

    def create(self, data: dict) -> User:
        user = User(**data)
        db.session.add(user)
        db.session.commit()
        return user

    def update(self, user: User, data: dict) -> User:
        for key, value in data.items():
            setattr(user, key, value)
        db.session.commit()
        return user

    def delete(self, user: User) -> None:
        db.session.delete(user)
        db.session.commit()
