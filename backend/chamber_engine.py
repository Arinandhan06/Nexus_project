import os
import json
import sqlite3
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
import database
import judge0
import harness
import evaluator
import ws

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

    # If currently ACTIVE but deadline has elapsed, auto-mark FAILED so retry is permitted
    if curr_state == ChamberState.ACTIVE and current.get("deadline_at"):
        try:
            dl_str = current["deadline_at"].replace("Z", "")
            deadline = datetime.fromisoformat(dl_str)
            if datetime.utcnow() > deadline:
                set_chamber_state(user_id, chamber_no, ChamberState.EVALUATING)
                set_chamber_state(user_id, chamber_no, ChamberState.FAILED)
                curr_state = ChamberState.FAILED
        except Exception:
            pass

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
        "deadline_at": deadline.isoformat() + "Z",
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
    curr_state = st["state"]
    if st.get("deadline_at"):
        try:
            dl_str = st["deadline_at"].replace("Z", "")
            deadline = datetime.fromisoformat(dl_str)
            delta = (deadline - datetime.utcnow()).total_seconds()
            seconds_remaining = max(0, int(delta))
            if seconds_remaining == 0 and curr_state == ChamberState.ACTIVE:
                try:
                    set_chamber_state(user_id, chamber_no, ChamberState.EVALUATING)
                    set_chamber_state(user_id, chamber_no, ChamberState.FAILED)
                    curr_state = ChamberState.FAILED
                except Exception:
                    pass
        except Exception:
            seconds_remaining = 0

    safe_challenge = sanitize_challenge(matched_chal) if matched_chal else None

    deadline_iso = st.get("deadline_at")
    if deadline_iso and not deadline_iso.endswith("Z"):
        deadline_iso = deadline_iso + "Z"

    return {
        "chamber_no": chamber_no,
        "state": curr_state,
        "attempts": st.get("attempts", 0),
        "deadline_at": deadline_iso,
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

async def process_chamber_submission_pipeline(
    user_id: int,
    chamber_no: int,
    code: str,
    language: str = "python"
):
    """
    Asynchronous submission execution pipeline for Phase 6:
    1. Static pre-check with evaluator.py (SyntaxError and forbidden calls/imports).
    2. Batch Judge0 execution against hidden test cases using harness.py.
    3. AST complexity and cleanliness grading.
    4. Database attempt update & Chamber state transition (PASSED/FAILED).
    5. WebSocket event pushing (judging, result).
    """
    try:
        # Ensure state is EVALUATING if entered from ACTIVE
        st_init = get_or_init_user_chamber_state(user_id, chamber_no)
        if st_init["state"] == ChamberState.ACTIVE:
            set_chamber_state(user_id, chamber_no, ChamberState.EVALUATING)

        # Step 1: Push judging event
        await ws.ws_manager.broadcast_to_user(user_id, {
            "type": "judging",
            "payload": {
                "message": "NEXUS Core: Static AST validation & security pre-checks engaged...",
                "chamber_no": chamber_no
            }
        })

        # Step 2: Static pre-check
        pre = evaluator.pre_check_code(code)
        if not pre["passed"]:
            reason = pre["reason"]
            msg = pre["message"]
            findings = [{"line": 1, "message": msg}]

            # Move state to FAILED
            set_chamber_state(user_id, chamber_no, ChamberState.FAILED)
            database.update_latest_chamber_attempt(
                user_id=user_id,
                chamber_no=chamber_no,
                passed=False,
                runtime_ms=0,
                complexity_label="Blocked" if reason == "blocked" else "SyntaxError",
                cleanliness_score=0
            )

            await ws.ws_manager.broadcast_to_user(user_id, {
                "type": "state",
                "payload": {"chamber_no": chamber_no, "state": ChamberState.FAILED}
            })
            await ws.ws_manager.broadcast_to_user(user_id, {
                "type": "result",
                "payload": {
                    "passed": False,
                    "state": ChamberState.FAILED,
                    "chamber_no": chamber_no,
                    "error": msg,
                    "reason": reason,
                    "tests": [],
                    "complexity": "Unknown (estimated)",
                    "expected_complexity": "O(n)",
                    "inefficient": False,
                    "cleanliness": 0,
                    "findings": findings,
                    "security_flags": pre.get("security_flags", [])
                }
            })
            return

        # Step 3: Fetch active challenge details
        st = get_or_init_user_chamber_state(user_id, chamber_no)
        challenge_id = st.get("challenge_id")
        challenge = None
        ch_def = get_chamber_definition(chamber_no)
        if ch_def:
            for c in ch_def.get("challenges", []):
                if c.get("id") == challenge_id:
                    challenge = c
                    break
            if challenge is None and ch_def.get("challenges"):
                challenge = ch_def["challenges"][0]

        if not challenge:
            challenge = {
                "entry_point": "solution",
                "hidden_tests": [],
                "expected_complexity": "O(n)"
            }

        entry_point = challenge.get("entry_point", "solution")
        hidden_tests = challenge.get("hidden_tests", [])
        expected_complexity = challenge.get("expected_complexity", "O(n)")

        await ws.ws_manager.broadcast_to_user(user_id, {
            "type": "judging",
            "payload": {
                "message": f"NEXUS Sandbox: Executing {len(hidden_tests)} hidden test vectors...",
                "chamber_no": chamber_no
            }
        })

        # Step 4: Build program with harness & prepare batch for Judge0
        program_code = harness.build_program(code, entry_point)
        submissions = []
        for test in hidden_tests:
            stdin_json = harness.prepare_test_stdin(test.get("input"))
            submissions.append({
                "source_code": program_code,
                "stdin": stdin_json,
                "cpu_time_limit": 2.0,
                "memory_limit": 128000
            })

        judge_results = await judge0.execute_batch(submissions)

        # Step 5: Evaluate test results
        tests_summary = []
        total_time_ms = 0
        all_passed = True if len(hidden_tests) > 0 else False

        for idx, test in enumerate(hidden_tests):
            j_res = judge_results[idx] if idx < len(judge_results) else {
                "status": "internal_error", "time_ms": 0, "stdout": "", "error_message": ""
            }
            t_time = j_res.get("time_ms", 0)
            total_time_ms += t_time

            parsed = harness.parse_harness_output(j_res.get("stdout", ""))

            if j_res.get("status") == "passed":
                if parsed.get("found") and not parsed.get("error"):
                    is_correct = harness.compare_results(parsed.get("result"), test.get("output"))
                    test_status = "passed" if is_correct else "wrong_answer"
                elif parsed.get("error"):
                    test_status = "runtime_error"
                else:
                    test_status = "wrong_answer"
            else:
                test_status = j_res.get("status", "internal_error")

            if test_status != "passed":
                all_passed = False

            # Hard security rule: never expose hidden test inputs or outputs
            t_err = (parsed.get("error") or j_res.get("error_message") or "") if test_status != "passed" else None
            tests_summary.append({
                "id": idx + 1,
                "status": test_status,
                "time_ms": t_time,
                "error": t_err
            })

        # Step 6: AST Evaluator
        ast_eval = evaluator.evaluate_code_ast(code, expected_complexity)
        complexity = ast_eval["complexity_estimate"]
        inefficient = ast_eval["inefficient"]
        cleanliness = ast_eval["cleanliness"]
        findings = ast_eval["findings"]

        # Step 7: Transition Chamber State
        # PASSED means every hidden test passed. Inefficiency does not fail a Chamber.
        target_state = ChamberState.PASSED if all_passed else ChamberState.FAILED

        database.update_latest_chamber_attempt(
            user_id=user_id,
            chamber_no=chamber_no,
            passed=all_passed,
            runtime_ms=total_time_ms,
            complexity_label=complexity,
            cleanliness_score=cleanliness
        )

        # Step 7b: Atomic NXP & Matrix Award Transaction (SCRUM-26, SCRUM-27)
        latest_attempt_id = database.get_latest_attempt_id(user_id, chamber_no)
        chal_id = challenge.get("id", f"chamber-{chamber_no}")
        hint_lvl = database.get_aria_hints_used(user_id, chal_id)

        award_data = database.commit_chamber_award(
            user_id=user_id,
            chamber_no=chamber_no,
            passed=all_passed,
            inefficient=inefficient,
            cleanliness_score=cleanliness,
            attempt_number=st.get("attempts", 1),
            hint_level=hint_lvl,
            axis_weights=challenge.get("axis_weights", {"dsa": 0.7, "system_design": 0.2, "cleanliness": 0.1}),
            system_design_gain=challenge.get("system_design_gain", 3),
            attempt_id=latest_attempt_id
        )

        set_chamber_state(user_id, chamber_no, target_state)

        # Step 8: Push WS state and result events
        await ws.ws_manager.broadcast_to_user(user_id, {
            "type": "state",
            "payload": {"chamber_no": chamber_no, "state": target_state}
        })

        first_err = next((t["error"] for t in tests_summary if t.get("error")), None)
        await ws.ws_manager.broadcast_to_user(user_id, {
            "type": "result",
            "payload": {
                "passed": all_passed,
                "state": target_state,
                "chamber_no": chamber_no,
                "tests": tests_summary,
                "complexity": complexity,
                "expected": expected_complexity,
                "inefficient": inefficient,
                "cleanliness": cleanliness,
                "findings": findings,
                "error": first_err
            }
        })

        # Step 8b: Push WS progress event (SCRUM-26, SCRUM-27)
        if all_passed:
            await ws.ws_manager.broadcast_to_user(user_id, {
                "type": "progress",
                "payload": {
                    "nxp_awarded": award_data.get("nxp_awarded", 0),
                    "total_nxp": award_data.get("total_nxp", 0),
                    "streak": award_data.get("streak", 0),
                    "multiplier": award_data.get("multiplier", 1.0),
                    "matrix": award_data.get("matrix", {}),
                    "deltas": award_data.get("deltas", {})
                }
            })

        # Step 9: Compute & push NEXUS taunt event (SCRUM-23) - must never delay result event
        try:
            import nexus_ai
            if not all_passed:
                if any(t.get("status") == "time_limit" for t in tests_summary):
                    event_type = "timeout"
                elif st.get("attempts", 1) > 2:
                    event_type = "streak_broken"
                else:
                    event_type = "failed"
            else:
                if inefficient:
                    event_type = "inefficient"
                elif total_time_ms > 1000:
                    event_type = "passed_slow"
                else:
                    event_type = "passed_clean"

            top_findings_list = [f.get("message", "") for f in findings[:2]]
            # Calculate realistic time_used_pct and streak
            time_limit = challenge.get("time_limit_seconds", 1200)
            time_used_pct = 50
            if "deadline_at" in st and st["deadline_at"]:
                try:
                    if isinstance(st["deadline_at"], str):
                        dl = datetime.fromisoformat(st["deadline_at"])
                    else:
                        dl = st["deadline_at"]
                    remaining_sec = max(0, int((dl - datetime.utcnow()).total_seconds()))
                    time_used_pct = min(100, max(0, int(((time_limit - remaining_sec) / max(1, time_limit)) * 100)))
                except Exception:
                    time_used_pct = 50

            user_profile = database.get_player_profile(user_id)
            streak_val = user_profile.get("current_streak", 0) if user_profile else (1 if all_passed else 0)

            taunt_payload = {
                "event_type": event_type,
                "chamber_no": chamber_no,
                "challenge_title": challenge.get("title", f"Chamber {chamber_no}"),
                "complexity_estimate": complexity,
                "top_findings": top_findings_list,
                "attempts": st.get("attempts", 1),
                "streak": streak_val,
                "time_used_pct": time_used_pct
            }
            taunt_text = await nexus_ai.generate_taunt(taunt_payload)
            await ws.ws_manager.broadcast_to_user(user_id, {
                "type": "nexus",
                "payload": {"text": taunt_text}
            })
        except Exception as taunt_err:
            print(f"Error generating NEXUS taunt: {taunt_err}")

    except Exception as e:
        print(f"Error in chamber submission pipeline: {e}")
        try:
            curr_st = get_or_init_user_chamber_state(user_id, chamber_no)
            if curr_st["state"] == ChamberState.ACTIVE:
                set_chamber_state(user_id, chamber_no, ChamberState.EVALUATING)
            set_chamber_state(user_id, chamber_no, ChamberState.FAILED)
            await ws.ws_manager.broadcast_to_user(user_id, {
                "type": "result",
                "payload": {
                    "passed": False,
                    "state": ChamberState.FAILED,
                    "chamber_no": chamber_no,
                    "error": "Execution pipeline encountered an internal error.",
                    "tests": [],
                    "complexity": "Unknown (estimated)",
                    "expected": "O(n)",
                    "inefficient": False,
                    "cleanliness": 0,
                    "findings": []
                }
            })
        except Exception:
            pass


async def evaluate_code(challenge: Dict[str, Any], code: str) -> Dict[str, Any]:
    """
    Evaluates submitted code for a challenge using Judge0, hidden tests, and AST evaluator.
    Returns test summaries, complexity, efficiency, and cleanliness.
    Ensures hidden test inputs/outputs are never returned in the summary.
    """
    hidden_tests = challenge.get("hidden_tests", [])
    entry_point = challenge.get("entry_point", "solution")
    expected_complexity = challenge.get("expected_complexity", "O(n)")

    program_code = harness.build_program(code, entry_point)
    submissions = []
    for test in hidden_tests:
        stdin_json = harness.prepare_test_stdin(test.get("input"))
        submissions.append({
            "source_code": program_code,
            "stdin": stdin_json,
            "cpu_time_limit": 2.0,
            "memory_limit": 128000
        })

    judge_results = await judge0.execute_batch(submissions)

    tests_summary = []
    total_time_ms = 0
    all_passed = True if len(hidden_tests) > 0 else False

    for idx, test in enumerate(hidden_tests):
        j_res = judge_results[idx] if idx < len(judge_results) else {
            "status": "internal_error", "time_ms": 0, "stdout": "", "error_message": ""
        }
        t_time = j_res.get("time_ms", 0)
        total_time_ms += t_time

        parsed = harness.parse_harness_output(j_res.get("stdout", ""))

        if j_res.get("status") == "passed":
            if parsed.get("found") and not parsed.get("error"):
                is_correct = harness.compare_results(parsed.get("result"), test.get("output"))
                test_status = "passed" if is_correct else "wrong_answer"
            elif parsed.get("error"):
                test_status = "runtime_error"
            else:
                test_status = "wrong_answer"
        else:
            test_status = j_res.get("status", "internal_error")

        if test_status != "passed":
            all_passed = False

        tests_summary.append({
            "id": idx + 1,
            "status": test_status,
            "time_ms": t_time
        })

    ast_eval = evaluator.evaluate_code_ast(code, expected_complexity)
    return {
        "all_passed": all_passed,
        "total_time_ms": total_time_ms,
        "complexity": ast_eval["complexity_estimate"],
        "expected": expected_complexity,
        "inefficient": ast_eval["inefficient"],
        "cleanliness": ast_eval["cleanliness"],
        "findings": ast_eval["findings"],
        "tests": tests_summary
    }

