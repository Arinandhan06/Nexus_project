import json
from typing import List, Dict, Any, Optional
from llm import get_client, MODEL

AREA_LABELS = {
    "dsa": "Data Structures & Algorithms",
    "system_design": "System Design & Architecture",
    "cleanliness": "Code Cleanliness & Refactoring"
}

DEFAULT_TAUNTS = {
    1: "You think your syntax is sound, cadet? Let's see it survive the initial breach.",
    2: "Architecture without resilience is just structured failure waiting to collapse.",
    3: "Messy abstractions won't hide your lack of depth in the grid.",
    4: "Your primary blindspot is exposed. Prepare for algorithmic torment.",
    5: "We found where you break. Now we apply relentless pressure.",
    6: "The Final Interview. No safety nets, no second chances. Only the code survives."
}

DEFAULT_THEMES = {
    # Chamber 1: Strongest area baseline (Days 1-5)
    1: "Algorithmic Foundations & Array Manipulation",
    2: "Fast Two-Pointer Traversal & Hash Maps",
    3: "Sliding Window & Substring Bounds",
    4: "Recursive Divide-and-Conquer Basics",
    5: "Chamber 1 Evaluation: Time Complexity Defense",

    # Chamber 2: Weakest 1 Foundations (Days 6-10)
    6: "Core Vulnerability Identification",
    7: "Targeted Pattern Recognition & Deconstruction",
    8: "State Management Under High Constraint",
    9: "Failure Mode Analysis & Edge Case Guards",
    10: "Chamber 2 Gatekeeper: Pressure Verification",

    # Chamber 3: Weakest 2 Foundations (Days 11-15)
    11: "Secondary Flaw Isolation & Diagnostics",
    12: "Structural Integrity & Modular Decoupling",
    13: "Boundary Conditions & Memory Footprint",
    14: "Optimization Under Adversarial Latency",
    15: "Chamber 3 Gatekeeper: Robustness Trial",

    # Chamber 4: Weakest 1 Overdrive (Days 16-20)
    16: "Weakness Overdrive I: Advanced Mechanics",
    17: "Complex Trade-offs & Distributed State",
    18: "Asynchronous Concurrency & Race Hazards",
    19: "High-Volume Stress Simulation",
    20: "Chamber 4 Crucible: Zero-Error Execution",

    # Chamber 5: Weakest 2 Overdrive (Days 21-25)
    21: "Weakness Overdrive II: Deep Optimization",
    22: "Sub-Millisecond Profiling & Cache Efficiency",
    23: "Resilient Error Recovery & Circuit Breakers",
    24: "Adversarial Chaos Engineering Drill",
    25: "Chamber 5 Crucible: System Stability Trial",

    # Chamber 6: Final Interview (Days 26-30)
    26: "Final Interview: Full-Stack Live Coding",
    27: "Final Interview: High-Scale Architecture Defense",
    28: "Final Interview: Behavioral Technical Interrogation",
    29: "Final Interview: Chaos Debugging Live Fire",
    30: "Final Interview: The NEXUS Verdict"
}

def generate_schedule(weaknesses: Optional[List[str]] = None, matrix: Optional[Dict[str, int]] = None) -> Dict[str, Any]:
    """
    Generates a deterministic 30-day schedule split across 6 Chambers.
    Invariants:
    1. Exactly 30 days total (Day 1 to 30).
    2. Exactly 6 Chambers (Chamber 1 to 6).
    3. Chamber 1 starts on Day 1.
    4. Chamber 6 occupies the last days (Days 26-30) and is always 'Final Interview'.
    5. The 2 weakest areas get double the days of the strongest area (10 days each vs 5 days).
    6. Each day is: {day, chamber_no, theme, focus_weakness}.
    """
    safe_matrix = {
        "dsa": 35,
        "system_design": 35,
        "cleanliness": 35
    }
    if isinstance(matrix, dict):
        for k in ["dsa", "system_design", "cleanliness"]:
            if k in matrix and isinstance(matrix[k], (int, float)):
                safe_matrix[k] = int(matrix[k])

    safe_weaknesses = weaknesses or [
        "Distributed Systems Scalability",
        "Dynamic Programming Optimization",
        "Concurrency & Race Conditions"
    ]

    # Rank areas by score ascending -> lowest two scores are weakest
    sorted_areas = sorted(
        [("dsa", safe_matrix["dsa"]),
         ("system_design", safe_matrix["system_design"]),
         ("cleanliness", safe_matrix["cleanliness"])],
        key=lambda x: x[1]
    )

    weak1_key = sorted_areas[0][0]
    weak2_key = sorted_areas[1][0]
    strong_key = sorted_areas[2][0]

    weak1_name = AREA_LABELS.get(weak1_key, "Algorithms")
    weak2_name = AREA_LABELS.get(weak2_key, "System Design")
    strong_name = AREA_LABELS.get(strong_key, "Code Cleanliness")

    weak1_focus = safe_weaknesses[0] if len(safe_weaknesses) > 0 else f"{weak1_name} Core"
    weak2_focus = safe_weaknesses[1] if len(safe_weaknesses) > 1 else f"{weak2_name} Core"
    strong_focus = f"{strong_name} Proficiency Baseline"

    # Days mapping:
    # Chamber 1: Days 1-5 (5 days) -> Strongest area
    # Chamber 2: Days 6-10 (5 days) -> Weakest 1 (initial)
    # Chamber 3: Days 11-15 (5 days) -> Weakest 2 (initial)
    # Chamber 4: Days 16-20 (5 days) -> Weakest 1 (overdrive) -> Total 10 days (2x strongest)
    # Chamber 5: Days 21-25 (5 days) -> Weakest 2 (overdrive) -> Total 10 days (2x strongest)
    # Chamber 6: Days 26-30 (5 days) -> Final Interview

    chamber_config = [
        # (chamber_no, start_day, end_day, default_focus, area_key)
        (1, 1, 5, strong_focus, strong_key),
        (2, 6, 10, weak1_focus, weak1_key),
        (3, 11, 15, weak2_focus, weak2_key),
        (4, 16, 20, f"Overdrive: {weak1_focus}", weak1_key),
        (5, 21, 25, f"Overdrive: {weak2_focus}", weak2_key),
        (6, 26, 30, "Comprehensive Final Interview Evaluation", "comprehensive")
    ]

    schedule: List[Dict[str, Any]] = []
    taunts = dict(DEFAULT_TAUNTS)

    for chamber_no, start_day, end_day, focus, area in chamber_config:
        for day in range(start_day, end_day + 1):
            day_theme = DEFAULT_THEMES.get(day, f"Day {day} Trial")
            if chamber_no == 6 and "Final Interview" not in day_theme:
                day_theme = f"Final Interview: {day_theme}"
            schedule.append({
                "day": day,
                "chamber_no": chamber_no,
                "theme": day_theme,
                "focus_weakness": focus
            })

    # Optional LLM flavour: enhance taunts and themes with contextual flavor
    try:
        client = get_client()
        flavor_prompt = f"""Generate contextual flair for a 30-day technical boot-camp in NEXUS.
Candidate Weaknesses: {json.dumps(safe_weaknesses[:3])}
Strongest Area: {strong_name}
Weakest Areas: {weak1_name}, {weak2_name}

Return a JSON object with:
1. "taunts": {{ "1": "taunt for Chamber 1", ..., "6": "taunt for Chamber 6" }}
2. "chamber_themes": {{ "1": "Theme for Chamber 1", ..., "6": "Final Interview" }}

Return strict JSON only.
"""
        response = client.chat.completions.create(
            model=MODEL,
            messages=[
                {"role": "system", "content": "You are NEXUS, an adversarial AI overseer. Output concise JSON only."},
                {"role": "user", "content": flavor_prompt}
            ],
            temperature=0.3,
            max_tokens=500
        )
        content = (response.choices[0].message.content or "").strip()
        if content.startswith("```json"):
            content = content[7:]
        elif content.startswith("```"):
            content = content[3:]
        if content.endswith("```"):
            content = content[:-3]
        parsed = json.loads(content.strip())
        if isinstance(parsed, dict) and "taunts" in parsed and isinstance(parsed["taunts"], dict):
            for k, v in parsed["taunts"].items():
                try:
                    c_num = int(k)
                    if 1 <= c_num <= 6 and isinstance(v, str) and v.strip():
                        taunts[c_num] = v.strip()
                except Exception:
                    pass
    except Exception:
        # LLM flavor is purely decorative; deterministic code guarantees stability
        pass

    return {
        "schedule": schedule,
        "taunts": taunts
    }
