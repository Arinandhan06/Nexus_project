import pytest
import sqlite3
import json
import secrets
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient

import database
import finale
from main import app
from chamber_engine import ChamberState

client = TestClient(app)


def create_mock_cadet(username: str = "cadet_finale_user"):
    unique_user = f"{username}_{secrets.token_hex(4)}"
    conn = sqlite3.connect(database.DB_PATH)
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO users (github_id, github_username, full_name, avatar_url)
        VALUES (?, ?, ?, ?)
    """, (f"id_{unique_user}", unique_user, "Finale Cadet", "http://example.com/avatar.png"))
    user_id = cursor.lastrowid

    cursor.execute("""
        INSERT INTO player_profile (user_id, total_nxp, current_streak, best_streak, current_chamber, dsa_score, system_design_score, cleanliness_score)
        VALUES (?, 200, 3, 3, 6, 50, 40, 70)
    """, (user_id,))

    conn.commit()
    conn.close()
    return user_id


def set_user_chamber_pass_states(user_id: int, chambers: list[int]):
    conn = sqlite3.connect(database.DB_PATH)
    cursor = conn.cursor()
    cursor.execute("DELETE FROM chamber_state WHERE user_id = ?", (user_id,))
    for c in chambers:
        cursor.execute("""
            INSERT INTO chamber_state (user_id, chamber_no, state)
            VALUES (?, ?, 'PASSED')
        """, (user_id, c))
    conn.commit()
    conn.close()


def make_auth_headers(user_id: int):
    token = f"token_finale_{user_id}_{secrets.token_hex(4)}"
    database.create_session(user_id, token)
    return {"Authorization": f"Bearer {token}"}


def test_chamber_6_returns_409_until_1_to_5_passed():
    """Verify POST /finale/start returns 409 Conflict until all chambers 1-5 are PASSED."""
    uid = create_mock_cadet("cadet_lock_check")
    headers = make_auth_headers(uid)

    # 1. No chambers passed -> 409
    set_user_chamber_pass_states(uid, [])
    res = client.post("/finale/start", headers=headers)
    assert res.status_code == 409
    assert "Chambers 1-5 must all be PASSED" in res.json()["detail"]

    # 2. Only chambers 1, 2, 3, 4 passed (missing 5) -> 409
    set_user_chamber_pass_states(uid, [1, 2, 3, 4])
    res2 = client.post("/finale/start", headers=headers)
    assert res2.status_code == 409

    # 3. All chambers 1-5 passed -> 200 OK
    set_user_chamber_pass_states(uid, [1, 2, 3, 4, 5])
    res3 = client.post("/finale/start", headers=headers)
    assert res3.status_code == 200
    data = res3.json()
    assert data["round"] == 1
    assert data["state"] == "ACTIVE"


def test_quiz_deterministic_scoring():
    """Verify complexity quiz scoring is 20 pts per question, exact and deterministic without LLM."""
    questions = finale.load_quiz_questions(strip_answers=False)
    assert len(questions) == 5

    # All correct -> 100
    all_correct = {q["id"]: q["correct_answer"] for q in questions}
    res_100 = finale.score_quiz(all_correct)
    assert res_100["score"] == 100
    assert res_100["correct_count"] == 5

    # 3 correct, 2 wrong -> 60
    partial = {
        questions[0]["id"]: questions[0]["correct_answer"],
        questions[1]["id"]: questions[1]["correct_answer"],
        questions[2]["id"]: questions[2]["correct_answer"],
        questions[3]["id"]: "WRONG_ANSWER",
        questions[4]["id"]: "WRONG_ANSWER"
    }
    res_60 = finale.score_quiz(partial)
    assert res_60["score"] == 60
    assert res_60["correct_count"] == 3

    # All wrong -> 0
    all_wrong = {q["id"]: "WRONG" for q in questions}
    res_0 = finale.score_quiz(all_wrong)
    assert res_0["score"] == 0
    assert res_0["correct_count"] == 0


def test_score_weighting_and_pass_threshold():
    """
    Verify overall finale scoring:
    - 50% coding, 20% quiz, 30% design
    - Passing requires coding PASSED and overall score >= 60
    """
    # Case 1: Coding failed -> passed is False even if quiz and design are 100
    calc1 = finale.calculate_overall_finale_score(coding_passed=False, quiz_score=100, design_score=100)
    # 0.5*0 + 0.2*100 + 0.3*100 = 50
    assert calc1["overall_score"] == 50
    assert calc1["passed"] is False

    # Case 2: Coding passed, quiz 60, design 70
    # 0.5*100 + 0.2*60 + 0.3*70 = 50 + 12 + 21 = 83 >= 60 -> passed True
    calc2 = finale.calculate_overall_finale_score(coding_passed=True, quiz_score=60, design_score=70)
    assert calc2["overall_score"] == 83
    assert calc2["passed"] is True

    # Case 3: Coding passed, quiz 20, design 20
    # 0.5*100 + 0.2*20 + 0.3*20 = 50 + 4 + 6 = 60 -> passed True (exact boundary)
    calc3 = finale.calculate_overall_finale_score(coding_passed=True, quiz_score=20, design_score=20)
    assert calc3["overall_score"] == 60
    assert calc3["passed"] is True

    # Case 4: Coding passed, quiz 20, design 15
    # 0.5*100 + 0.2*20 + 0.3*15 = 50 + 4 + 4.5 = 58.5 -> round = 59 < 60 -> passed False
    calc4 = finale.calculate_overall_finale_score(coding_passed=True, quiz_score=20, design_score=15)
    assert calc4["overall_score"] in (58, 59)
    assert calc4["passed"] is False


def test_system_design_unscored_fallback():
    """Verify that if LLM raises or fails, the round is marked 'unscored' with neutral 50."""
    with patch("finale.get_client", side_effect=Exception("LLM Connection Timeout")):
        eval_res = finale.evaluate_system_design("Some system design proposal")
        assert eval_res["status"] == "unscored"
        assert eval_res["total"] == 50
        assert len(eval_res["criteria"]) == 5
        for c in eval_res["criteria"]:
            assert c["score"] == 10


def test_answers_and_hidden_tests_never_leave_server():
    """Verify quiz correct_answers and challenge hidden_tests never leak in API responses."""
    uid = create_mock_cadet("cadet_privacy_check")
    headers = make_auth_headers(uid)
    set_user_chamber_pass_states(uid, [1, 2, 3, 4, 5])

    # 1. Round 1 state -> challenge must NOT contain hidden_tests
    client.post("/finale/start", headers=headers)
    st1 = client.get("/finale/state", headers=headers).json()
    assert "content" in st1
    challenge = st1["content"].get("challenge", {})
    assert "hidden_tests" not in challenge
    assert "public_examples" in challenge

    # 2. Check quiz questions endpoint via state in round 2
    # Advance to round 2
    conn = sqlite3.connect(database.DB_PATH)
    cursor = conn.cursor()
    cursor.execute("UPDATE finale_state SET round = 2 WHERE user_id = ?", (uid,))
    conn.commit()
    conn.close()

    st2 = client.get("/finale/state", headers=headers).json()
    questions = st2["content"].get("questions", [])
    assert len(questions) == 5
    for q in questions:
        assert "correct_answer" not in q
        assert "options" in q
        assert "code_snippet" in q


def test_nxp_bonus_is_awarded_once():
    """Verify the +1000 NXP bonus and +15 system_design gain are awarded exactly once."""
    uid = create_mock_cadet("cadet_bonus_idempotency")
    initial_profile = database.get_player_profile(uid)
    base_nxp = initial_profile["total_nxp"]
    base_sd = initial_profile["system_design_score"]

    # First award
    res1 = database.commit_finale_award(uid)
    assert res1["awarded"] is True
    assert res1["nxp_awarded"] == 1000
    assert res1["total_nxp"] == base_nxp + 1000
    assert res1["matrix"]["system_design"] == min(100, base_sd + 15)

    # Second award attempt -> 0 points, already_awarded: True
    res2 = database.commit_finale_award(uid)
    assert res2["awarded"] is False
    assert res2["already_awarded"] is True
    assert res2["nxp_awarded"] == 0
    assert res2["total_nxp"] == base_nxp + 1000

    # Verify ledger has exactly 1 row for reason='finale'
    conn = sqlite3.connect(database.DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) FROM nxp_ledger WHERE user_id = ? AND chamber_no = 6 AND reason = 'finale'", (uid,))
    count = cursor.fetchone()[0]
    conn.close()
    assert count == 1


def test_end_to_end_finale_three_rounds():
    """Full three-round interview flow from start to results."""
    uid = create_mock_cadet("cadet_e2e_finale")
    headers = make_auth_headers(uid)
    set_user_chamber_pass_states(uid, [1, 2, 3, 4, 5])

    # 1. Start finale -> round 1
    start_res = client.post("/finale/start", headers=headers)
    assert start_res.status_code == 200
    assert start_res.json()["round"] == 1

    # 2. Submit coding solution for Chamber 6 (trapping coolant)
    valid_code = """
def trap_coolant(height: list[int]) -> int:
    if not height:
        return 0
    left, right = 0, len(height) - 1
    left_max, right_max = 0, 0
    trapped = 0
    while left < right:
        if height[left] < height[right]:
            if height[left] >= left_max:
                left_max = height[left]
            else:
                trapped += left_max - height[left]
            left += 1
        else:
            if height[right] >= right_max:
                right_max = height[right]
            else:
                trapped += right_max - height[right]
            right -= 1
    return trapped
"""
    mock_eval_res = {
        "all_passed": True,
        "total_time_ms": 15,
        "complexity": "O(n)",
        "expected_complexity": "O(n)",
        "inefficient": False,
        "cleanliness": 95,
        "findings": [],
        "tests": [
            {"id": 1, "status": "passed", "time_ms": 5},
            {"id": 2, "status": "passed", "time_ms": 5},
            {"id": 3, "status": "passed", "time_ms": 5}
        ]
    }
    with patch("chamber_engine.evaluate_code", return_value=mock_eval_res):
        code_res = client.post("/finale/coding/submit", headers=headers, json={"code": valid_code, "language": "python"})
        assert code_res.status_code == 200
        assert code_res.json()["passed"] is True
        assert code_res.json()["round"] == 2

    # 3. Submit quiz answers for Round 2
    questions = finale.load_quiz_questions(strip_answers=False)
    answers = {q["id"]: q["correct_answer"] for q in questions}
    quiz_res = client.post("/finale/quiz/submit", headers=headers, json={"answers": answers})
    assert quiz_res.status_code == 200
    assert quiz_res.json()["round"] == 3
    assert quiz_res.json()["quiz"]["score"] == 100

    # 4. Submit system design for Round 3 (mock LLM evaluation to return high scores)
    mock_llm_eval = {
        "choices": [
            {
                "message": {
                    "content": json.dumps({
                        "criteria": [
                            {"name": "requirements", "score": 18, "comment": "Thorough requirements"},
                            {"name": "data_model", "score": 18, "comment": "Redis hash structure"},
                            {"name": "scaling", "score": 18, "comment": "Distributed sliding window"},
                            {"name": "trade_offs", "score": 18, "comment": "Clear memory vs sync trade-offs"},
                            {"name": "failure_handling", "score": 18, "comment": "Graceful edge degradation"}
                        ],
                        "total": 90
                    })
                }
            }
        ]
    }

    mock_client = MagicMock()
    mock_client.chat.completions.create.return_value = MagicMock(**mock_llm_eval)

    with patch("finale.get_client", return_value=mock_client):
        design_res = client.post("/finale/design/submit", headers=headers, json={
            "answer": "We design a distributed rate limiter using Redis sliding window log with local memory fallback."
        })
        assert design_res.status_code == 200
        design_data = design_res.json()
        assert design_data["state"] == "COMPLETED"
        assert design_data["overall"]["passed"] is True
        assert design_data["award"]["awarded"] is True
        assert design_data["award"]["nxp_awarded"] == 1000

    # 5. Check GET /finale/results
    results_res = client.get("/finale/results", headers=headers)
    assert results_res.status_code == 200
    res_data = results_res.json()
    assert res_data["state"] == "COMPLETED"
    assert res_data["scores"]["coding"]["passed"] is True
    assert res_data["scores"]["quiz"]["score"] == 100
    assert res_data["scores"]["overall"]["passed"] is True
