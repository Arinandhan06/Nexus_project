"""
Job-Readiness Matrix Calculation Engine (SCRUM-27)

Rules & Formulas:
1. Three Axes:
   - Data Structures & Algorithms (dsa): 0-100
   - System Design (system_design): 0-100
   - Code Cleanliness (cleanliness): 0-100

2. On Chamber Pass:
   - base_gain = 12 if not inefficient else 6
   - dsa_gain = round(base_gain * dsa_weight)
   - new_dsa = clamp(old_dsa + dsa_gain, 0, 100)
   - new_system_design = clamp(old_system_design + system_design_gain, 0, 100)
   - cleanliness moves by exponential averaging:
     new_cleanliness = clamp(round(0.7 * old_cleanliness + 0.3 * attempt_cleanliness_score), 0, 100)
     (Notice: exponential averaging can decrease as well as increase).

3. On Chamber Fail:
   - No gains and no losses to dsa or system_design.
   - Cleanliness is not updated.
   - All deltas are 0.

4. Clamping:
   - Every axis is strictly clamped to [0, 100].
"""

from typing import Dict, Any


def clamp_score(val: int) -> int:
    """Clamps an integer score to the range [0, 100]."""
    return max(0, min(100, int(val)))


def calculate_matrix_update(
    current_matrix: Dict[str, int],
    passed: bool,
    inefficient: bool = False,
    attempt_cleanliness_score: int = 100,
    dsa_weight: float = 0.7,
    system_design_gain: int = 5
) -> Dict[str, Any]:
    """
    Calculates updated matrix axes and deltas based on chamber outcome.

    Pure function with no I/O.

    Args:
        current_matrix: Dict with keys 'dsa', 'system_design', 'cleanliness' (all 0-100).
        passed: Whether the chamber submission passed.
        inefficient: True if the solution had higher complexity than expected.
        attempt_cleanliness_score: AST cleanliness score for this submission (0-100).
        dsa_weight: Weight allocated to DSA from the challenge's axis_weights.
        system_design_gain: Fixed gain allocated to System Design (0-10).

    Returns:
        Dict with:
            matrix: Dict[str, int] representing new {dsa, system_design, cleanliness} clamped to 0-100.
            deltas: Dict[str, int] representing signed changes {dsa, system_design, cleanliness}.
    """
    old_dsa = clamp_score(current_matrix.get("dsa", 0))
    old_sd = clamp_score(current_matrix.get("system_design", 0))
    old_clean = clamp_score(current_matrix.get("cleanliness", 0))

    if not passed:
        return {
            "matrix": {
                "dsa": old_dsa,
                "system_design": old_sd,
                "cleanliness": old_clean
            },
            "deltas": {
                "dsa": 0,
                "system_design": 0,
                "cleanliness": 0
            }
        }

    # Base gain: 12 for efficient solution, 6 for inefficient solution
    base_gain = 12 if not inefficient else 6
    dsa_gain = round(base_gain * max(0.0, float(dsa_weight)))
    new_dsa = clamp_score(old_dsa + dsa_gain)
    delta_dsa = new_dsa - old_dsa

    # System design gain: fixed gain (0-10)
    clamped_sd_gain = max(0, min(10, int(system_design_gain)))
    new_sd = clamp_score(old_sd + clamped_sd_gain)
    delta_sd = new_sd - old_sd

    # Cleanliness exponential moving average: 0.7 * old + 0.3 * attempt_score
    clean_score = clamp_score(attempt_cleanliness_score)
    averaged_clean = round(0.7 * old_clean + 0.3 * clean_score)
    new_clean = clamp_score(averaged_clean)
    delta_clean = new_clean - old_clean

    return {
        "matrix": {
            "dsa": new_dsa,
            "system_design": new_sd,
            "cleanliness": new_clean
        },
        "deltas": {
            "dsa": delta_dsa,
            "system_design": delta_sd,
            "cleanliness": delta_clean
        }
    }
