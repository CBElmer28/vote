from app.models.voto_model import Vote
from app import db


class VoteRepository:
    """Data access layer for Vote."""

    def already_voted(self, user_id: int) -> bool:
        """Returns True if the user has already cast a vote."""
        return Vote.query.filter_by(user_id=user_id).first() is not None

    def register(self, data: dict) -> Vote:
        vote = Vote(**data)
        db.session.add(vote)
        db.session.commit()
        return vote

    def get_all(self):
        return Vote.query.all()
