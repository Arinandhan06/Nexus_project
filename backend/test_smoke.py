from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_app_imports_and_docs_returns_200():
    response = client.get("/docs")
    assert response.status_code == 200

def test_github_login_endpoint():
    response = client.get("/auth/github/login")
    assert response.status_code == 200
    assert "url" in response.json()
