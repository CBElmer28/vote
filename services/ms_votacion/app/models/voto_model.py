from app import db


class Vote(db.Model):
    """ORM model for the 'votes' table."""
    __tablename__ = "votes"

    id                      = db.Column(db.Integer,  primary_key=True, autoincrement=True)
    user_id                 = db.Column(db.Integer,  nullable=False, index=True)
    candidate_id            = db.Column(db.Integer,  nullable=False, index=True)
    face_confidence         = db.Column(db.Float,    nullable=True)
    fingerprint_confidence  = db.Column(db.Float,    nullable=True)
    face_verified           = db.Column(db.Boolean,  nullable=False, default=False)
    fingerprint_verified    = db.Column(db.Boolean,  nullable=False, default=False)
    ip_address              = db.Column(db.String(45), nullable=True)
    voted_at                = db.Column(db.DateTime, server_default=db.func.now())

    def to_dict(self):
        return {
            "id":                     self.id,
            "user_id":                self.user_id,
            "candidate_id":           self.candidate_id,
            "face_confidence":        self.face_confidence,
            "fingerprint_confidence": self.fingerprint_confidence,
            "face_verified":          self.face_verified,
            "fingerprint_verified":   self.fingerprint_verified,
            "ip_address":             self.ip_address,
            "voted_at":               str(self.voted_at),
        }
