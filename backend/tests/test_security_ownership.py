"""
test_security_ownership.py - Security Pass & Ownership Isolation Tests (Phase 10)

Validates:
1. Security headers middleware (X-Content-Type-Options, X-Frame-Options, Referrer-Policy)
2. 7-day session expiry & cleanup of expired sessions
3. Strict ownership isolation: Cadet A cannot read/modify Cadet B's attempts, ledger, history, chat, or projects
4. Upload, code, and prompt input size limits
5. /dev/unlock-chamber/{n} backdoor is 404 when DEMO_MODE is false
"""

import pytest
import sqlite3
import time
from datetime import datetime, timedelta
from unittest.mock import patch
from fastapi.testclient import TestClient

import main
import database

client = TestClient(main.app)

@pytest.fixture(autouse=True)
def clean_db():
    import auth_github
    auth_github._ip_request_timestamps.clear()
    database.init_db()
    conn = sqlite3.connect(database.DB_PATH, timeout=30.0)
    cursor = conn.cursor()
    cursor.execute("DELETE FROM sessions")
    cursor.execute("DELETE FROM users")
    cursor.execute("DELETE FROM player_profile")
    cursor.execute("DELETE FROM chamber_state")
    cursor.execute("DELETE FROM chamber_attempts")
    cursor.execute("DELETE FROM nxp_ledger")
    cursor.execute("DELETE FROM matrix_history")
    cursor.execute("DELETE FROM chat_sessions")
    cursor.execute("DELETE FROM chat_messages")
    cursor.execute("DELETE FROM projects")
    cursor.execute("DELETE FROM profiles")
    conn.commit()
    conn.close()

def _create_test_user(github_id: str, username: str):
    conn = sqlite3.connect(database.DB_PATH, timeout=30.0)
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO users (github_id, github_username, full_name, email)
        VALUES (?, ?, ?, ?)
    """, (github_id, username, f"Cadet {username}", f"{username}@nexus.ai"))
    user_id = cursor.lastrowid

    cursor.execute("""
        INSERT INTO player_profile (user_id, current_chamber, total_nxp, dsa_score, system_design_score, cleanliness_score)
        VALUES (?, 1, 100, 60, 60, 60)
    """, (user_id,))

    expires_at = (datetime.now() + timedelta(days=7)).isoformat()
    token = f"token_{username}"
    cursor.execute("INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)", (token, user_id, expires_at))
    conn.commit()
    conn.close()
    return user_id, token

def test_security_headers_present_on_all_responses():
    res = client.get("/auth/github/login")
    assert res.headers.get("x-content-type-options") == "nosniff"
    assert res.headers.get("x-frame-options") == "DENY"
    assert res.headers.get("referrer-policy") == "strict-origin-when-cross-origin"

def test_sessions_expire_after_7_days_and_cleaned_up():
    user_id, token = _create_test_user("test_exp", "exp_cadet")
    
    # 1. Valid session succeeds
    res_valid = client.get("/me", headers={"Authorization": f"Bearer {token}"})
    assert res_valid.status_code == 200

    # 2. Backdate session to 8 days ago
    conn = sqlite3.connect(database.DB_PATH, timeout=30.0)
    cursor = conn.cursor()
    past_date = (datetime.now() - timedelta(days=8)).isoformat()
    cursor.execute("UPDATE sessions SET expires_at = ? WHERE token = ?", (past_date, token))
    conn.commit()
    conn.close()

    # 3. Expired session is rejected with 401
    res_expired = client.get("/me", headers={"Authorization": f"Bearer {token}"})
    assert res_expired.status_code == 401

    # 4. Cleanup function purges expired sessions
    # Insert another expired session
    conn = sqlite3.connect(database.DB_PATH, timeout=30.0)
    cursor = conn.cursor()
    cursor.execute("INSERT INTO sessions (token, user_id, expires_at) VALUES ('tok_old', ?, ?)", (user_id, past_date))
    conn.commit()
    conn.close()

    deleted_count = database.cleanup_expired_sessions()
    assert deleted_count >= 1

    conn = sqlite3.connect(database.DB_PATH, timeout=30.0)
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM sessions WHERE token = 'tok_old'")
    assert cursor.fetchone() is None
    conn.close()

def test_cadet_cannot_read_or_delete_other_cadet_chat_sessions():
    _, token_a = _create_test_user("user_a", "cadet_a")
    _, token_b = _create_test_user("user_b", "cadet_b")

    headers_a = {"Authorization": f"Bearer {token_a}"}
    headers_b = {"Authorization": f"Bearer {token_b}"}

    # Cadet A creates a chat session
    new_chat_res = client.post("/chat/new", headers=headers_a)
    assert new_chat_res.status_code == 200
    session_id = new_chat_res.json()["session_id"]

    # Cadet B attempts to read Cadet A's chat session history -> 403 Forbidden
    res_b_read = client.get(f"/chat/history/{session_id}", headers=headers_b)
    assert res_b_read.status_code == 403

    # Cadet B attempts to delete Cadet A's chat session -> 403 Forbidden
    res_b_delete = client.delete(f"/chat/sessions/{session_id}", headers=headers_b)
    assert res_b_delete.status_code == 403

    # Cadet A can successfully read their own chat session
    res_a_read = client.get(f"/chat/history/{session_id}", headers=headers_a)
    assert res_a_read.status_code == 200

def test_cadet_cannot_access_other_cadet_projects():
    user_a, token_a = _create_test_user("proj_a", "cadet_proj_a")
    user_b, token_b = _create_test_user("proj_b", "cadet_proj_b")

    headers_a = {"Authorization": f"Bearer {token_a}"}
    headers_b = {"Authorization": f"Bearer {token_b}"}

    # Create project owned by Cadet A
    proj_a = {
        "id": "proj_secret_1",
        "title": "Private Microservice",
        "tech_stack": "Python, Docker",
        "description": "Proprietary code",
        "current_phase": 1,
        "total_phases": 6,
        "phases": [],
        "started_at": datetime.now().isoformat()
    }
    database.save_project_globally(proj_a, user_a)

    # Cadet A can access project
    res_a = client.get("/project/proj_secret_1", headers=headers_a)
    assert res_a.status_code == 200

    # Cadet B cannot access Cadet A's project -> 404
    res_b = client.get("/project/proj_secret_1", headers=headers_b)
    assert res_b.status_code == 404

    # Cadet B cannot delete Cadet A's project -> 404
    res_b_del = client.delete("/project/proj_secret_1", headers=headers_b)
    assert res_b_del.status_code == 404

def test_cadet_matrix_and_nxp_ledger_are_strictly_isolated():
    user_a, token_a = _create_test_user("iso_a", "cadet_iso_a")
    user_b, token_b = _create_test_user("iso_b", "cadet_iso_b")

    headers_a = {"Authorization": f"Bearer {token_a}"}
    headers_b = {"Authorization": f"Bearer {token_b}"}

    # Insert ledger row for Cadet A only
    conn = sqlite3.connect(database.DB_PATH, timeout=30.0)
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO nxp_ledger (user_id, chamber_no, points, streak_after, reason)
        VALUES (?, 1, 250, 1, 'Chamber 1 clearance')
    """, (user_a,))
    cursor.execute("""
        INSERT INTO matrix_history (user_id, dsa, system_design, cleanliness, total_nxp)
        VALUES (?, 75, 70, 80, 250)
    """, (user_a,))
    conn.commit()
    conn.close()

    # Cadet A sees their ledger and history
    a_ledger = client.get("/profile/nxp-ledger", headers=headers_a).json()
    assert len(a_ledger.get("items", [])) == 1

    a_history = client.get("/profile/matrix/history", headers=headers_a).json()
    assert len(a_history.get("items", [])) == 1

    # Cadet B sees empty ledger and history
    b_ledger = client.get("/profile/nxp-ledger", headers=headers_b).json()
    assert len(b_ledger.get("items", [])) == 0

    b_history = client.get("/profile/matrix/history", headers=headers_b).json()
    assert len(b_history.get("items", [])) == 0

def test_dev_unlock_chamber_disabled_when_demo_mode_false():
    _, token = _create_test_user("dev_u", "cadet_dev")
    headers = {"Authorization": f"Bearer {token}"}

    with patch("main.DEMO_MODE", False):
        res = client.post("/dev/unlock-chamber/3", headers=headers)
        assert res.status_code == 404
        assert "Dev backdoor is disabled" in res.json()["detail"]

def test_dev_unlock_chamber_enabled_when_demo_mode_true():
    user_id, token = _create_test_user("dev_demo_u", "cadet_demo_dev")
    headers = {"Authorization": f"Bearer {token}"}

    with patch("main.DEMO_MODE", True):
        res = client.post("/dev/unlock-chamber/3", headers=headers)
        assert res.status_code == 200
        assert res.json()["status"] == "unlocked"
        assert res.json()["chamber_no"] == 3

    # Verify state in database
    conn = sqlite3.connect(database.DB_PATH, timeout=30.0)
    cursor = conn.cursor()
    cursor.execute("SELECT state FROM chamber_state WHERE user_id = ? AND chamber_no = 3", (user_id,))
    assert cursor.fetchone()[0] == "UNLOCKED"
    conn.close()

def test_input_size_limits_enforced():
    _, token = _create_test_user("size_u", "cadet_size")
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Code > 20 KB rejected on submission
    huge_code = "x = 1\n" * 4000  # ~24 KB
    res_code = client.post("/chambers/1/submit", json={"code": huge_code, "language": "python"}, headers=headers)
    assert res_code.status_code == 400
    assert "20 KB" in res_code.json()["detail"]

    # 2. Design response > 2,000 chars rejected on finale design
    # Setup finale state in round 3
    conn = sqlite3.connect(database.DB_PATH, timeout=30.0)
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM users WHERE github_username = 'cadet_size'")
    uid = cursor.fetchone()[0]
    cursor.execute("""
        INSERT INTO finale_state (user_id, round, state)
        VALUES (?, 3, 'ACTIVE')
    """, (uid,))
    conn.commit()
    conn.close()

    huge_design = "A" * 2050
    res_design = client.post("/finale/design/submit", json={"answer": huge_design}, headers=headers)
    assert res_design.status_code == 400
    assert "2,000" in res_design.json()["detail"]
