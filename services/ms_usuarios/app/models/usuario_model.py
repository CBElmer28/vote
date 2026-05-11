from app import db

class Role(db.Model):
    """ORM model for the 'roles' table."""
    __tablename__ = "roles"
    
    id          = db.Column(db.Integer, primary_key=True, autoincrement=True)
    name        = db.Column(db.String(50), nullable=False, unique=True)
    description = db.Column(db.String(255))
    
    users       = db.relationship("User", back_populates="role")

class User(db.Model):
    """ORM model for the 'users' table."""
    __tablename__ = "users"

    id                  = db.Column(db.Integer,     primary_key=True, autoincrement=True)
    first_name          = db.Column(db.String(100), nullable=False)
    paternal_last_name  = db.Column(db.String(100), nullable=False)
    maternal_last_name  = db.Column(db.String(100), nullable=False)
    dob                 = db.Column(db.Date,        nullable=False)
    dni                 = db.Column(db.CHAR(8),     unique=True, nullable=False)
    email               = db.Column(db.String(150), unique=True, nullable=True)
    phone               = db.Column(db.String(20),  nullable=True)
    country_residence   = db.Column(db.String(100), nullable=False, default='Perú')
    department_id       = db.Column(db.String(2),   nullable=True)
    province_id         = db.Column(db.String(4),   nullable=True)
    district_id         = db.Column(db.String(6),   nullable=True)
    address             = db.Column(db.String(255), nullable=True)
    photo_url           = db.Column(db.String(255), nullable=True)

    aws_face_id            = db.Column(db.String(255), unique=True, nullable=True)
    webauthn_credential_id = db.Column(db.String(255), unique=True, nullable=True)
    webauthn_public_key    = db.Column(db.Text, nullable=True)
    
    is_active           = db.Column(db.Boolean,     default=True, nullable=False)
    role_id             = db.Column(db.Integer,     db.ForeignKey('roles.id'), nullable=False, default=2)
    created_at          = db.Column(db.DateTime,    server_default=db.func.now())
    updated_at          = db.Column(db.DateTime,    server_default=db.func.now(), onupdate=db.func.now())

    role                = db.relationship("Role", back_populates="users")

    def to_dict(self):
        return {
            "id":                    self.id,
            "first_name":            self.first_name,
            "paternal_last_name":    self.paternal_last_name,
            "maternal_last_name":    self.maternal_last_name,
            "dob":                   str(self.dob) if self.dob else None,
            "dni":                   self.dni,
            "email":                 self.email,
            "phone":                 self.phone,
            "country_residence":     self.country_residence,
            "department_id":         self.department_id,
            "province_id":           self.province_id,
            "district_id":           self.district_id,
            "address":               self.address,
            "photo_url":             self.photo_url,
            "aws_face_id":           self.aws_face_id,
            "webauthn_credential_id":self.webauthn_credential_id,
            "is_active":             self.is_active,
            "role":                  self.role.name if self.role else "VOTER",
            "created_at":            str(self.created_at),
        }