"""
bids.py - Company Bids and Style Classification (SCRUM-29)

Pure functions for computing player style classification, deterministic company bid scores,
and structured work-style analysis without any personal or resume data.

Style Classification Thresholds:
- "Optimal and clean": avg_cleanliness >= 80, non_inefficient_share >= 0.75, avg_time_used_pct <= 60
- "Slow and polished": avg_cleanliness >= 80, avg_time_used_pct > 60
- "Fast and messy": avg_time_used_pct <= 45, avg_cleanliness < 75
- "Balanced": all other well-rounded distributions
"""

import os
import json
import re
from typing import Dict, Any, List, Optional
from llm import get_client, MODEL

DISCLAIMER = "A game feature based only on your Chamber performance. Not a hiring assessment or a real offer."

COMPANIES_FILE = os.path.join(os.path.dirname(__file__), "data", "companies.json")


def load_companies() -> List[Dict[str, Any]]:
    """Loads invented fictional companies configuration."""
    try:
        with open(COMPANIES_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        print(f"Error loading companies.json: {e}")
        return []


def classify_coding_style(metrics: Dict[str, Any]) -> str:
    """
    Pure function: classifies player style into one of 4 archetypes based strictly
    on Chamber telemetry metrics.

    Threshold rules:
    - "Optimal and clean": High cleanliness (>=80), high efficiency (>=0.75), fast/moderate pace (<=60%)
    - "Slow and polished": High cleanliness (>=80), methodical pace (>60%)
    - "Fast and messy": Rapid execution (<=45%), lower cleanliness (<75)
    - "Balanced": Well-rounded telemetry not dominating any extreme
    """
    cleanliness = float(metrics.get("avg_cleanliness", 75.0))
    time_pct = float(metrics.get("avg_time_used_pct", 50.0))
    efficiency = float(metrics.get("non_inefficient_share", 0.8))

    if cleanliness >= 80.0 and efficiency >= 0.75:
        if time_pct <= 60.0:
            return "Optimal and clean"
        else:
            return "Slow and polished"
    elif time_pct <= 45.0 and cleanliness < 75.0:
        return "Fast and messy"
    elif cleanliness >= 80.0 and time_pct > 60.0:
        return "Slow and polished"
    else:
        return "Balanced"


def calculate_normalized_metrics(metrics: Dict[str, Any]) -> Dict[str, float]:
    """
    Normalizes telemetry components into 0-100 scale for weighted sum calculation.
    """
    time_pct = float(metrics.get("avg_time_used_pct", 50.0))
    cleanliness = float(metrics.get("avg_cleanliness", 75.0))
    efficiency_share = float(metrics.get("non_inefficient_share", 0.85))
    hint_dep = float(metrics.get("hint_dependence", 0.0))
    first_try = float(metrics.get("first_try_rate", 0.6))
    best_streak = int(metrics.get("best_streak", 1))

    return {
        "speed": max(0.0, min(100.0, 100.0 - time_pct)),
        "cleanliness": max(0.0, min(100.0, cleanliness)),
        "efficiency": max(0.0, min(100.0, efficiency_share * 100.0)),
        "independence": max(0.0, min(100.0, (1.0 - hint_dep) * 100.0)),
        "first_try": max(0.0, min(100.0, first_try * 100.0)),
        "streak": max(0.0, min(100.0, best_streak * 20.0))
    }


def calculate_company_bid(company: Dict[str, Any], normalized_metrics: Dict[str, float]) -> int:
    """
    Pure function: calculates deterministic bid score (0-100) representing interest level.
    Never calculates or returns salary or real compensation figures.
    """
    weights = company.get("weights", {})
    total = 0.0
    for key, weight in weights.items():
        metric_val = normalized_metrics.get(key, 50.0)
        total += float(weight) * float(metric_val)

    return max(0, min(100, round(total)))


def generate_fallback_bids(
    metrics: Dict[str, Any],
    style: str,
    companies: List[Dict[str, Any]]
) -> Dict[str, Any]:
    """
    Deterministic template fallback when LLM is offline or times out.
    """
    norm = calculate_normalized_metrics(metrics)
    bids = []
    for c in companies:
        score = calculate_company_bid(c, norm)
        bids.append({
            "company_id": c["id"],
            "company_name": c["name"],
            "sector": c.get("sector", ""),
            "role_title": c.get("role_title", "Senior Systems Engineer"),
            "interest_level": score,
            "pitch": c.get("template_pitch", "Your chamber telemetry aligns with our technical standards."),
            "values": c.get("values_description", "")
        })

    analysis = (
        f"Based on your chamber telemetry, your engineering archetype is classified as '{style}'. "
        f"You achieved an average code cleanliness score of {metrics.get('avg_cleanliness', 75)}%, "
        f"solved {int(metrics.get('non_inefficient_share', 0.8) * 100)}% of challenges without asymptotic inefficiency, "
        f"and sustained a peak streak of {metrics.get('best_streak', 1)} chambers. "
        f"Your telemetry demonstrates disciplined problem-solving under pressure."
    )

    return {
        "style": style,
        "metrics": metrics,
        "work_style_analysis": analysis,
        "bids": bids,
        "disclaimer": DISCLAIMER
    }


def generate_bids_and_analysis(
    metrics: Dict[str, Any],
    companies: Optional[List[Dict[str, Any]]] = None
) -> Dict[str, Any]:
    """
    Generates company bids and in-character pitches.
    Computes deterministic scores and uses LLM strictly for a 2-sentence pitch per company
    and a 1-paragraph work-style analysis.
    Validates output length and falls back to templates on any failure.
    """
    if companies is None:
        companies = load_companies()

    style = classify_coding_style(metrics)
    norm = calculate_normalized_metrics(metrics)

    # Precompute deterministic scores for each company
    bid_scores = {}
    for c in companies:
        bid_scores[c["id"]] = calculate_company_bid(c, norm)

    try:
        client = get_client()

        # Build prompt using structured metrics only - NO resume or personal details
        prompt = f"""You are the NEXUS Chamber Evaluator synthesizing fictional corporate bids for a player who completed the coding gauntlet.
IMPORTANT CONSTRAINTS:
1. NEVER mention real company names, real salaries, bonuses, equity, compensation, or job offers. This is an in-game simulated evaluation only.
2. Return strictly valid JSON matching this schema:
{{
  "work_style_analysis": "One single paragraph (under 80 words) describing the player's coding style as '{style}'. Mention their cleanliness ({metrics.get('avg_cleanliness')}%), efficiency ({int(metrics.get('non_inefficient_share', 0.8)*100)}%), and problem solving.",
  "pitches": {{
    "vantablack-systems": "Exactly 2 sentences in-character pitch emphasizing infrastructure and efficiency.",
    "orbitfall": "Exactly 2 sentences in-character pitch emphasizing velocity and rapid iteration.",
    "lumen-forge": "Exactly 2 sentences in-character pitch emphasizing clean code and craftsmanship.",
    "gridwell": "Exactly 2 sentences in-character pitch emphasizing financial ledger precision and zero hint dependence.",
    "cobalt-finch": "Exactly 2 sentences in-character pitch emphasizing balanced architectural versatility."
  }}
}}

Candidate Telemetry:
- Style: {style}
- Average Cleanliness: {metrics.get('avg_cleanliness')}%
- Non-inefficient Share: {int(metrics.get('non_inefficient_share', 0.8)*100)}%
- First Try Rate: {int(metrics.get('first_try_rate', 0.6)*100)}%
- Best Streak: {metrics.get('best_streak')}
- Hint Dependence: {metrics.get('hint_dependence')}
"""

        response = client.chat.completions.create(
            model=MODEL,
            messages=[
                {"role": "system", "content": "You output strict JSON with in-character simulated fictional pitches. No compensation figures."},
                {"role": "user", "content": prompt}
            ],
            response_format={"type": "json_object"},
            temperature=0.3,
            timeout=10.0
        )

        content = response.choices[0].message.content
        data = json.loads(content)

        work_style_analysis = data.get("work_style_analysis", "")
        if not work_style_analysis or len(work_style_analysis) > 600:
            work_style_analysis = (
                f"Based on your chamber telemetry, your engineering archetype is classified as '{style}'. "
                f"You achieved an average code cleanliness score of {metrics.get('avg_cleanliness', 75)}%, "
                f"solved {int(metrics.get('non_inefficient_share', 0.8) * 100)}% of challenges without asymptotic inefficiency, "
                f"and sustained a peak streak of {metrics.get('best_streak', 1)} chambers."
            )

        pitches_dict = data.get("pitches", {})

        bids = []
        for c in companies:
            cid = c["id"]
            pitch = pitches_dict.get(cid, "")
            # Ensure pitch is at most ~2 sentences and not overly long
            if not pitch or len(pitch) > 350:
                pitch = c.get("template_pitch", "Your telemetry meets our architectural standards.")

            bids.append({
                "company_id": cid,
                "company_name": c["name"],
                "sector": c.get("sector", ""),
                "role_title": c.get("role_title", "Senior Systems Engineer"),
                "interest_level": bid_scores[cid],
                "pitch": pitch,
                "values": c.get("values_description", "")
            })

        return {
            "style": style,
            "metrics": metrics,
            "work_style_analysis": work_style_analysis,
            "bids": bids,
            "disclaimer": DISCLAIMER
        }

    except Exception as e:
        print(f"Bids LLM generation failed or timed out: {e}. Using deterministic fallback.")
        return generate_fallback_bids(metrics, style, companies)
