from app import db
from sqlalchemy import text


class AnalysisRepository:
    """Read-only data access for vote analysis."""

    def count_by_candidate(self):
        sql = text("""
            SELECT 
                c.id AS candidate_id, 
                c.full_name AS candidate_name, 
                c.photo_url, 
                c.party_symbol_url,
                COUNT(v.id) AS total
            FROM candidates c
            LEFT JOIN votes v ON c.id = v.candidate_id
            GROUP BY c.id, c.full_name, c.photo_url, c.party_symbol_url
            ORDER BY total DESC
        """)
        result = db.session.execute(sql)
        return [
            {
                "candidate_id": row.candidate_id, 
                "candidate_name": row.candidate_name, 
                "photo_url": row.photo_url,
                "party_symbol_url": row.party_symbol_url,
                "total": row.total
            } for row in result
        ]

    def total_votes(self) -> int:
        sql = text("SELECT COUNT(*) AS total FROM votes")
        result = db.session.execute(sql).first()
        return result.total if result else 0

    def votes_per_hour(self):
        sql = text("""
            SELECT HOUR(voted_at) AS hour, COUNT(*) AS total
            FROM votes
            GROUP BY hour
            ORDER BY hour
        """)
        result = db.session.execute(sql)
        return [{"hour": row.hour, "total": row.total} for row in result]

    def biometric_audit(self):
        """Returns average confidence scores for audit purposes."""
        sql = text("""
            SELECT
                AVG(face_confidence)        AS avg_face_confidence,
                AVG(fingerprint_confidence) AS avg_fp_confidence,
                SUM(face_verified)          AS total_face_verified,
                SUM(fingerprint_verified)   AS total_fp_verified,
                COUNT(*)                    AS total
            FROM votes
        """)
        row = db.session.execute(sql).first()
        return {
            "avg_face_confidence":        round(float(row.avg_face_confidence or 0), 4),
            "avg_fingerprint_confidence": round(float(row.avg_fp_confidence or 0), 4),
            "total_face_verified":        int(row.total_face_verified or 0),
            "total_fingerprint_verified": int(row.total_fp_verified or 0),
            "total_votes":                int(row.total or 0),
        }
