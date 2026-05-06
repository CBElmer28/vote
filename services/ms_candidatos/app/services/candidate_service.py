from app.repositories.candidate_repository import CandidateRepository
from app.utils.image_handler import ImageHandler


class CandidateService:
    """Business logic for Candidate management."""

    def __init__(self):
        self.repo = CandidateRepository()

    def _process_images(self, data: dict):
        """Detects base64 strings in image fields and saves them as files."""
        # 1. Main Candidate Images
        for field in ["photo_url", "party_symbol_url"]:
            val = data.get(field)
            if val and val.startswith("data:image"):
                new_url = ImageHandler.save_base64_as_webp(val)
                if new_url:
                    data[field] = new_url

        # 2. Nested Members Images
        if "members" in data and isinstance(data["members"], list):
            for member in data["members"]:
                photo = member.get("photo")
                if photo and photo.startswith("data:image"):
                    new_url = ImageHandler.save_base64_as_webp(photo)
                    if new_url:
                        member["photo"] = new_url
        return data

    # ------------------------------------------------------------------ #
    #  Queries
    # ------------------------------------------------------------------ #
    def list_candidates(self, only_active: bool = False):
        candidates = self.repo.get_all(only_active=only_active)
        return [c.to_dict() for c in candidates]

    def get_candidate(self, candidate_id: int):
        candidate = self.repo.get_by_id(candidate_id)
        if not candidate:
            return None, "Candidate not found"
        return candidate.to_dict(), None

    # ------------------------------------------------------------------ #
    #  Mutations
    # ------------------------------------------------------------------ #
    def create_candidate(self, data: dict):
        if not data.get("full_name"):
            return None, "Field 'full_name' is required"

        # Prevent exact duplicates (case-insensitive)
        existing = self.repo.get_by_name(data["full_name"])
        if existing:
            return None, f"A candidate named '{data['full_name']}' already exists"

        # Only allow known fields to reach the model
        allowed = {"full_name", "party", "photo_url", "party_symbol_url", "members", "description", "is_active"}
        clean_data = {k: v for k, v in data.items() if k in allowed}

        # Process any base64 images
        clean_data = self._process_images(clean_data)

        candidate = self.repo.create(clean_data)
        return candidate.to_dict(), None

    def update_candidate(self, candidate_id: int, data: dict):
        candidate = self.repo.get_by_id(candidate_id)
        if not candidate:
            return None, "Candidate not found"

        # If renaming, check no other candidate uses that name
        if "full_name" in data:
            existing = self.repo.get_by_name(data["full_name"])
            if existing and existing.id != candidate_id:
                return None, f"Another candidate is already named '{data['full_name']}'"

        allowed = {"full_name", "party", "photo_url", "party_symbol_url", "members", "description", "is_active"}
        clean_data = {k: v for k, v in data.items() if k in allowed}

        # Process any base64 images
        clean_data = self._process_images(clean_data)

        updated = self.repo.update(candidate, clean_data)
        return updated.to_dict(), None

    def delete_candidate(self, candidate_id: int):
        candidate = self.repo.get_by_id(candidate_id)
        if not candidate:
            return False, "Candidate not found"
        self.repo.delete(candidate)
        return True, None

    def toggle_active(self, candidate_id: int):
        """Enable or disable a candidate without deleting them."""
        candidate = self.repo.get_by_id(candidate_id)
        if not candidate:
            return None, "Candidate not found"
        updated = self.repo.toggle_active(candidate)
        return updated.to_dict(), None
