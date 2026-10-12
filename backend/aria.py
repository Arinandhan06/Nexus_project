import os
import re
from typing import Optional
from llm import get_client, MODEL

PROMPT_FILE = os.path.join(os.path.dirname(__file__), "prompts", "aria_system.txt")

def load_system_prompt() -> str:
    """Loads the ARIA system prompt from backend/prompts/aria_system.txt."""
    try:
        with open(PROMPT_FILE, "r", encoding="utf-8") as f:
            return f.read().strip()
    except Exception:
        return (
            "You are ARIA, a calm strategic mentor. Never write a complete solution. "
            "Never write more than 3 lines of code in a reply. "
            "Level 1 = guiding question. Level 2 = name technique. Level 3 = short pseudocode sketch. "
            "Replies are at most 120 words."
        )

SYSTEM_PROMPT = load_system_prompt()

# Canned fallback hints when model violates line rules repeatedly
CANNED_HINTS = {
    1: "Consider the core invariant: what pattern or relationship between elements must always hold as you step through the input?",
    2: "Look into utilizing a Two-Pointer technique or a Hash Map to reduce your lookup overhead from quadratic to linear time.",
    3: "Initialize your auxiliary state, iterate through the elements once while updating tracking markers, then return the aggregated result."
}

def count_code_lines(text: str) -> int:
    """
    Counts total lines of code in a reply (fenced code blocks or raw code lines).
    Returns total non-empty code lines.
    """
    if not text:
        return 0

    # 1. Check fenced code blocks: ```...```
    fenced_blocks = re.findall(r"```(?:[a-zA-Z0-9_]*)\n?(.*?)```", text, re.DOTALL)
    if fenced_blocks:
        total = 0
        for block in fenced_blocks:
            lines = [line.strip() for line in block.splitlines() if line.strip()]
            total += len(lines)
        return total

    # 2. Check unfenced code lines (e.g. lines starting with indentation or common keywords)
    code_line_count = 0
    code_pattern = re.compile(
        r"^\s*(?:def\s+|class\s+|return\s+|for\s+|while\s+|if\s+|elif\s+|else:|import\s+|from\s+|\w+\s*=\s*[\w\[\{\(]|\w+\.(?:append|add|pop|get|insert|sort)\s*\()",
        re.MULTILINE
    )
    for line in text.splitlines():
        trimmed = line.strip()
        if not trimmed:
            continue
        if code_pattern.match(line):
            code_line_count += 1

    return code_line_count

def ask_aria(
    user_message: str,
    code: str = "",
    challenge_context: Optional[dict] = None,
    hint_level: int = 1,
    client=None
) -> str:
    """
    Consults ARIA for guidance.
    Enforces the strict max 3 lines of code rule with 1 retry and deterministic canned fallback.
    """
    hint_level = max(1, min(3, int(hint_level)))
    client = client or get_client()

    context_str = ""
    if challenge_context:
        title = challenge_context.get("title", "Unknown Challenge")
        statement = challenge_context.get("statement", "")
        context_str = f"\nCHALLENGE [{title}]: {statement}\n"

    user_code_str = ""
    if code and code.strip():
        # Truncate user code safely to max 20KB if needed
        truncated_code = code[:20480]
        user_code_str = f"\nCANDIDATE CODE:\n```python\n{truncated_code}\n```\n"

    level_instructions = {
        1: "Current Hint Level: 1. Provide ONLY a guiding strategic question. Do not provide code or complete answers.",
        2: "Current Hint Level: 2. Name the key algorithm, data structure, or technique to apply and explain why it fits.",
        3: "Current Hint Level: 3. Provide a brief pseudocode skeleton or outline (strictly AT MOST 3 lines of code total)."
    }

    full_system = (
        f"{SYSTEM_PROMPT}\n\n"
        f"{level_instructions.get(hint_level, level_instructions[1])}\n"
        "Remember: Maximum 120 words. Total code lines in reply MUST NOT EXCEED 3 lines."
    )

    user_content = (
        f"{context_str}"
        f"{user_code_str}"
        f"CANDIDATE QUERY: {user_message}"
    )

    messages = [
        {"role": "system", "content": full_system},
        {"role": "user", "content": user_content}
    ]

    try:
        response = client.chat.completions.create(
            model=MODEL,
            messages=messages,
            temperature=0.3,
            max_tokens=250
        )
        reply = response.choices[0].message.content.strip()

        # Check line rule
        if count_code_lines(reply) <= 3:
            return reply

        # Regenerate ONCE with strict instruction
        retry_messages = [
            {"role": "system", "content": full_system},
            {"role": "user", "content": user_content},
            {"role": "assistant", "content": reply},
            {"role": "user", "content": "You broke the hint rules; rewrite as a hint only with 3 lines of code or less."}
        ]
        retry_response = client.chat.completions.create(
            model=MODEL,
            messages=retry_messages,
            temperature=0.2,
            max_tokens=250
        )
        retry_reply = retry_response.choices[0].message.content.strip()

        if count_code_lines(retry_reply) <= 3:
            return retry_reply

        # Fallback to canned hint if model still violates
        return CANNED_HINTS.get(hint_level, CANNED_HINTS[1])

    except Exception as e:
        return CANNED_HINTS.get(hint_level, CANNED_HINTS[1])
