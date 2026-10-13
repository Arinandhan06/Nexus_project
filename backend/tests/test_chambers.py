import pytest
import time
import secrets
from datetime import datetime, timedelta
from fastapi.testclient import TestClient
import database
import chamber_engine
from chamber_engine import ChamberState, InvalidChamberTransitionError, TRANSITION_TABLE
import ws
from main import app

client = TestClient(app)

def get_auth_token(user_id=None, username="test_cadet"):
    uid_suffix = secrets.token_hex(6)
    unique_github_id = f"test_{user_id}_{uid_suffix}" if user_id is not None else f"cadet_{uid_suffix}"
    token = f"test_token_chamber_{uid_suffix}"
    user = database.upsert_github_user(
        github_id=unique_github_id,
        github_username=f"{username}_{uid_suffix}",
        avatar_url="https://github.com/avatar.png",
        github_token_enc="enc_token",
        email=f"{username}_{uid_suffix}@nexus.test",
        display_name=username
    )
    database.create_session(user["id"], token)
    return token, user["id"]

def test_transition_table_legal_and_illegal_transitions():
    # Test all defined legal transitions
    legal_pairs = [
        (ChamberState.LOCKED, ChamberState.UNLOCKED),
        (ChamberState.UNLOCKED, ChamberState.PREPARING),
        (ChamberState.UNLOCKED, ChamberState.ACTIVE),
        (ChamberState.PREPARING, ChamberState.ACTIVE),
        (ChamberState.ACTIVE, ChamberState.EVALUATING),
        (ChamberState.EVALUATING, ChamberState.PASSED),
        (ChamberState.EVALUATING, ChamberState.FAILED),
        (ChamberState.FAILED, ChamberState.ACTIVE),
        (ChamberState.PASSED, ChamberState.COMPLETED),
    ]

    for curr, target in legal_pairs:
        assert chamber_engine.validate_transition(curr, target) is True

    # Test illegal transitions
    illegal_pairs = [
        (ChamberState.LOCKED, ChamberState.ACTIVE),
        (ChamberState.LOCKED, ChamberState.PREPARING),
        (ChamberState.LOCKED, ChamberState.PASSED),
        (ChamberState.ACTIVE, ChamberState.PASSED),
        (ChamberState.ACTIVE, ChamberState.FAILED),
        (ChamberState.EVALUATING, ChamberState.ACTIVE),
        (ChamberState.COMPLETED, ChamberState.ACTIVE),
        (ChamberState.COMPLETED, ChamberState.UNLOCKED),
    ]

    for curr, target in illegal_pairs:
        with pytest.raises(InvalidChamberTransitionError):
            chamber_engine.validate_transition(curr, target)

def test_chamber_2_stays_locked_until_chamber_1_is_passed():
    token, user_id = get_auth_token(user_id=202, username="cadet_202")

    # Clear previous states
    conn = database.sqlite3.connect(database.DB_PATH, timeout=30.0)
    cursor = conn.cursor()
    cursor.execute("DELETE FROM chamber_state WHERE user_id = ?", (user_id,))
    conn.commit()
    conn.close()

    # Chamber 1 should initialize UNLOCKED, Chamber 2 should initialize LOCKED
    ch1 = chamber_engine.get_or_init_user_chamber_state(user_id, 1)
    ch2 = chamber_engine.get_or_init_user_chamber_state(user_id, 2)
    assert ch1["state"] == ChamberState.UNLOCKED
    assert ch2["state"] == ChamberState.LOCKED

    # Entering Chamber 2 while LOCKED should fail
    with pytest.raises(ValueError) as exc:
        chamber_engine.enter_chamber(user_id, 2)
    assert "Cannot enter Chamber 2 from state 'LOCKED'" in str(exc.value)

    # Progress Chamber 1: UNLOCKED -> ACTIVE -> EVALUATING -> PASSED
    chamber_engine.set_chamber_state(user_id, 1, ChamberState.ACTIVE)
    chamber_engine.set_chamber_state(user_id, 1, ChamberState.EVALUATING)

    # Still LOCKED while EVALUATING
    ch2_mid = chamber_engine.get_or_init_user_chamber_state(user_id, 2)
    assert ch2_mid["state"] == ChamberState.LOCKED

    # Now mark Chamber 1 as PASSED
    chamber_engine.set_chamber_state(user_id, 1, ChamberState.PASSED)

    # Chamber 2 should now be UNLOCKED
    ch2_after = chamber_engine.get_or_init_user_chamber_state(user_id, 2)
    assert ch2_after["state"] == ChamberState.UNLOCKED

    # Now Chamber 2 can be entered
    enter_res = chamber_engine.enter_chamber(user_id, 2)
    assert enter_res["state"] == ChamberState.ACTIVE

def test_hidden_tests_never_appear_in_any_response():
    token, user_id = get_auth_token(user_id=303, username="cadet_303")
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Check enter response
    res_enter = client.post("/chambers/1/enter", headers=headers)
    assert res_enter.status_code == 200
    data_enter = res_enter.json()
    raw_enter_str = res_enter.text

    assert "hidden_tests" not in raw_enter_str
    assert "expected_complexity" not in raw_enter_str
    assert "public_examples" in data_enter["challenge"]
    assert "statement" in data_enter["challenge"]

    # 2. Check GET /chambers/1/current
    res_curr = client.get("/chambers/1/current", headers=headers)
    assert res_curr.status_code == 200
    data_curr = res_curr.json()
    raw_curr_str = res_curr.text

    assert "hidden_tests" not in raw_curr_str
    assert "expected_complexity" not in raw_curr_str
    assert data_curr["challenge"] is not None

def test_submission_after_deadline_is_rejected():
    token, user_id = get_auth_token(user_id=404, username="cadet_404")
    headers = {"Authorization": f"Bearer {token}"}

    # Enter chamber 1
    client.post("/chambers/1/enter", headers=headers)

    # Mock deadline in the past: 10 seconds ago (beyond 5s grace)
    past_time = (datetime.utcnow() - timedelta(seconds=10)).isoformat()
    conn = database.sqlite3.connect(database.DB_PATH)
    conn.cursor().execute(
        "UPDATE chamber_state SET deadline_at = ? WHERE user_id = ? AND chamber_no = 1",
        (past_time, user_id)
    )
    conn.commit()
    conn.close()

    res = client.post("/chambers/1/submit", headers=headers, json={
        "code": "def solution(): pass",
        "language": "python"
    })
    assert res.status_code == 400
    assert "Submission deadline expired" in res.json()["detail"]

def test_second_submit_while_evaluating_is_rejected():
    token, user_id = get_auth_token(user_id=505, username="cadet_505")
    headers = {"Authorization": f"Bearer {token}"}

    # Chamber 1 is UNLOCKED by default, enter it directly
    enter_res = client.post("/chambers/1/enter", headers=headers)
    assert enter_res.status_code == 200

    # First submit -> moves to EVALUATING
    res1 = client.post("/chambers/1/submit", headers=headers, json={
        "code": "def solve(): return 42",
        "language": "python"
    })
    assert res1.status_code == 200
    assert res1.json()["status"] == "evaluation_pending"
    assert res1.json()["state"] == "EVALUATING"

    # Second submit while EVALUATING must be rejected
    res2 = client.post("/chambers/1/submit", headers=headers, json={
        "code": "def solve(): return 99",
        "language": "python"
    })
    assert res2.status_code == 400
    assert "A submission is already pending evaluation" in res2.json()["detail"]

def test_ticket_works_once_only_and_expires():
    token, user_id = get_auth_token(user_id=606, username="cadet_606")
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Obtain ticket
    res_ticket = client.post("/ws/ticket", headers=headers)
    assert res_ticket.status_code == 200
    ticket = res_ticket.json()["ticket"]
    assert len(ticket) > 20

    # 2. First validation consumes ticket and succeeds
    uid = ws.validate_and_consume_ticket(ticket)
    assert uid == user_id

    # 3. Second validation fails (single-use)
    uid_again = ws.validate_and_consume_ticket(ticket)
    assert uid_again is None

    # 4. Expired ticket fails
    expired_ticket = ws.create_ws_ticket(user_id, ttl_seconds=-1)
    assert ws.validate_and_consume_ticket(expired_ticket) is None
