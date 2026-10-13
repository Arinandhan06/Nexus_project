import pytest
import sqlite3
import threading
import secrets
import database
import nxp
import matrix
from main import app
from fastapi.testclient import TestClient

client = TestClient(app)

def create_test_user(username="nxp_cadet"):
    uid_suffix = secrets.token_hex(6)
    unique_github_id = f"test_{uid_suffix}"
    token = f"token_phase8_{uid_suffix}"
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


# ============================================================================
# 1. NXP FORMULA UNIT TESTS (SCRUM-26)
# ============================================================================

def test_nxp_formula_fail_yields_zero():
    """Verify that any failed chamber yields 0 points."""
    res = nxp.calculate_nxp(
        chamber_no=1,
        passed=False,
        inefficient=False,
        cleanliness=100,
        attempt_number=1,
        hint_level=0,
        streak_before=3
    )
    assert res["points"] == 0
    assert res["subtotal"] == 0.0


def test_nxp_formula_first_try_clean_pass():
    """
    Verify first-try clean pass on Chamber 1:
    - Base: 100
    - Efficiency bonus: +25% = 25
    - Cleanliness bonus (100): +25% = 25
    - First-try bonus: +20% = 20
    - Hint penalty (0): 0
    - Subtotal = 170
    - Streak before 0: multiplier = 1.0
    - Points = 170
    """
    res = nxp.calculate_nxp(
        chamber_no=1,
        passed=True,
        inefficient=False,
        cleanliness=100,
        attempt_number=1,
        hint_level=0,
        streak_before=0
    )
    assert res["base"] == 100
    assert res["efficiency_bonus"] == 25.0
    assert res["cleanliness_bonus"] == 25.0
    assert res["first_try_bonus"] == 20.0
    assert res["hint_penalty"] == 0.0
    assert res["subtotal"] == 170.0
    assert res["multiplier"] == 1.0
    assert res["points"] == 170


def test_nxp_formula_streak_cap_at_five():
    """
    Verify streak multiplier caps at 1.5 when streak_before >= 5.
    """
    # Streak = 5 -> multiplier = 1.5
    res5 = nxp.calculate_nxp(
        chamber_no=2,
        passed=True,
        inefficient=False,
        cleanliness=100,
        attempt_number=1,
        hint_level=0,
        streak_before=5
    )
    assert res5["multiplier"] == 1.5

    # Streak = 10 -> multiplier still 1.5
    res10 = nxp.calculate_nxp(
        chamber_no=2,
        passed=True,
        inefficient=False,
        cleanliness=100,
        attempt_number=1,
        hint_level=0,
        streak_before=10
    )
    assert res10["multiplier"] == 1.5
    assert res10["points"] == res5["points"]


def test_nxp_formula_hint_penalty_cap():
    """
    Verify hint penalty is 5% per hint level, capped at -15% (3 hints).
    On Chamber 1 (base 100):
    - 1 hint: -5 pts
    - 2 hints: -10 pts
    - 3 hints: -15 pts
    - 4 hints: still -15 pts (capped)
    """
    res1 = nxp.calculate_nxp(chamber_no=1, passed=True, hint_level=1, attempt_number=2, inefficient=True, cleanliness=0)
    assert res1["hint_penalty"] == 5.0

    res3 = nxp.calculate_nxp(chamber_no=1, passed=True, hint_level=3, attempt_number=2, inefficient=True, cleanliness=0)
    assert res3["hint_penalty"] == 15.0

    res5 = nxp.calculate_nxp(chamber_no=1, passed=True, hint_level=5, attempt_number=2, inefficient=True, cleanliness=0)
    assert res5["hint_penalty"] == 15.0


def test_streak_updates_and_resets():
    """Verify streak increments on pass and resets to 0 on fail."""
    # Pass 1
    curr, best = nxp.update_streak(current_streak=0, best_streak=0, passed=True)
    assert curr == 1 and best == 1

    # Pass 2
    curr, best = nxp.update_streak(current_streak=1, best_streak=1, passed=True)
    assert curr == 2 and best == 2

    # Fail resets to 0, retains best
    curr, best = nxp.update_streak(current_streak=2, best_streak=2, passed=False)
    assert curr == 0 and best == 2


# ============================================================================
# 2. MATRIX CALCULATION UNIT TESTS (SCRUM-27)
# ============================================================================

def test_matrix_clamping_and_weights():
    """Verify matrix calculation clamps strictly between 0 and 100."""
    initial = {"dsa": 95, "system_design": 96, "cleanliness": 98}
    res = matrix.calculate_matrix_update(
        current_matrix=initial,
        passed=True,
        inefficient=False,
        attempt_cleanliness_score=100,
        dsa_weight=0.8,
        system_design_gain=10
    )
    assert res["matrix"]["dsa"] == 100
    assert res["matrix"]["system_design"] == 100
    assert res["matrix"]["cleanliness"] == 99  # round(0.7*98 + 0.3*100) = 68.6 + 30 = 98.6 -> 99


def test_matrix_cleanliness_average_can_decrease():
    """Verify exponential moving average of cleanliness decreases when attempt cleanliness is low."""
    initial = {"dsa": 50, "system_design": 50, "cleanliness": 90}
    # Attempt cleanliness is 20
    res = matrix.calculate_matrix_update(
        current_matrix=initial,
        passed=True,
        inefficient=False,
        attempt_cleanliness_score=20,
        dsa_weight=0.7,
        system_design_gain=4
    )
    # Expected: round(0.7 * 90 + 0.3 * 20) = round(63 + 6) = 69
    assert res["matrix"]["cleanliness"] == 69
    assert res["deltas"]["cleanliness"] == -21


def test_matrix_fail_preserves_values_and_zero_deltas():
    """Verify that failure makes no modifications to matrix."""
    initial = {"dsa": 40, "system_design": 30, "cleanliness": 70}
    res = matrix.calculate_matrix_update(
        current_matrix=initial,
        passed=False
    )
    assert res["matrix"] == initial
    assert res["deltas"] == {"dsa": 0, "system_design": 0, "cleanliness": 0}


# ============================================================================
# 3. ATOMIC TRANSACTION & IDEMPOTENCY TESTS (SCRUM-26, SCRUM-27)
# ============================================================================

def test_award_idempotency_same_chamber_twice():
    """Verify passing the same chamber twice awards NXP exactly once."""
    _, user_id = create_test_user("idempotent_user")

    # Pass 1
    award1 = database.commit_chamber_award(
        user_id=user_id,
        chamber_no=1,
        passed=True,
        inefficient=False,
        cleanliness_score=100,
        attempt_number=1,
        hint_level=0,
        axis_weights={"dsa": 0.8, "system_design": 0.1, "cleanliness": 0.1},
        system_design_gain=2
    )
    assert award1["awarded"] is True
    assert award1["points"] > 0
    total1 = award1["total_nxp"]

    # Pass 2 (re-submission / replay)
    award2 = database.commit_chamber_award(
        user_id=user_id,
        chamber_no=1,
        passed=True,
        inefficient=False,
        cleanliness_score=100,
        attempt_number=2,
        hint_level=0,
        axis_weights={"dsa": 0.8, "system_design": 0.1, "cleanliness": 0.1},
        system_design_gain=2
    )
    assert award2["awarded"] is False
    assert award2["already_awarded"] is True
    assert award2["points"] == 0
    assert award2["total_nxp"] == total1


def test_concurrent_submit_safety():
    """Verify concurrent submissions never double-award NXP."""
    _, user_id = create_test_user("race_user")
    results = []

    def submit_pass():
        try:
            res = database.commit_chamber_award(
                user_id=user_id,
                chamber_no=2,
                passed=True,
                inefficient=False,
                cleanliness_score=100,
                attempt_number=1,
                hint_level=0,
                axis_weights={"dsa": 0.75, "system_design": 0.15, "cleanliness": 0.1},
                system_design_gain=3
            )
            results.append(res)
        except Exception as e:
            results.append({"error": str(e)})

    t1 = threading.Thread(target=submit_pass)
    t2 = threading.Thread(target=submit_pass)
    t1.start()
    t2.start()
    t1.join()
    t2.join()

    # Verify ledger has exactly one row for Chamber 2
    ledger_data = database.get_nxp_ledger(user_id=user_id, limit=10)
    ch2_entries = [item for item in ledger_data["items"] if item["chamber_no"] == 2]
    assert len(ch2_entries) == 1

    # Exactly one thread received awarded == True
    awarded_count = sum(1 for r in results if r.get("awarded") is True)
    assert awarded_count == 1


def test_history_grows_by_one_row_per_pass():
    """Verify matrix_history appends one row per newly awarded pass."""
    _, user_id = create_test_user("history_user")

    # Pass Chamber 1
    database.commit_chamber_award(
        user_id=user_id,
        chamber_no=1,
        passed=True,
        axis_weights={"dsa": 0.8, "system_design": 0.1, "cleanliness": 0.1},
        system_design_gain=2
    )

    hist1 = database.get_matrix_history(user_id)
    assert hist1["total"] == 1

    # Replay Chamber 1 (should NOT append history)
    database.commit_chamber_award(
        user_id=user_id,
        chamber_no=1,
        passed=True
    )
    hist1_replay = database.get_matrix_history(user_id)
    assert hist1_replay["total"] == 1

    # Pass Chamber 2 (should append second row)
    database.commit_chamber_award(
        user_id=user_id,
        chamber_no=2,
        passed=True,
        axis_weights={"dsa": 0.75, "system_design": 0.15, "cleanliness": 0.1},
        system_design_gain=3
    )
    hist2 = database.get_matrix_history(user_id)
    assert hist2["total"] == 2


# ============================================================================
# 4. API ENDPOINTS TEST (SCRUM-26, SCRUM-27)
# ============================================================================

def test_api_matrix_history_and_nxp_ledger():
    """Verify GET /profile/matrix/history and GET /profile/nxp-ledger."""
    token, user_id = create_test_user("api_cadet")
    headers = {"Authorization": f"Bearer {token}"}

    # Pass Chamber 1 to generate ledger and history
    database.commit_chamber_award(
        user_id=user_id,
        chamber_no=1,
        passed=True,
        axis_weights={"dsa": 0.8, "system_design": 0.1, "cleanliness": 0.1},
        system_design_gain=2
    )

    # 1. Matrix History
    res_hist = client.get("/profile/matrix/history?limit=10&offset=0", headers=headers)
    assert res_hist.status_code == 200
    data_hist = res_hist.json()
    assert "items" in data_hist
    assert data_hist["total"] >= 1
    assert len(data_hist["items"]) >= 1
    first_item = data_hist["items"][0]
    assert "dsa" in first_item
    assert "system_design" in first_item
    assert "cleanliness" in first_item
    assert "total_nxp" in first_item

    # 2. NXP Ledger
    res_ledger = client.get("/profile/nxp-ledger?limit=10&offset=0", headers=headers)
    assert res_ledger.status_code == 200
    data_ledger = res_ledger.json()
    assert "items" in data_ledger
    assert data_ledger["total"] >= 1
    assert len(data_ledger["items"]) >= 1
    ledger_first = data_ledger["items"][0]
    assert ledger_first["chamber_no"] == 1
    assert ledger_first["points"] > 0
    assert "streak_after" in ledger_first
