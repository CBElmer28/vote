from app import db
from sqlalchemy import text


class AnalysisRepository:
    """Read-only data access for vote analysis."""

    def _build_where_clause(self, **filters):
        base_where = []
        params = {}
        
        if filters.get("country"):
            if filters["country"] == "!Perú":
                base_where.append("u.country_residence != 'Perú'")
            else:
                base_where.append("u.country_residence = :country")
                params["country"] = filters["country"]
        
        if filters.get("department"):
            base_where.append("u.department_id = :department")
            params["department"] = filters["department"]
            
        if filters.get("province"):
            base_where.append("u.province_id = :province")
            params["province"] = filters["province"]
            
        if filters.get("district"):
            base_where.append("u.district_id = :district")
            params["district"] = filters["district"]

        where_clause = ""
        if base_where:
            where_clause = "WHERE " + " AND ".join(base_where)
            
        return where_clause, params

    def count_by_candidate(self, **filters):
        where_clause, params = self._build_where_clause(**filters)
        
        sql = text(f"""
            SELECT 
                c.id AS candidate_id, 
                c.full_name AS candidate_name, 
                c.photo_url, 
                c.party_symbol_url,
                COUNT(filtered_votes.id) AS total
            FROM candidates c
            LEFT JOIN (
                SELECT v.id, v.candidate_id 
                FROM votes v
                JOIN users u ON v.user_id = u.id
                {where_clause}
            ) filtered_votes ON c.id = filtered_votes.candidate_id
            GROUP BY c.id, c.full_name, c.photo_url, c.party_symbol_url
            ORDER BY total DESC
        """)
        result = db.session.execute(sql, params)
        return [
            {
                "candidate_id": row.candidate_id, 
                "candidate_name": row.candidate_name, 
                "photo_url": row.photo_url,
                "party_symbol_url": row.party_symbol_url,
                "total": row.total
            } for row in result
        ]

    def total_votes(self, **filters) -> int:
        where_clause, params = self._build_where_clause(**filters)
        sql = text(f"""
            SELECT COUNT(*) AS total 
            FROM votes v
            JOIN users u ON v.user_id = u.id
            {where_clause}
        """)
        result = db.session.execute(sql, params).first()
        return result.total if result else 0

    def votes_per_hour(self):
        # We leave this unfiltered for now as it's a general trend, 
        # or we could filter it if we join users. Let's filter it too to be consistent.
        sql = text("""
            SELECT HOUR(voted_at) AS hour, COUNT(*) AS total
            FROM votes
            GROUP BY hour
            ORDER BY hour
        """)
        result = db.session.execute(sql)
        return [{"hour": row.hour, "total": row.total} for row in result]

    def biometric_audit(self):
        # Unfiltered general audit
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

    def total_voters(self, **filters) -> int:
        where_clause, params = self._build_where_clause(**filters)
        
        # In total_voters, the where_clause already starts with WHERE. 
        # We need to append to the role_id condition.
        if where_clause:
            full_where = f"WHERE u.role_id = 2 AND u.is_active = 1 AND {where_clause.replace('WHERE ', '')}"
        else:
            full_where = "WHERE u.role_id = 2 AND u.is_active = 1"
            
        sql = text(f"SELECT COUNT(*) AS total FROM users u {full_where}")
        result = db.session.execute(sql, params).first()
        return result.total if result else 0
