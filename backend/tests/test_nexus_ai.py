import pytest
import asyncio
import time
import secrets
import json
import nexus_ai
import evaluator
import database
from main import app
from fastapi.testclient import TestClient

client = TestClient(app)

def get_auth_token(user_id=None, username="cadet"):
    uid_suffix = secrets.token_hex(6)
    unique_github_id = f"test_{user_id}_{uid_suffix}" if user_id is not None else f"cadet_{uid_suffix}"
    token = f"test_token_phase7_{uid_suffix}"
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
# 1. FILTER TESTS (SCRUM-23)
# ============================================================================

def test_filter_rejects_personal_insults():
    """Verify that filter_nexus_reply rejects insults targeting the player."""
    insults = [
        "You are an idiot. Your code is completely stupid.",
        "A moron wrote this loop.",
        "You are a loser and should quit programming.",
        "Your stupid logic broke the sector."
    ]
    for text in insults:
        assert nexus_ai.filter_nexus_reply(text) is False, f"Failed to reject insult: '{text}'"


def test_filter_rejects_over_length_words():
    """Verify that filter_nexus_reply rejects messages exceeding 35 words."""
    too_long = " ".join(["cycle"] * 36) + "."
    assert nexus_ai.filter_nexus_reply(too_long) is False


def test_filter_rejects_more_than_two_sentences():
    """Verify that filter_nexus_reply rejects replies with more than 2 sentences."""
    three_sentences = "Your loop is sluggish. The clock ran out. Recalibrate immediately."
    assert nexus_ai.filter_nexus_reply(three_sentences) is False


def test_filter_accepts_clean_valid_taunt():
    """Verify that clean code/performance taunts pass the safety filter."""
    valid_taunt = "Your nested iteration is choking system throughput. Speed is survival here."
    assert nexus_ai.filter_nexus_reply(valid_taunt) is True


def test_filter_rejects_resume_terms():
    """Verify that resume/HR terms are rejected by filter_nexus_reply."""
    bad_reply = "Your resume indicates you are not fit for this candidate role."
    assert nexus_ai.filter_nexus_reply(bad_reply) is False


# ============================================================================
# 2. LINE BANK TESTS (SCRUM-23)
# ============================================================================

def test_line_bank_contains_at_least_30_lines_and_all_event_types():
    """Verify lines bank has at least 30 lines and covers all 6 required event types."""
    required_types = ["failed", "inefficient", "timeout", "streak_broken", "passed_slow", "passed_clean"]
    total_lines = 0

    for event_type in required_types:
        assert event_type in nexus_ai.LINES_BANK
        lines = nexus_ai.LINES_BANK[event_type]
        assert len(lines) >= 5, f"Event type '{event_type}' has fewer than 5 lines."
        total_lines += len(lines)

        # Every single line in the curated bank must pass the safety filter
        for line in lines:
            assert nexus_ai.filter_nexus_reply(line) is True, f"Curated line failed safety filter: '{line}'"

    assert total_lines >= 30, f"Total lines bank is {total_lines}, expected at least 30."


def test_get_fallback_line_returns_type_specific_line():
    """Verify that get_fallback_line maps correctly to each event type."""
    for event_type in ["failed", "inefficient", "timeout", "streak_broken", "passed_slow", "passed_clean"]:
        line = nexus_ai.get_fallback_line(event_type)
        assert isinstance(line, str)
        assert line in nexus_ai.LINES_BANK[event_type]


# ============================================================================
# 3. FALLBACK WHEN LLM FAILS OR TIMES OUT (SCRUM-23)
# ============================================================================

class MockRaisingClient:
    class chat:
        class completions:
            @staticmethod
            def create(*args, **kwargs):
                raise RuntimeError("LLM API endpoint unavailable")

class MockTimingOutClient:
    class chat:
        class completions:
            @staticmethod
            def create(*args, **kwargs):
                time.sleep(3.5)
                return None

class MockViolatingClient:
    class chat:
        class completions:
            @staticmethod
            def create(*args, **kwargs):
                class Msg:
                    content = "You are a total idiot and your code is dumb!"
                class Choice:
                    message = Msg()
                class Resp:
                    choices = [Choice()]
                return Resp()


@pytest.mark.asyncio
async def test_fallback_is_used_when_llm_raises():
    event = {
        "event_type": "inefficient",
        "chamber_no": 2,
        "challenge_title": "The Blackout",
        "complexity_estimate": "O(n^2)",
        "top_findings": ["Nested loop detected"],
        "attempts": 1,
        "streak": 0,
        "time_used_pct": 80
    }
    taunt = await nexus_ai.generate_taunt(event, client=MockRaisingClient())
    assert isinstance(taunt, str)
    assert taunt in nexus_ai.LINES_BANK["inefficient"]


@pytest.mark.asyncio
async def test_fallback_is_used_when_llm_times_out():
    event = {
        "event_type": "timeout",
        "chamber_no": 3,
        "challenge_title": "The Gridlock",
        "complexity_estimate": "O(n^3)",
        "top_findings": ["Timeout expired"],
        "attempts": 2,
        "streak": 0,
        "time_used_pct": 100
    }
    taunt = await nexus_ai.generate_taunt(event, client=MockTimingOutClient())
    assert isinstance(taunt, str)
    assert taunt in nexus_ai.LINES_BANK["timeout"]


@pytest.mark.asyncio
async def test_fallback_is_used_when_filter_rejects_llm_reply():
    event = {
        "event_type": "failed",
        "chamber_no": 1,
        "challenge_title": "The Flood",
        "complexity_estimate": "O(n)",
        "top_findings": ["Wrong answer on vector 2"],
        "attempts": 1,
        "streak": 0,
        "time_used_pct": 40
    }
    taunt = await nexus_ai.generate_taunt(event, client=MockViolatingClient())
    assert isinstance(taunt, str)
    assert "idiot" not in taunt.lower()
    assert taunt in nexus_ai.LINES_BANK["failed"]


# ============================================================================
# 4. GUARD AGAINST RESUME TEXT IN INPUT (SCRUM-23)
# ============================================================================

def test_prompt_input_never_contains_resume_text():
    """Verify that event payload with resume terms or forbidden keys is blocked."""
    with pytest.raises(ValueError, match="Forbidden key"):
        nexus_ai.validate_event_input({"resume": "Software engineer with 5 years experience"})

    with pytest.raises(ValueError, match="Forbidden key"):
        nexus_ai.validate_event_input({"education": "BS in CS"})

    with pytest.raises(ValueError, match="Prohibited resume content"):
        nexus_ai.validate_event_input({
            "event_type": "failed",
            "chamber_no": 1,
            "challenge_title": "Includes work experience details"
        })

    # Valid event dictionary succeeds validation
    valid_event = {
        "event_type": "failed",
        "chamber_no": 1,
        "challenge_title": "The Flood",
        "complexity_estimate": "O(n^2)",
        "top_findings": ["Nested loop detected"],
        "attempts": 1,
        "streak": 0,
        "time_used_pct": 50
    }
    nexus_ai.validate_event_input(valid_event)
    built_prompt = nexus_ai._build_user_prompt(valid_event)
    assert "resume" not in built_prompt.lower()
    assert "candidate" not in built_prompt.lower()
    assert "The Flood" in built_prompt


# ============================================================================
# 5. EVALUATOR FINDINGS CARRY SUGGESTIONS (SCRUM-22)
# ============================================================================

def test_evaluator_findings_carry_suggestions():
    """Verify that evaluator findings carry actionable conceptual suggestions with no code."""
    code_with_nested_loop = """
def solve(items):
    out = []
    for i in range(len(items)):
        for j in range(i + 1, len(items)):
            if items[i] == items[j]:
                out.append(items[i])
    return out
"""
    res = evaluator.evaluate_code_ast(code_with_nested_loop, expected_complexity="O(n)")
    assert res["inefficient"] is True
    assert len(res["findings"]) > 0

    # Ensure every finding has a suggestion
    for f in res["findings"]:
        assert "suggestion" in f
        assert isinstance(f["suggestion"], str)
        assert len(f["suggestion"]) > 5
        # Ensure suggestion contains NO code implementations
        assert "def " not in f["suggestion"]
        assert "return " not in f["suggestion"]
        assert "class " not in f["suggestion"]

    # Verify nested loop suggestion specifically
    nested_finding = next((f for f in res["findings"] if "nested loop" in f["message"].lower()), None)
    assert nested_finding is not None
    assert "inner loop" in nested_finding["suggestion"].lower() or "lookup table" in nested_finding["suggestion"].lower()


# ============================================================================
# 6. NEXUS TAUNT HTTP ENDPOINT
# ============================================================================

def test_nexus_taunt_endpoint():
    token, user_id = get_auth_token()
    headers = {"Authorization": f"Bearer {token}"}

    resp = client.post("/nexus/taunt", json={
        "event_type": "passed_clean",
        "chamber_no": 1,
        "challenge_title": "The Flood",
        "complexity_estimate": "O(n)",
        "top_findings": [],
        "attempts": 1,
        "streak": 1,
        "time_used_pct": 30
    }, headers=headers)

    assert resp.status_code == 200
    data = resp.json()
    assert "text" in data
    assert len(data["text"]) > 0
