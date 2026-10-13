import os
import json
import sqlite3
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
import database

CHAMBERS_DATA_FILE = os.path.join(os.path.dirname(__file__), "data", "chambers.json")

def load_chambers_data() -> List[Dict[str, Any]]:
    """Loads all chambers configuration from backend/data/chambers.json."""
    try:
        with open(CHAMBERS_DATA_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        print(f"Error loading chambers.json: {e}")
        return []

CHAMBERS_DATA = load_chambers_data()

# States: LOCKED, UNLOCKED, PREPARING, ACTIVE, EVALUATING, PASSED, FAILED, COMPLETED
class ChamberState:
    LOCKED = "LOCKED"
    UNLOCKED = "UNLOCKED"
    PREPARING = "PREPARING"
    ACTIVE = "ACTIVE"
    EVALUATING = "EVALUATING"
    PASSED = "PASSED"
    FAILED = "FAILED"
    COMPLETED = "COMPLETED"

# Explicit transition table
TRANSITION_TABLE = {
    ChamberState.LOCKED: {ChamberState.UNLOCKED},
    ChamberState.UNLOCKED: {ChamberState.PREPARING, ChamberState.ACTIVE},
    ChamberState.PREPARING: {ChamberState.ACTIVE},
    ChamberState.ACTIVE: {ChamberState.EVALUATING},
    ChamberState.EVALUATING: {ChamberState.PASSED, ChamberState.FAILED},
    ChamberState.FAILED: {ChamberState.ACTIVE, ChamberState.PREPARING},
    ChamberState.PASSED: {ChamberState.COMPLETED},
    ChamberState.COMPLETED: set()
}

class InvalidChamberTransitionError(Exception):
    """Raised when an illegal transition is attempted in the Chamber State Machine."""
    pass

def validate_transition(current_state: str, target_state: str):
    """Validates if transition from current_state to target_state is legal."""
    allowed = TRANSITION_TABLE.get(current_state, set())
    if target_state not in allowed:
        raise InvalidChamberTransitionError(
            f"Illegal transition from '{current_state}' to '{target_state}'. "
            f"Allowed next states: {sorted(list(allowed))}"
        )
    return True

def get_chamber_definition(chamber_no: int) -> Optional[Dict[str, Any]]:
    """Retrieves static chamber definition by chamber number."""
    for ch in CHAMBERS_DATA:
        if ch.get("chamber_no") == chamber_no:
            return ch
    return None

def sanitize_challenge(challenge: Dict[str, Any]) -> Dict[str, Any]:
    """
    CRITICAL: Strips hidden_tests and expected_complexity before sending to client.
    Only story, statement, constraints, starter_code, public_examples and time limit go out.
    """
    if not challenge:
        return {}
    safe = dict(challenge)
    safe.pop("hidden_tests", None)
    safe.pop("expected_complexity", None)
    return safe

def get_or_init_user_chamber_state(user_id: int, chamber_no: int) -> Dict[str, Any]:
    """
    Retrieves the current chamber state record for a user, initializing it if needed.
    Chamber 1 starts UNLOCKED.
    Chamber N (N > 1) is UNLOCKED if chamber N-1 is PASSED or COMPLETED, otherwise LOCKED.
    """
    conn = sqlite3.connect(database.DB_PATH, timeout=30.0)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    cursor.execute(
        "SELECT * FROM chamber_state WHERE user_id = ? AND chamber_no = ?",
        (user_id, chamber_no)
    )
    row = cursor.fetchone()

    if row:
        data = dict(row)
        conn.close()
        return data

    # Determine initial state
    if chamber_no == 1:
        initial_state = ChamberState.UNLOCKED
    else:
        # Check previous chamber state
        cursor.execute(
            "SELECT state FROM chamber_state WHERE user_id = ? AND chamber_no = ?",
            (user_id, chamber_no - 1)
        )
        prev = cursor.fetchone()
        if prev and prev["state"] in (ChamberState.PASSED, ChamberState.COMPLETED):
            initial_state = ChamberState.UNLOCKED
        else:
            initial_state = ChamberState.LOCKED

    cursor.execute("""
        INSERT INTO chamber_state (user_id, chamber_no, state, attempts)
        VALUES (?, ?, ?, 0)
    """, (user_id, chamber_no, initial_state))
    conn.commit()

    cursor.execute(
        "SELECT * FROM chamber_state WHERE user_id = ? AND chamber_no = ?",
        (user_id, chamber_no)
    )
    row = cursor.fetchone()
    data = dict(row)
    conn.close()
    return data

def get_all_user_chambers(user_id: int) -> List[Dict[str, Any]]:
    """Returns overview list of all 6 chambers with user's state and attempts."""
    results = []
    for c in range(1, 7):
        ch_def = get_chamber_definition(c) or {}
        st = get_or_init_user_chamber_state(user_id, c)
        results.append({
            "chamber_no": c,
            "theme": ch_def.get("theme", f"Chamber {c}"),
            "story_title": ch_def.get("story_title", f"Sector {c}"),
            "description": ch_def.get("description", ""),
            "state": st["state"],
            "attempts": st.get("attempts", 0),
            "challenge_id": st.get("challenge_id")
        })
    return results

def set_chamber_state(
    user_id: int,
    chamber_no: int,
    target_state: str,
    challenge_id: Optional[str] = None,
    started_at: Optional[datetime] = None,
    deadline_at: Optional[datetime] = None,
    increment_attempts: bool = False
) -> Dict[str, Any]:
    """Transitions chamber state adhering strictly to TRANSITION_TABLE."""
    current = get_or_init_user_chamber_state(user_id, chamber_no)
    current_state = current["state"]

    if current_state != target_state:
        validate_transition(current_state, target_state)

    conn = sqlite3.connect(database.DB_PATH, timeout=30.0)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    started_str = started_at.isoformat() if started_at else current.get("started_at")
    deadline_str = deadline_at.isoformat() if deadline_at else current.get("deadline_at")
    chal_id = challenge_id if challenge_id is not None else current.get("challenge_id")
    attempts = (current.get("attempts", 0) + 1) if increment_attempts else current.get("attempts", 0)

    cursor.execute("""
        UPDATE chamber_state
        SET state = ?,
            challenge_id = ?,
            started_at = ?,
            deadline_at = ?,
            attempts = ?
        WHERE user_id = ? AND chamber_no = ?
    """, (target_state, chal_id, started_str, deadline_str, attempts, user_id, chamber_no))
    conn.commit()

    # If this chamber was marked PASSED, unlock next chamber if locked!
    if target_state == ChamberState.PASSED and chamber_no < 6:
        cursor.execute(
            "SELECT state FROM chamber_state WHERE user_id = ? AND chamber_no = ?",
            (user_id, chamber_no + 1)
        )
        next_row = cursor.fetchone()
        if not next_row or next_row["state"] == ChamberState.LOCKED:
            cursor.execute("""
                INSERT INTO chamber_state (user_id, chamber_no, state, attempts)
                VALUES (?, ?, 'UNLOCKED', 0)
                ON CONFLICT(user_id, chamber_no) DO UPDATE SET state = 'UNLOCKED'
            """, (user_id, chamber_no + 1))
            conn.commit()
    elif target_state == ChamberState.PASSED and chamber_no == 6:
        # Chamber 6 transitions from PASSED to COMPLETED
        cursor.execute("""
            UPDATE chamber_state SET state = 'COMPLETED'
            WHERE user_id = ? AND chamber_no = 6
        """, (user_id,))
        conn.commit()
        target_state = ChamberState.COMPLETED

    cursor.execute(
        "SELECT * FROM chamber_state WHERE user_id = ? AND chamber_no = ?",
        (user_id, chamber_no)
    )
    updated = dict(cursor.fetchone())
    conn.close()
    return updated

def enter_chamber(user_id: int, chamber_no: int) -> Dict[str, Any]:
    """
    POST /chambers/{n}/enter:
    Moves state to ACTIVE, picks challenge, sets server-controlled deadline.
    Rejected unless state is UNLOCKED, PREPARING, or FAILED.
    """
    current = get_or_init_user_chamber_state(user_id, chamber_no)
    curr_state = current["state"]

    if curr_state not in (ChamberState.UNLOCKED, ChamberState.PREPARING, ChamberState.FAILED):
        raise ValueError(
            f"Cannot enter Chamber {chamber_no} from state '{curr_state}'. "
            f"Must be UNLOCKED, PREPARING, or FAILED."
        )

    ch_def = get_chamber_definition(chamber_no)
    if not ch_def:
        raise ValueError(f"Chamber {chamber_no} definition not found.")

    challenges = ch_def.get("challenges", [])
    if not challenges:
        # Finale Chamber 6 placeholder
        challenge = {
            "id": f"ch{chamber_no}-finale",
            "chamber_no": chamber_no,
            "title": "NEXUS Core Singularity",
            "story": "The final interface awaits in Phase 9.",
            "statement": "Defend the core.",
            "constraints": ["N/A"],
            "starter_code": "def finale(): pass",
            "time_limit_seconds": 1800,
            "public_examples": []
        }
    else:
        # Pick challenge based on previous attempts or alternating
        attempts = current.get("attempts", 0)
        challenge = challenges[attempts % len(challenges)]

    now = datetime.utcnow()
    time_limit = challenge.get("time_limit_seconds", 1200)
    deadline = now + timedelta(seconds=time_limit)

    updated_state = set_chamber_state(
        user_id=user_id,
        chamber_no=chamber_no,
        target_state=ChamberState.ACTIVE,
        challenge_id=challenge["id"],
        started_at=now,
        deadline_at=deadline,
        increment_attempts=True
    )

    safe_chal = sanitize_challenge(challenge)
    return {
        "chamber_no": chamber_no,
        "state": updated_state["state"],
        "challenge_id": challenge["id"],
        "deadline_at": deadline.isoformat(),
        "seconds_remaining": time_limit,
        "attempts": updated_state["attempts"],
        "challenge": safe_chal
    }

def get_current_chamber_info(user_id: int, chamber_no: int) -> Dict[str, Any]:
    """
    GET /chambers/{n}/current:
    Returns safe challenge fields plus seconds_remaining calculated from server deadline.
    """
    st = get_or_init_user_chamber_state(user_id, chamber_no)
    chal_id = st.get("challenge_id")

    ch_def = get_chamber_definition(chamber_no) or {}
    matched_chal = None
    for c in ch_def.get("challenges", []):
        if c.get("id") == chal_id:
            matched_chal = c
            break

    if not matched_chal and ch_def.get("challenges"):
        matched_chal = ch_def["challenges"][0]

    seconds_remaining = 0
    if st.get("deadline_at"):
        try:
            deadline = datetime.fromisoformat(st["deadline_at"])
            delta = (deadline - datetime.utcnow()).total_seconds()
            seconds_remaining = max(0, int(delta))
        except Exception:
            seconds_remaining = 0

    safe_challenge = sanitize_challenge(matched_chal) if matched_chal else None

    return {
        "chamber_no": chamber_no,
        "state": st["state"],
        "attempts": st.get("attempts", 0),
        "deadline_at": st.get("deadline_at"),
        "seconds_remaining": seconds_remaining,
        "challenge": safe_challenge
    }

def record_chamber_submission(
    user_id: int,
    chamber_no: int,
    code: str,
    language: str = "python"
) -> Dict[str, Any]:
    """
    POST /chambers/{n}/submit:
    Limits code to 20 KB. Rejects if not ACTIVE or past deadline + 5s grace.
    Stores chamber_attempts row, moves state to EVALUATING, returns {status: 'evaluation_pending'}.
    """
    if len(code.encode("utf-8")) > 20 * 1024:
        raise ValueError("Code exceeds maximum 20 KB limit.")

    st = get_or_init_user_chamber_state(user_id, chamber_no)
    curr_state = st["state"]

    if curr_state == ChamberState.EVALUATING:
        raise ValueError("A submission is already pending evaluation. Cannot submit twice concurrently.")

    if curr_state != ChamberState.ACTIVE:
        raise ValueError(f"Cannot submit when Chamber {chamber_no} is in state '{curr_state}'. Must be ACTIVE.")

    # Server deadline enforcement with 5-second grace window
    if st.get("deadline_at"):
        try:
            deadline = datetime.fromisoformat(st["deadline_at"])
            if datetime.utcnow() > deadline + timedelta(seconds=5):
                raise ValueError("Submission deadline expired.")
        except ValueError:
            raise
        except Exception as e:
            print(f"Error checking deadline: {e}")

    # Store row in chamber_attempts
    conn = sqlite3.connect(database.DB_PATH, timeout=30.0)
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO chamber_attempts (user_id, chamber_no, challenge_id, code, language, passed)
        VALUES (?, ?, ?, ?, ?, NULL)
    """, (user_id, chamber_no, st.get("challenge_id"), code, language))
    conn.commit()
    conn.close()

    # Move state to EVALUATING
    updated = set_chamber_state(
        user_id=user_id,
        chamber_no=chamber_no,
        target_state=ChamberState.EVALUATING
    )

    return {
        "status": "evaluation_pending",
        "state": updated["state"],
        "chamber_no": chamber_no
    }
