from app.models.candidate_model import Candidate
from app import db


class CandidateRepository:
    """Data access layer for Candidate."""

    def get_all(self, only_active: bool = False):
        query = Candidate.query
        if only_active:
            query = query.filter_by(is_active=True)
        return query.order_by(Candidate.id).all()

    def get_by_id(self, candidate_id: int):
        return Candidate.query.get(candidate_id)

    def get_by_name(self, full_name: str):
        return Candidate.query.filter(
            Candidate.full_name.ilike(full_name)
        ).first()

    def create(self, data: dict) -> Candidate:
        candidate = Candidate(**data)
        db.session.add(candidate)
        db.session.commit()
        return candidate

    def update(self, candidate: Candidate, data: dict) -> Candidate:
        for key, value in data.items():
            setattr(candidate, key, value)
        db.session.commit()
        return candidate

    def delete(self, candidate: Candidate) -> None:
        db.session.delete(candidate)
        db.session.commit()

    def toggle_active(self, candidate: Candidate) -> Candidate:
        candidate.is_active = not candidate.is_active
        db.session.commit()
        return candidate
