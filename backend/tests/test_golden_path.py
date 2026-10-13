"""
test_golden_path.py - End-to-End API Test of Golden Path (Phase 10)

Tests complete user journey with mocked Judge0, LLM, and GitHub:
1. OAuth Login -> Session Token issued
2. Resume Upload -> Skill Tree & Schedule generated
3. Enter Chamber 1 -> ACTIVE State & Challenge received
4. Submit Passing Solution -> Evaluation Pipeline runs
5. Progress Event Verified -> State PASSED, NXP Ledger written, Matrix updated
"""

import pytest
import sqlite3
import json
import io
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient

import main
import database
import chamber_engine

client = TestClient(main.app)

@pytest.fixture(autouse=True)
def clean_db():
    import auth_github
    auth_github._ip_request_timestamps.clear()
    database.init_db()
    conn = sqlite3.connect(database.DB_PATH, timeout=30.0)
    cursor = conn.cursor()
    cursor.execute("DELETE FROM oauth_states")
    cursor.execute("DELETE FROM sessions")
    cursor.execute("DELETE FROM users")
    cursor.execute("DELETE FROM player_profile")
    cursor.execute("DELETE FROM chamber_state")
    cursor.execute("DELETE FROM chamber_attempts")
    cursor.execute("DELETE FROM nxp_ledger")
    cursor.execute("DELETE FROM matrix_history")
    conn.commit()
    conn.close()

def _create_mock_response(status_code: int, json_data: dict):
    resp = MagicMock()
    resp.status_code = status_code
    resp.json.return_value = json_data
    return resp

def test_golden_path_end_to_end():
    # -------------------------------------------------------------
    # 1. AUTHENTICATION: GitHub OAuth Mock Flow
    # -------------------------------------------------------------
    login_res = client.get("/auth/github/login")
    assert login_res.status_code == 200
    state = login_res.json()["url"].split("state=")[-1]

    mock_token_resp = _create_mock_response(200, {"access_token": "gho_golden_cadet_token"})
    mock_user_resp = _create_mock_response(200, {
        "id": 99001,
        "login": "golden_cadet",
        "name": "Golden Cadet",
        "avatar_url": "https://avatars.githubusercontent.com/u/99001",
        "email": "gold@nexus.ai"
    })

    with patch("httpx.AsyncClient.post", return_value=mock_token_resp), \
         patch("httpx.AsyncClient.get", return_value=mock_user_resp):
        cb_res = client.get(f"/auth/github/callback?code=gold_code&state={state}", follow_redirects=False)

    assert cb_res.status_code == 302
    token = cb_res.headers["location"].split("#token=")[-1]
    auth_headers = {"Authorization": f"Bearer {token}"}

    # Verify Profile Initial State
    me_res = client.get("/me", headers=auth_headers)
    assert me_res.status_code == 200
    user_id = me_res.json()["id"]
    assert me_res.json()["github_username"] == "golden_cadet"
    assert me_res.json()["current_chamber"] == 1

    # -------------------------------------------------------------
    # 2. RESUME UPLOAD: /resume/analyze with Mocked LLM
    # -------------------------------------------------------------
    mock_llm_intel = {
        "target_role": "Backend Specialist",
        "matrix": {"dsa": 60, "system_design": 55, "cleanliness": 60},
        "skill_tree": [
            {"category": "Algorithms", "skills": [{"name": "Two Pointers", "level": "proficient"}]},
            {"category": "Systems", "skills": [{"name": "APIs", "level": "proficient"}]}
        ],
        "weaknesses": [
            {"name": "Dynamic Programming", "reason": "Requires training"}
        ]
    }

    mock_completion = MagicMock()
    mock_completion.choices = [MagicMock(message=MagicMock(content=json.dumps(mock_llm_intel)))]
    mock_llm_client = MagicMock()
    mock_llm_client.chat.completions.create.return_value = mock_completion

    pdf_bytes = (
        b"%PDF-1.4\n"
        b"1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n"
        b"2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n"
        b"3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >> endobj\n"
        b"4 0 obj << /Length 55 >> stream\n"
        b"BT /F1 12 Tf 72 712 Td (Software Engineer with Python, React, and SQL) Tj ET\n"
        b"endstream endobj\n"
        b"xref\n0 5\n0000000000 65535 f \n0000000010 00000 n \n0000000060 00000 n \n0000000117 00000 n \n0000000212 00000 n \n"
        b"trailer << /Size 5 /Root 1 0 R >>\nstartxref\n318\n%%EOF\n"
    )

    with patch("llm.get_client", return_value=mock_llm_client):
        analyze_res = client.post(
            "/resume/analyze",
            files={"file": ("resume.pdf", pdf_bytes, "application/pdf")},
            data={"target_role": "Backend Specialist"},
            headers=auth_headers
        )

    assert analyze_res.status_code == 200
    analysis_data = analyze_res.json()
    assert "matrix" in analysis_data
    assert "schedule" in analysis_data
    assert len(analysis_data["schedule"]) == 30

    # -------------------------------------------------------------
    # 3. ENTER CHAMBER 1: /chambers/1/enter
    # -------------------------------------------------------------
    enter_res = client.post("/chambers/1/enter", headers=auth_headers)
    assert enter_res.status_code == 200
    ch_info = enter_res.json()
    assert ch_info["chamber_no"] == 1
    assert ch_info["state"] == "ACTIVE"
    assert ch_info["deadline_at"] is not None
    assert "hidden_tests" not in str(ch_info)

    # -------------------------------------------------------------
    # 4. SUBMIT PASSING SOLUTION: /chambers/1/submit with Mocked Judge0
    # -------------------------------------------------------------
    passing_code = """
def max_containment(height: list[int]) -> int:
    left, right = 0, len(height) - 1
    max_area = 0
    while left < right:
        area = min(height[left], height[right]) * (right - left)
        if area > max_area:
            max_area = area
        if height[left] < height[right]:
            left += 1
        else:
            right -= 1
    return max_area
"""

    # Mock Judge0 to return passing results for the two hidden tests of Chamber 1
    mock_judge_results = [
        {"token": "tok1", "status_id": 3, "status": "passed", "time_ms": 11, "memory_kb": 12000, "stdout": "__NEXUS_EVAL__:{\"result\": 2}", "stderr": "", "error_message": ""},
        {"token": "tok2", "status_id": 3, "status": "passed", "time_ms": 15, "memory_kb": 12000, "stdout": "__NEXUS_EVAL__:{\"result\": 16}", "stderr": "", "error_message": ""}
    ]

    with patch("judge0.execute_batch", return_value=mock_judge_results), \
         patch("nexus_ai.generate_taunt", return_value="NEXUS acknowledges algorithm clearance."):
        submit_res = client.post(
            "/chambers/1/submit",
            json={"code": passing_code, "language": "python"},
            headers=auth_headers
        )
        assert submit_res.status_code == 202
        assert submit_res.json()["state"] == "EVALUATING"

    # -------------------------------------------------------------
    # 5. VERIFY PROGRESS EVENT & STATE: PASSED, NXP Awarded, Matrix Updated
    # -------------------------------------------------------------
    current_ch = client.get("/chambers/1/current", headers=auth_headers)
    assert current_ch.status_code == 200
    assert current_ch.json()["state"] == "PASSED"

    # Verify NXP Ledger row created
    ledger_res = client.get("/profile/nxp-ledger", headers=auth_headers)
    assert ledger_res.status_code == 200
    ledger_items = ledger_res.json().get("items", [])
    assert len(ledger_items) == 1
    assert ledger_items[0]["chamber_no"] == 1
    assert ledger_items[0]["points"] > 0
    assert ledger_items[0]["streak_after"] == 1

    # Verify Matrix History row created
    history_res = client.get("/profile/matrix/history", headers=auth_headers)
    assert history_res.status_code == 200
    history_items = history_res.json().get("items", [])
    assert len(history_items) == 1
    assert history_items[0]["total_nxp"] == ledger_items[0]["points"]

    # Verify Chamber 2 is now UNLOCKED
    chambers_overview = client.get("/chambers", headers=auth_headers)
    assert chambers_overview.status_code == 200
    ch_list = chambers_overview.json()
    assert ch_list[0]["state"] == "PASSED"
    assert ch_list[1]["state"] == "UNLOCKED"
