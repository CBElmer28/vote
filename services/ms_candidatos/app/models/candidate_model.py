from app import db


class Candidate(db.Model):
    """ORM model for the 'candidates' table."""
    __tablename__ = "candidates"

    id                = db.Column(db.Integer,     primary_key=True, autoincrement=True)
    full_name         = db.Column(db.String(100), nullable=False)
    party             = db.Column(db.String(100), nullable=True)
    photo_url         = db.Column(db.String(255), nullable=True)
    party_symbol_url  = db.Column(db.String(255), nullable=True)
    members           = db.Column(db.JSON,        nullable=True)   # Presidential ticket [ {name, role, photo}, ... ]
    description       = db.Column(db.Text,        nullable=True)   # bio / campaign summary
    is_active         = db.Column(db.Boolean,     nullable=False, default=True)
    created_at        = db.Column(db.DateTime,    server_default=db.func.now())
    updated_at        = db.Column(db.DateTime,    server_default=db.func.now(), onupdate=db.func.now())

    def to_dict(self):
        return {
            "id":                self.id,
            "full_name":         self.full_name,
            "party":             self.party,
            "photo_url":         self.photo_url,
            "party_symbol_url":  self.party_symbol_url,
            "members":           self.members or [],
            "description":       self.description,
            "is_active":         self.is_active,
            "created_at":        str(self.created_at),
        }
