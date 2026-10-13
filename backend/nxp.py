"""
NEXUS Experience Points (NXP) and Streak Engine (SCRUM-26)

Rules & Formulas:
1. Base NXP:
   - base = chamber_no * 100

2. Bonuses (calculated as percentages of base):
   - Efficiency bonus: +25% of base when the execution is not marked inefficient.
   - Cleanliness bonus: +25% of base multiplied by (cleanliness / 100).
   - First-try bonus: +20% of base when this is the first attempt at the Chamber (attempt_number == 1).

3. Penalties:
   - Hint penalty: -5% of base per ARIA hint level used on that challenge, at most -15% (min(hint_level, 3) * 0.05 * base).

4. Streak Multiplier:
   - streak_multiplier = 1.0 + 0.1 * min(max(0, streak_before_this_pass), 5)
   - Bounded between 1.0 and 1.5.

5. Final Calculation:
   - subtotal = base + efficiency_bonus + cleanliness_bonus + first_try_bonus - hint_penalty
   - final_points = max(0, round(subtotal * streak_multiplier))
   - If the attempt did not pass (passed == False), awarded points is 0.

6. Streaks:
   - On pass: current_streak = streak_before + 1, best_streak = max(best_streak, current_streak).
   - On fail / timeout: current_streak resets to 0, best_streak remains unchanged.

7. Award Idempotency:
   - Tracked in nxp_ledger with UNIQUE (user_id, chamber_no, reason).
   - Replays or repeated passes award 0 points.
"""

from typing import Dict, Any, Tuple


def calculate_nxp(
    chamber_no: int,
    passed: bool,
    inefficient: bool = False,
    cleanliness: int = 100,
    attempt_number: int = 1,
    hint_level: int = 0,
    streak_before: int = 0
) -> Dict[str, Any]:
    """
    Calculates NXP award breakdown and total points for a chamber attempt.

    Pure function with no I/O.

    Args:
        chamber_no: 1-indexed chamber number (base = chamber_no * 100).
        passed: Whether all test vectors passed.
        inefficient: True if AST / runtime estimated complexity is worse than expected.
        cleanliness: AST cleanliness grade (0-100).
        attempt_number: Attempt count (1 = first attempt).
        hint_level: Number of ARIA hints used on this challenge (0-3).
        streak_before: Consecutive chamber pass streak prior to this attempt.

    Returns:
        Dict containing:
            base: Base points
            efficiency_bonus: Bonus points for efficient solution
            cleanliness_bonus: Bonus points scaled by cleanliness score
            first_try_bonus: Bonus points for first attempt
            hint_penalty: Penalty points for hints used
            subtotal: Pre-multiplier point total
            multiplier: Streak multiplier (1.0 - 1.5)
            points: Final rounded integer points (>= 0)
    """
    base = max(1, chamber_no) * 100

    if not passed:
        return {
            "base": base,
            "efficiency_bonus": 0.0,
            "cleanliness_bonus": 0.0,
            "first_try_bonus": 0.0,
            "hint_penalty": 0.0,
            "subtotal": 0.0,
            "multiplier": 1.0,
            "points": 0
        }

    # Efficiency bonus: +25% of base when result is not inefficient
    eff_bonus = round(0.25 * base, 2) if not inefficient else 0.0

    # Cleanliness bonus: +25% of base * (cleanliness / 100)
    clamped_cleanliness = max(0, min(100, cleanliness))
    clean_bonus = round(0.25 * base * (clamped_cleanliness / 100.0), 2)

    # First-try bonus: +20% of base when this is the first attempt
    first_bonus = round(0.20 * base, 2) if attempt_number == 1 else 0.0

    # Hint penalty: -5% of base per ARIA hint level, capped at -15%
    clamped_hint = max(0, min(3, hint_level))
    hint_penalty = round(clamped_hint * 0.05 * base, 2)

    subtotal = round(base + eff_bonus + clean_bonus + first_bonus - hint_penalty, 2)

    # Streak multiplier: 1.0 + 0.1 * min(streak_before_this_pass, 5) -> max 1.5
    capped_streak = max(0, min(5, streak_before))
    streak_multiplier = round(1.0 + 0.1 * capped_streak, 2)

    final_points = max(0, round(subtotal * streak_multiplier))

    return {
        "base": base,
        "efficiency_bonus": eff_bonus,
        "cleanliness_bonus": clean_bonus,
        "first_try_bonus": first_bonus,
        "hint_penalty": hint_penalty,
        "subtotal": subtotal,
        "multiplier": streak_multiplier,
        "points": final_points
    }


def update_streak(current_streak: int, best_streak: int, passed: bool) -> Tuple[int, int]:
    """
    Updates current streak and best streak.

    On pass:
        new_current = current_streak + 1
        new_best = max(best_streak, new_current)
    On fail or timeout:
        new_current = 0
        new_best = best_streak

    Returns:
        Tuple of (new_current_streak, new_best_streak)
    """
    if passed:
        new_curr = max(0, current_streak) + 1
        new_best = max(max(0, best_streak), new_curr)
        return new_curr, new_best
    else:
        return 0, max(0, best_streak)
