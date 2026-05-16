import requests
import time

BASE_URL = "http://localhost/api"

def test_dni_boundaries():
    print("\n[Black Box] Testing DNI Boundary Values...")
    
    # 1. Too short (7 digits)
    res = requests.post(f"{BASE_URL}/usuarios/", json={
        "first_name": "Test", "paternal_last_name": "Short", 
        "maternal_last_name": "X", "dob": "1990-01-01", "dni": "1234567"
    })
    print(f"7 digits: {res.status_code} - {res.json().get('error')}")
    assert res.status_code == 422 or res.status_code == 400
    
    # 2. Too long (9 digits)
    res = requests.post(f"{BASE_URL}/usuarios/", json={
        "first_name": "Test", "paternal_last_name": "Long", 
        "maternal_last_name": "X", "dob": "1990-01-01", "dni": "123456789"
    })
    print(f"9 digits: {res.status_code} - {res.json().get('error')}")
    assert res.status_code == 422 or res.status_code == 400

def test_xss_sanitization_output():
    print("\n[Black Box] Testing XSS Sanitization Output...")
    payload = {
        "first_name": "Hacker <script>alert('XSS')</script>",
        "paternal_last_name": "Man",
        "maternal_last_name": "X",
        "dob": "1990-01-01",
        "dni": "13371337"
    }
    res = requests.post(f"{BASE_URL}/usuarios/", json=payload)
    if res.status_code == 201:
        user_id = res.json()["data"]["id"]
        # Now fetch the user and check if the name is clean
        get_res = requests.get(f"{BASE_URL}/usuarios/{user_id}")
        clean_name = get_res.json()["data"]["first_name"]
        print(f"Sanitized name in output: '{clean_name}'")
        assert "<script>" not in clean_name
    else:
        print(f"Failed to create user: {res.status_code} - {res.text}")

def test_rate_limiting_login():
    print("\n[Black Box] Testing Rate Limiting on Login...")
    # Attempt 15 logins (limit is 10 per minute)
    for i in range(12):
        res = requests.post(f"{BASE_URL}/usuarios/auth/login", json={"dni": "99999999"})
        if res.status_code == 429:
            print(f"Rate limit hit at attempt {i+1}!")
            return
        time.sleep(0.1)
    print("Warning: Rate limit NOT hit after 12 attempts.")

if __name__ == "__main__":
    try:
        test_dni_boundaries()
        test_xss_sanitization_output()
        test_rate_limiting_login()
    except Exception as e:
        print(f"Test failed with error: {e}")
