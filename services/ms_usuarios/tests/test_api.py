import pytest

def test_health_check(client):
    """Verify that health check endpoint works."""
    response = client.get("/api/usuarios/health")
    assert response.status_code == 200
    assert response.json["status"] == "ok"

def test_api_create_user_success(client):
    """Verify that user creation via API works."""
    payload = {
        "first_name": "API",
        "paternal_last_name": "Test",
        "maternal_last_name": "One",
        "dob": "1990-01-01",
        "dni": "99999999"
    }
    response = client.post("/api/usuarios/", json=payload)
    assert response.status_code == 201
    assert "User created successfully" in response.json["message"]

def test_api_login_success(client, app):
    """Verify that login via API returns a token."""
    # First create a user
    from app.services.usuario_service import UserService
    from datetime import date
    service = UserService()
    service.create_user({
        "first_name": "Login", "paternal_last_name": "User", 
        "maternal_last_name": "X", "dob": date(1990, 1, 1), 
        "dni": "77777777"
    })
    
    # Try login
    payload = {"dni": "77777777"}
    response = client.post("/api/usuarios/auth/login", json=payload)
    assert response.status_code == 200
    assert "token" in response.json
    assert "user" in response.json

def test_api_login_fail(client):
    """Verify that login fails for non-existent user."""
    payload = {"dni": "00000001"}
    response = client.post("/api/usuarios/auth/login", json=payload)
    assert response.status_code == 401
    assert "error" in response.json

def test_api_crud_workflow(client):
    """Verify full CRUD cycle via API."""
    # 1. Create
    payload = {
        "first_name": "CRUD", "paternal_last_name": "Test", 
        "maternal_last_name": "X", "dob": "1995-05-05", "dni": "66666666"
    }
    create_res = client.post("/api/usuarios/", json=payload)
    user_id = create_res.json["data"]["id"]
    
    # 2. Get
    get_res = client.get(f"/api/usuarios/{user_id}")
    assert get_res.status_code == 200
    assert get_res.json["data"]["dni"] == "66666666"
    
    # 3. List
    list_res = client.get("/api/usuarios/")
    assert list_res.status_code == 200
    assert any(u["id"] == user_id for u in list_res.json["data"])
    
    # 4. Update
    update_res = client.put(f"/api/usuarios/{user_id}", json={"first_name": "Updated"})
    assert update_res.status_code == 200
    assert update_res.json["data"]["first_name"] == "Updated"
    
    # 5. Delete
    delete_res = client.delete(f"/api/usuarios/{user_id}")
    assert delete_res.status_code == 200
    
    # 6. Verify deleted
    final_res = client.get(f"/api/usuarios/{user_id}")
    assert final_res.status_code == 404
