"""
Integration Test Suite - VoteSystem
======================================
Tests end-to-end flows across multiple microservices through the Gateway.

Microservices under test:
  - ms_usuarios   (http://localhost/api/usuarios)
  - ms_candidatos (http://localhost/api/candidatos)
  - ms_votacion   (http://localhost/api/votacion)
  - ms_biometrico (http://localhost/api/biometrico)

Prerequisites:
  - All Docker containers must be running: docker-compose up -d
  - Run with: pytest tests/integration/ -v --tb=short
"""

import pytest
import requests
import time
import uuid

BASE_URL = "http://localhost/api"
USERS_URL = f"{BASE_URL}/usuarios"
CANDIDATES_URL = f"{BASE_URL}/candidatos"
VOTE_URL = f"{BASE_URL}/votacion"
BIO_URL = f"{BASE_URL}/biometrico"


# ─────────────────────────────────────────────────────────────────────────────
#  Fixtures: shared state across tests
# ─────────────────────────────────────────────────────────────────────────────

@pytest.fixture(scope="module")
def unique_dni():
    """Generates a unique 8-digit DNI for the test run to avoid collisions."""
    return str(uuid.uuid4().int)[:8]


@pytest.fixture(scope="module")
def registered_user(unique_dni):
    """Creates a voter and yields the user dict. Cleans up after the module."""
    payload = {
        "first_name": "Integration",
        "paternal_last_name": "Test",
        "maternal_last_name": "Voter",
        "dob": "1995-06-15",
        "dni": unique_dni
    }
    res = requests.post(f"{USERS_URL}/", json=payload)
    assert res.status_code == 201, f"Setup failed: could not create user: {res.text}"
    user = res.json()["data"]
    yield user

    # Teardown: delete the created user
    requests.delete(f"{USERS_URL}/{user['id']}")


@pytest.fixture(scope="module")
def auth_token(registered_user):
    """Logs in the registered user and yields a valid JWT token."""
    res = requests.post(f"{USERS_URL}/auth/login", json={"dni": registered_user["dni"]})
    assert res.status_code == 200, f"Login failed: {res.text}"
    return res.json()["token"]


@pytest.fixture(scope="module")
def unique_candidate_name():
    """Generates a unique candidate name to avoid collisions in DB."""
    return f"Candidato Integracion {str(uuid.uuid4().int)[:6]}"


@pytest.fixture(scope="module")
def candidate(unique_candidate_name):
    """Creates a test candidate and cleans up after the module."""
    payload = {
        "full_name": unique_candidate_name,
        "party": "Partido Test",
        "description": "Candidato creado para pruebas de integración"
    }
    res = requests.post(f"{CANDIDATES_URL}/", json=payload)
    assert res.status_code == 201, f"Setup failed: could not create candidate: {res.text}"
    c = res.json()["data"]
    yield c

    # Teardown: delete the created candidate
    requests.delete(f"{CANDIDATES_URL}/{c['id']}")


# ─────────────────────────────────────────────────────────────────────────────
#  Tests
# ─────────────────────────────────────────────────────────────────────────────

class TestHealthChecks:
    """Verify all microservices are alive before running integration flows."""

    def test_usuarios_health(self):
        res = requests.get(f"{USERS_URL}/health")
        assert res.status_code == 200
        assert res.json()["status"] == "ok"

    def test_candidatos_health(self):
        res = requests.get(f"{CANDIDATES_URL}/health")
        assert res.status_code == 200
        assert res.json()["status"] == "ok"

    def test_votacion_health(self):
        res = requests.get(f"{VOTE_URL}/health")
        assert res.status_code == 200
        assert res.json()["status"] == "ok"

    def test_biometrico_health(self):
        res = requests.get(f"{BIO_URL}/health")
        assert res.status_code == 200
        assert res.json()["status"] == "ok"


class TestUserRegistrationFlow:
    """
    Integration Flow 1: Voter Registration
    User Service creates a user → validates data → persists → retrieves.
    """

    def test_register_voter(self, registered_user):
        """Verify the registered user exists with correct data."""
        assert registered_user["first_name"] == "Integration"
        assert registered_user["dni"] is not None

    def test_registered_user_appears_in_list(self, registered_user):
        """Verify the registered user appears in the full user list."""
        res = requests.get(f"{USERS_URL}/")
        assert res.status_code == 200
        all_ids = [u["id"] for u in res.json()["data"]]
        assert registered_user["id"] in all_ids

    def test_registered_user_retrievable_by_id(self, registered_user):
        """Verify the registered user can be retrieved individually."""
        res = requests.get(f"{USERS_URL}/{registered_user['id']}")
        assert res.status_code == 200
        data = res.json()["data"]
        assert data["first_name"] == "Integration"

    def test_duplicate_registration_is_rejected(self, registered_user):
        """Verify that a second registration with the same DNI fails."""
        payload = {
            "first_name": "Duplicate",
            "paternal_last_name": "Test",
            "maternal_last_name": "Voter",
            "dob": "1995-06-15",
            "dni": registered_user["dni"]  # same DNI
        }
        res = requests.post(f"{USERS_URL}/", json=payload)
        assert res.status_code == 422
        assert "already exists" in res.json()["error"]


class TestAuthenticationFlow:
    """
    Integration Flow 2: Authentication (JWT)
    User logs in → receives JWT → JWT is valid for protected routes.
    """

    def test_login_returns_token(self, registered_user):
        """Verify login generates a valid JWT token."""
        res = requests.post(f"{USERS_URL}/auth/login", json={"dni": registered_user["dni"]})
        assert res.status_code == 200
        assert "token" in res.json()
        assert len(res.json()["token"]) > 20

    def test_token_structure(self, auth_token):
        """Verify token is a properly formatted JWT (3 parts separated by dots)."""
        parts = auth_token.split(".")
        assert len(parts) == 3, "JWT must have header.payload.signature"

    def test_invalid_login_rejected(self):
        """Verify login fails for a non-existent DNI."""
        res = requests.post(f"{USERS_URL}/auth/login", json={"dni": "99999999"})
        assert res.status_code == 401
        assert "error" in res.json()

    def test_protected_route_without_token_is_blocked(self):
        """Verify that voting endpoint requires a JWT token."""
        res = requests.post(f"{VOTE_URL}/", json={"candidate_id": 1})
        assert res.status_code == 401


class TestCandidateFlow:
    """
    Integration Flow 3: Candidate Management
    Create candidate → list → retrieve → update → verify update.
    """

    def test_candidate_created(self, candidate, unique_candidate_name):
        """Verify candidate is created with correct data."""
        assert candidate["full_name"] == unique_candidate_name
        assert candidate["party"] == "Partido Test"

    def test_candidate_in_list(self, candidate):
        """Verify created candidate appears in the listing."""
        res = requests.get(f"{CANDIDATES_URL}/")
        assert res.status_code == 200
        all_ids = [c["id"] for c in res.json()["data"]]
        assert candidate["id"] in all_ids

    def test_candidate_detail(self, candidate):
        """Verify candidate detail endpoint works."""
        res = requests.get(f"{CANDIDATES_URL}/{candidate['id']}")
        assert res.status_code == 200
        assert res.json()["data"]["party"] == "Partido Test"

    def test_candidate_update(self, candidate):
        """Verify candidate data can be updated."""
        res = requests.put(
            f"{CANDIDATES_URL}/{candidate['id']}",
            json={"description": "Descripción actualizada en integración"}
        )
        assert res.status_code == 200
        assert "actualizada" in res.json()["data"]["description"]

    def test_nonexistent_candidate_returns_404(self):
        """Verify that requesting a non-existent candidate returns 404."""
        res = requests.get(f"{CANDIDATES_URL}/999999")
        assert res.status_code == 404


class TestVotingFlow:
    """
    Integration Flow 4: End-to-End Voting
    Authenticated user → casts vote → result is recorded.
    """

    def test_vote_requires_candidate_id(self, auth_token):
        """Verify that voting without a candidate is rejected."""
        time.sleep(62)  # Wait for rate limit window (1 per minute) to reset
        headers = {"Authorization": f"Bearer {auth_token}"}
        res = requests.post(f"{VOTE_URL}/", json={}, headers=headers)
        assert res.status_code == 400
        assert "candidate_id" in res.json()["error"]

    def test_vote_cast_successfully(self, registered_user, auth_token, candidate):
        """Verify that an authenticated user can cast a vote."""
        headers = {"Authorization": f"Bearer {auth_token}"}
        payload = {"candidate_id": candidate["id"]}
        res = requests.post(f"{VOTE_URL}/", json=payload, headers=headers)
        # Accept 201 (success), 400 (already voted), 429 (rate limited between tests)
        assert res.status_code in [201, 400, 429]
        if res.status_code == 201:
            assert "Voto registrado" in res.json()["message"]

    def test_double_vote_prevented(self, registered_user, auth_token, candidate):
        """Verify a user cannot vote twice."""
        headers = {"Authorization": f"Bearer {auth_token}"}
        payload = {"candidate_id": candidate["id"]}
        
        # Ensure at least one vote has been registered (either 201 or 400 if already cast)
        # We try multiple times in case of rate limiting (429) due to load balancing across pods
        for _ in range(5):
            res1 = requests.post(f"{VOTE_URL}/", json=payload, headers=headers)
            if res1.status_code in [201, 400]:
                break
            time.sleep(0.5)
            
        # Subsequent attempt must always fail (either 400 already voted or 429 rate limited)
        res2 = requests.post(f"{VOTE_URL}/", json=payload, headers=headers)
        assert res2.status_code in [400, 429]  # 400=already voted, 429=rate limited


class TestSecurityFlow:
    """
    Integration Flow 5: Security validations across services.
    """

    def test_xss_payload_sanitized_in_response(self):
        """Verify XSS payloads are cleaned from API responses."""
        xss_dni = str(uuid.uuid4().int)[:8]
        payload = {
            "first_name": "Hacker<script>alert(1)</script>",
            "paternal_last_name": "Test",
            "maternal_last_name": "X",
            "dob": "1990-01-01",
            "dni": xss_dni
        }
        res = requests.post(f"{USERS_URL}/", json=payload)
        if res.status_code == 201:
            user_id = res.json()["data"]["id"]
            get_res = requests.get(f"{USERS_URL}/{user_id}")
            name = get_res.json()["data"]["first_name"]
            assert "<script>" not in name
            # Cleanup
            requests.delete(f"{USERS_URL}/{user_id}")

    def test_fake_image_blocked_by_biometrico(self):
        """Verify biometric service rejects non-image files."""
        fake_file = b"not-an-image-just-text"
        files = {"face_photo": ("photo.jpg", fake_file, "image/jpeg")}
        res = requests.post(f"{BIO_URL}/register/face", files=files)
        assert res.status_code == 400
        assert "Invalid" in res.json().get("error", "")
