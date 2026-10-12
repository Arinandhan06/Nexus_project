import os
import time
import sqlite3
import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient

# Ensure test env vars
os.environ["GITHUB_CLIENT_ID"] = "test_client_id_123"
os.environ["GITHUB_CLIENT_SECRET"] = "test_client_secret_xyz"
os.environ["GITHUB_REDIRECT_URI"] = "http://localhost:8000/auth/github/callback"
os.environ["FRONTEND_URL"] = "http://localhost:5173"
os.environ["SESSION_SECRET"] = "test_super_secret_session_key_32chars"

from main import app
import database
import auth_github

client = TestClient(app)

@pytest.fixture(autouse=True)
def clean_auth_tables():
    # Ensure tables exist
    database.init_db()
    conn = sqlite3.connect(database.DB_PATH)
    cursor = conn.cursor()
    cursor.execute("DELETE FROM oauth_states")
    cursor.execute("DELETE FROM sessions")
    # Reset in-memory rate limiter timestamps for tests
    auth_github._ip_request_timestamps.clear()
    conn.commit()
    conn.close()

def _create_mock_response(status_code: int, json_data: dict):
    resp = MagicMock()
    resp.status_code = status_code
    resp.json.return_value = json_data
    return resp

def test_login_url_generation():
    res = client.get("/auth/github/login")
    assert res.status_code == 200
    data = res.json()
    assert "url" in data
    assert "https://github.com/login/oauth/authorize" in data["url"]
    assert "client_id=test_client_id_123" in data["url"]
    assert "scope=public_repo+read%3Auser" in data["url"] or "scope=public_repo read:user" in data["url"]

def test_state_is_single_use():
    login_res = client.get("/auth/github/login")
    state = login_res.json()["url"].split("state=")[-1]
    
    # First verify and consume succeeds
    assert database.consume_oauth_state(state) is True
    
    # Second consume fails (single-use)
    assert database.consume_oauth_state(state) is False

def test_expired_state_is_rejected():
    expired_state = "expired_state_test_token"
    conn = sqlite3.connect(database.DB_PATH)
    cursor = conn.cursor()
    # Insert with timestamp older than 10 minutes (650 seconds ago)
    old_ts = time.time() - 650.0
    cursor.execute("INSERT INTO oauth_states (state, created_at) VALUES (?, ?)", (expired_state, old_ts))
    conn.commit()
    conn.close()

    assert database.consume_oauth_state(expired_state) is False

def test_callback_with_bad_state_returns_400():
    res = client.get("/auth/github/callback?code=some_code&state=non_existent_state", follow_redirects=False)
    assert res.status_code == 400
    assert "Invalid or expired OAuth state" in res.json()["detail"]

def test_first_login_creates_user_and_player_profile():
    login_res = client.get("/auth/github/login")
    state = login_res.json()["url"].split("state=")[-1]

    mock_token_resp = _create_mock_response(200, {"access_token": "gho_secret_token_12345"})
    mock_user_resp = _create_mock_response(200, {
        "id": 99901,
        "login": "cadet_zero",
        "name": "Cadet Zero",
        "avatar_url": "https://avatars.githubusercontent.com/u/99901",
        "email": "cadet_zero@nexus.ai"
    })

    with patch("httpx.AsyncClient.post", return_value=mock_token_resp), \
         patch("httpx.AsyncClient.get", return_value=mock_user_resp):
        res = client.get(f"/auth/github/callback?code=valid_code&state={state}", follow_redirects=False)

    assert res.status_code == 302
    redirect_url = res.headers["location"]
    assert "http://localhost:5173/auth/callback#token=" in redirect_url

    # Check database
    conn = sqlite3.connect(database.DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users WHERE github_id = '99901'")
    user = cursor.fetchone()
    assert user is not None
    assert user["github_username"] == "cadet_zero"
    assert user["avatar_url"] == "https://avatars.githubusercontent.com/u/99901"
    assert user["github_token_enc"] is not None
    assert "gho_secret_token_12345" not in user["github_token_enc"]

    # Verify player_profile was created
    cursor.execute("SELECT * FROM player_profile WHERE user_id = ?", (user["id"],))
    profile = cursor.fetchone()
    assert profile is not None
    assert profile["total_nxp"] == 0
    assert profile["current_chamber"] == 1
    assert profile["onboarding_complete"] == 0
    conn.close()

def test_second_login_reuses_existing_user():
    # First login
    login_res_1 = client.get("/auth/github/login")
    state_1 = login_res_1.json()["url"].split("state=")[-1]

    mock_token_resp = _create_mock_response(200, {"access_token": "token_first"})
    mock_user_resp = _create_mock_response(200, {
        "id": 88802,
        "login": "veteran_cadet",
        "name": "Veteran Cadet",
        "avatar_url": "https://avatars.githubusercontent.com/u/88802",
        "email": "vet@nexus.ai"
    })

    with patch("httpx.AsyncClient.post", return_value=mock_token_resp), \
         patch("httpx.AsyncClient.get", return_value=mock_user_resp):
        client.get(f"/auth/github/callback?code=code_1&state={state_1}", follow_redirects=False)

    conn = sqlite3.connect(database.DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM users WHERE github_id = '88802'")
    initial_user_id = cursor.fetchone()[0]
    cursor.execute("UPDATE player_profile SET total_nxp = 150 WHERE user_id = ?", (initial_user_id,))
    conn.commit()
    conn.close()

    # Second login with updated name/token
    login_res_2 = client.get("/auth/github/login")
    state_2 = login_res_2.json()["url"].split("state=")[-1]

    mock_token_resp_2 = _create_mock_response(200, {"access_token": "token_second"})
    mock_user_resp_2 = _create_mock_response(200, {
        "id": 88802,
        "login": "veteran_cadet",
        "name": "Veteran Cadet Promoted",
        "avatar_url": "https://avatars.githubusercontent.com/u/88802",
        "email": "vet@nexus.ai"
    })

    with patch("httpx.AsyncClient.post", return_value=mock_token_resp_2), \
         patch("httpx.AsyncClient.get", return_value=mock_user_resp_2):
        client.get(f"/auth/github/callback?code=code_2&state={state_2}", follow_redirects=False)

    conn = sqlite3.connect(database.DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users WHERE github_id = '88802'")
    users = cursor.fetchall()
    assert len(users) == 1
    assert users[0]["id"] == initial_user_id
    assert users[0]["full_name"] == "Veteran Cadet Promoted"

    # Profile stats preserved
    cursor.execute("SELECT total_nxp FROM player_profile WHERE user_id = ?", (initial_user_id,))
    profile_nxp = cursor.fetchone()[0]
    assert profile_nxp == 150
    conn.close()

def test_me_requires_token():
    res = client.get("/me")
    assert res.status_code == 401

    res = client.get("/me", headers={"Authorization": "Bearer invalid_token_123"})
    assert res.status_code == 401

def test_github_token_never_appears_in_response():
    login_res = client.get("/auth/github/login")
    state = login_res.json()["url"].split("state=")[-1]

    raw_gh_token = "ghp_super_secret_unique_raw_token_xyz"

    mock_token_resp = _create_mock_response(200, {"access_token": raw_gh_token})
    mock_user_resp = _create_mock_response(200, {
        "id": 77703,
        "login": "secret_checker",
        "name": "Secret Checker",
        "avatar_url": "https://avatars.githubusercontent.com/u/77703",
        "email": "checker@nexus.ai"
    })

    with patch("httpx.AsyncClient.post", return_value=mock_token_resp), \
         patch("httpx.AsyncClient.get", return_value=mock_user_resp):
        res_callback = client.get(f"/auth/github/callback?code=code_3&state={state}", follow_redirects=False)

    redirect_url = res_callback.headers["location"]
    # Token in URL fragment is the session token, NOT the GitHub token
    session_token = redirect_url.split("#token=")[-1]
    assert raw_gh_token not in redirect_url

    # Check /me endpoint
    me_res = client.get("/me", headers={"Authorization": f"Bearer {session_token}"})
    assert me_res.status_code == 200
    body_text = me_res.text
    assert raw_gh_token not in body_text
    assert "github_token" not in body_text
    assert "token_enc" not in body_text

def test_rate_limiter_blocks_after_20_requests():
    for _ in range(20):
        res = client.get("/auth/github/login")
        assert res.status_code == 200

    # 21st request should be blocked
    res_blocked = client.get("/auth/github/login")
    assert res_blocked.status_code == 429
    assert "Rate limit exceeded" in res_blocked.json()["detail"]
