from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_app_imports_and_docs_returns_200():
    response = client.get("/docs")
    assert response.status_code == 200

def test_signup_and_login_flow():
    email = "phase0_cadet@nexus.ai"
    password = "SecretPassword123"
    signup_res = client.post("/auth/signup", json={"name": "Cadet", "email": email, "password": password})
    assert signup_res.status_code in [200, 400]
    
    login_res = client.post("/login", json={"email": email, "password": password})
    assert login_res.status_code == 200
    data = login_res.json()
    assert "token" in data
    assert data["email"] == email
