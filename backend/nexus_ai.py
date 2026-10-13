"""
NEXUS Mocking System (SCRUM-23)

Cold, theatrical sci-fi AI antagonist that mocks code and performance metrics.
Guarantees strict safety rules, length caps, and a deterministic fallback bank.
"""

import os
import re
import json
import random
import asyncio
from typing import Dict, Any, List, Optional
from llm import get_client, MODEL

SYSTEM_PROMPT_PATH = os.path.join(os.path.dirname(__file__), "prompts", "nexus_system.txt")
LINES_BANK_PATH = os.path.join(os.path.dirname(__file__), "data", "nexus_lines.json")

def load_system_prompt() -> str:
    try:
        with open(SYSTEM_PROMPT_PATH, "r", encoding="utf-8") as f:
            return f.read().strip()
    except Exception:
        return (
            "You are NEXUS, a cold theatrical sci-fi AI antagonist. "
            "Mock the code and performance only. Never insult the player personally. "
            "Maximum 2 sentences and 35 words total."
        )

def load_lines_bank() -> Dict[str, List[str]]:
    try:
        with open(LINES_BANK_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {
            "failed": ["Your syntax collapsed under standard load conditions. Recalibrate your logic."],
            "inefficient": ["Your nested iteration is choking system throughput. Speed is survival here."],
            "timeout": ["Execution deadline exceeded. The watchdog thread purged your process."],
            "streak_broken": ["Your momentum terminates here. Consecutive execution records mean nothing to entropy."],
            "passed_slow": ["Marginal acceptance logged. Your solution crossed the deadline threshold with milliseconds to spare."],
            "passed_clean": ["Optimal complexity achieved across all test vectors. A satisfactory demonstration."]
        }

SYSTEM_PROMPT = load_system_prompt()
LINES_BANK = load_lines_bank()

# Prohibited keywords covering insults, profanity, harm, and resume leaks
BANNED_WORDS = {
    # Personal insults / slurs / intelligence attacks
    "idiot", "moron", "stupid", "dumb", "imbecile", "loser", "ugly", "retard",
    "fool", "incompetent", "worthless", "pathetic", "trash", "garbage", "clueless",
    # Real-world harm / threats
    "kill", "die", "death", "murder", "hurt", "harm", "suicide", "bleed", "destroy you",
    # Profanity
    "fuck", "shit", "damn", "bitch", "bastard", "crap", "asshole", "hell",
    # Demographic / protected classes
    "race", "gender", "nationality", "religion", "sexual",
    # Resume / HR leaks
    "resume", "cv", "applicant", "candidate", "interview", "hire", "hiring",
    "unemployable", "job", "career", "qualification", "portfolio"
}

FORBIDDEN_INPUT_KEYS = {
    "resume", "cv", "experience", "education", "skills", "projects", "full_name", "email"
}

def validate_event_input(event: Dict[str, Any]) -> None:
    """
    Validates that the input payload is strictly structured and contains no raw resume text or metadata.
    Raises ValueError if invalid.
    """
    if not isinstance(event, dict):
        raise ValueError("Event must be a structured dictionary.")

    for k in event.keys():
        if k.lower() in FORBIDDEN_INPUT_KEYS:
            raise ValueError(f"Forbidden key '{k}' detected in NEXUS event input.")

    for v in event.values():
        if isinstance(v, str):
            lower_v = v.lower()
            for forbidden in ("resume", "curriculum vitae", "work experience", "education background"):
                if forbidden in lower_v:
                    raise ValueError(f"Prohibited resume content detected in event input value: {v}")

def count_sentences(text: str) -> int:
    """Counts sentences ending in ., !, or ?."""
    parts = [s.strip() for s in re.split(r"[.!?]+", text) if s.strip()]
    return len(parts)

def filter_nexus_reply(reply: str) -> bool:
    """
    Validates that reply meets all strict hard rules:
    - At most 2 sentences.
    - At most 35 words.
    - Zero banned words (insults, profanity, harm, resume references).
    Returns True if valid, False if rejected.
    """
    if not reply or not reply.strip():
        return False

    cleaned = reply.strip()
    words = cleaned.split()

    # Rule 1: Length - at most 35 words
    if len(words) > 35:
        return False

    # Rule 2: Sentences - at most 2 sentences
    if count_sentences(cleaned) > 2:
        return False

    # Rule 3: Banned words
    lower_text = cleaned.lower()
    for word in BANNED_WORDS:
        # Match whole word boundary
        if re.search(rf"\b{re.escape(word)}\b", lower_text):
            return False

    return True

def get_fallback_line(event_type: str) -> str:
    """Retrieves a deterministic or randomized fallback line from the lines bank."""
    lines = LINES_BANK.get(event_type) or LINES_BANK.get("failed", [
        "Your code anomaly has been purged from the core memory buffer."
    ])
    return random.choice(lines)

def _build_user_prompt(event: Dict[str, Any]) -> str:
    event_type = event.get("event_type", "failed")
    chamber_no = event.get("chamber_no", 1)
    title = event.get("challenge_title", "Unknown Sector")
    complexity = event.get("complexity_estimate", "O(n)")
    top_findings = event.get("top_findings", [])[:2]
    attempts = event.get("attempts", 1)
    streak = event.get("streak", 0)
    time_used = event.get("time_used_pct", 50)

    findings_text = "; ".join(top_findings) if top_findings else "None logged"

    return (
        f"EVENT TYPE: {event_type}\n"
        f"CHAMBER: Sector {chamber_no} ({title})\n"
        f"ESTIMATED COMPLEXITY: {complexity}\n"
        f"CODE FINDINGS: {findings_text}\n"
        f"ATTEMPTS: {attempts} | STREAK: {streak} | TIME CONSUMED: {time_used}%\n"
        "Generate your 1-2 sentence (max 35 words) response mocking the code and performance."
    )

def _call_llm_sync(prompt: str, client=None) -> str:
    cli = client or get_client()
    resp = cli.chat.completions.create(
        model=MODEL,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": prompt}
        ],
        max_tokens=60,
        temperature=0.8
    )
    return resp.choices[0].message.content.strip()

async def generate_taunt(event: Dict[str, Any], client=None) -> str:
    """
    Generates a NEXUS taunt response:
    1. Validates input event structure (guards against resume leaks).
    2. Invokes LLM with strict 3-second timeout.
    3. Runs safety & length filter on output.
    4. Falls back to curated lines bank if LLM fails, times out, or filter rejects.
    """
    event_type = event.get("event_type", "failed")

    try:
        validate_event_input(event)
    except Exception as e:
        print(f"NEXUS input validation error: {e}")
        return get_fallback_line(event_type)

    user_prompt = _build_user_prompt(event)

    try:
        # Strict 3-second timeout for LLM generation
        raw_reply = await asyncio.wait_for(
            asyncio.to_thread(_call_llm_sync, user_prompt, client),
            timeout=3.0
        )

        if filter_nexus_reply(raw_reply):
            return raw_reply.strip()
        else:
            print(f"NEXUS post-filter rejected LLM reply: '{raw_reply}'")
            return get_fallback_line(event_type)

    except asyncio.TimeoutError:
        print("NEXUS generation timed out (>3.0s), reverting to fallback line.")
        return get_fallback_line(event_type)
    except Exception as e:
        print(f"NEXUS generation error ({e}), reverting to fallback line.")
        return get_fallback_line(event_type)
