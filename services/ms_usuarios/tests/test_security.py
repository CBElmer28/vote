import pytest
from app.utils.security_utils import sanitize_input

def test_sanitize_input_strips_scripts():
    """Verify that <script> tags are removed from input."""
    payload = {
        "first_name": "Juan <script>alert('xss')</script>",
        "paternal_last_name": "Ortiz",
        "bio": "<b>Bold text</b>"
    }
    
    sanitized = sanitize_input(payload)
    
    # Should remove tags
    assert "<script>" not in sanitized["first_name"]
    assert "alert('xss')" in sanitized["first_name"]
    assert "<b>" not in sanitized["bio"]
    assert "Bold text" in sanitized["bio"]

def test_sanitize_input_recursive():
    """Verify that nested dictionaries are also sanitized."""
    payload = {
        "user": {
            "name": "Hacker <img src=x onerror=alert(1)>",
            "metadata": {
                "tag": "<div>Test</div>"
            }
        }
    }
    
    sanitized = sanitize_input(payload)
    
    assert "<img>" not in sanitized["user"]["name"]
    assert "<div>" not in sanitized["user"]["metadata"]["tag"]
    assert "Hacker" in sanitized["user"]["name"]

def test_sanitize_input_handles_non_strings():
    """Verify that numbers and other types are left intact."""
    payload = {
        "id": 123,
        "is_active": True,
        "score": 95.5
    }
    
    sanitized = sanitize_input(payload)
    
    assert sanitized["id"] == 123
    assert sanitized["is_active"] is True
    assert sanitized["score"] == 95.5
