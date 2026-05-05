from app import db


class User(db.Model):
    """ORM model for the 'users' table."""
    __tablename__ = "users"

    id                  = db.Column(db.Integer,     primary_key=True, autoincrement=True)
    first_name          = db.Column(db.String(100), nullable=False)
    last_name           = db.Column(db.String(100), nullable=False)
    dni                 = db.Column(db.CHAR(8),     unique=True, nullable=False)
    email               = db.Column(db.String(150), unique=True, nullable=False)
    photo_url           = db.Column(db.String(255), nullable=True)
    fingerprint_hash    = db.Column(db.String(255), nullable=True)
    is_active           = db.Column(db.Boolean,     default=True, nullable=False)
    created_at          = db.Column(db.DateTime,    server_default=db.func.now())
    updated_at          = db.Column(db.DateTime,    server_default=db.func.now(), onupdate=db.func.now())

    def to_dict(self):
        return {
            "id":                self.id,
            "first_name":        self.first_name,
            "last_name":         self.last_name,
            "dni":               self.dni,
            "email":             self.email,
            "photo_url":         self.photo_url,
            "fingerprint_hash":  self.fingerprint_hash,
            "is_active":         self.is_active,
            "created_at":        str(self.created_at),
        }
