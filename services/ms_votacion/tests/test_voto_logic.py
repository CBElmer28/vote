import pytest
from unittest.mock import patch, MagicMock
from app.services.voto_service import VoteService

def test_cast_vote_skips_biometrics_when_missing(app):
    """Verify that voting works without biometrics if session is valid."""
    service = VoteService()
    
    # Mocking the repository already_voted check
    with patch.object(service.repo, 'already_voted', return_value=False):
        # Mocking the repository register call
        mock_vote = MagicMock()
        mock_vote.to_dict.return_value = {"id": 1, "user_id": 10, "candidate_id": 5}
        
        with patch.object(service.repo, 'register', return_value=mock_vote):
            vote, error = service.cast_vote(
                user_id=10,
                candidate_id=5,
                face_bytes=None,
                fingerprint_bytes=None,
                reference_url=None,
                stored_hash=None,
                ip_address="127.0.0.1"
            )
            
            assert error is None
            assert vote["user_id"] == 10
            assert vote["candidate_id"] == 5

def test_cast_vote_fails_if_already_voted(app):
    """Verify that a user cannot vote twice."""
    service = VoteService()
    
    with patch.object(service.repo, 'already_voted', return_value=True):
        vote, error = service.cast_vote(
            user_id=10,
            candidate_id=5,
            face_bytes=None,
            fingerprint_bytes=None,
            reference_url=None,
            stored_hash=None,
            ip_address="127.0.0.1"
        )
        
        assert vote is None
        assert error == "User has already cast their vote"

@patch("requests.post")
def test_cast_vote_calls_biometric_if_provided(mock_post, app):
    """Verify that biometric service is called if face_bytes are provided."""
    service = VoteService()
    
    # Mock successful biometric response
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "face": {"verified": True, "confidence": 0.99},
        "fingerprint": {"verified": True, "confidence": 0.98}
    }
    mock_post.return_value = mock_response

    with patch.object(service.repo, 'already_voted', return_value=False):
        mock_vote = MagicMock()
        mock_vote.to_dict.return_value = {"id": 1, "user_id": 10}
        
        with patch.object(service.repo, 'register', return_value=mock_vote):
            vote, error = service.cast_vote(
                user_id=10,
                candidate_id=5,
                face_bytes=b"fake-face",
                fingerprint_bytes=b"fake-fingerprint",
                reference_url="http://ref",
                stored_hash="hash",
                ip_address="127.0.0.1"
            )
            
            assert error is None
            assert mock_post.called
