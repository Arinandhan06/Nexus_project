"""
backend/scripts/seed_demo.py - Seed Demo Cadet Profile (DEMO_MODE=true)

Creates a demo player account with Chambers 1-3 passed, historical matrix telemetry,
and NXP ledger records for immediate presentation with zero manual onboarding.
"""

import os
import sys
import sqlite3
import json
from datetime import datetime, timedelta

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import database

def seed_demo_player():
    # Enforce DEMO_MODE requirement
    if os.getenv("DEMO_MODE", "").lower() not in ("true", "1", "yes"):
        print("[!] Warning: DEMO_MODE is not set to 'true'. Setting DEMO_MODE=true for seed execution.")
        os.environ["DEMO_MODE"] = "true"

    database.init_db()

    conn = sqlite3.connect(database.DB_PATH)
    cursor = conn.cursor()

    demo_github_id = "demo_cadet_8888"
    demo_username = "cadet_nova"
    demo_token = "nexus_demo_token_8888"

    # 1. Upsert demo user
    cursor.execute("SELECT id FROM users WHERE github_id = ?", (demo_github_id,))
    row = cursor.fetchone()
    if row:
        user_id = row[0]
        cursor.execute("""
            UPDATE users
            SET github_username = ?, full_name = ?, email = ?, avatar_url = ?
            WHERE id = ?
        """, (demo_username, "Cadet Nova", "nova@nexus.ai", "https://avatars.githubusercontent.com/u/9919", user_id))
    else:
        cursor.execute("""
            INSERT INTO users (github_id, github_username, full_name, email, avatar_url)
            VALUES (?, ?, ?, ?, ?)
        """, (demo_github_id, demo_username, "Cadet Nova", "nova@nexus.ai", "https://avatars.githubusercontent.com/u/9919"))
        user_id = cursor.lastrowid

    # 2. Setup 7-day demo session
    cursor.execute("DELETE FROM sessions WHERE user_id = ?", (user_id,))
    expires_at = (datetime.now() + timedelta(days=7)).isoformat()
    cursor.execute("""
        INSERT INTO sessions (token, user_id, expires_at)
        VALUES (?, ?, ?)
    """, (demo_token, user_id, expires_at))

    # 3. Create mock skill tree & schedule
    skill_tree_data = {
        "skill_tree": [
            {"category": "Core Algorithms", "skills": [{"name": "Two Pointers", "level": "proficient"}, {"name": "Sliding Window", "level": "proficient"}]},
            {"category": "Data Structures", "skills": [{"name": "Hash Maps", "level": "proficient"}, {"name": "Binary Search Trees", "level": "familiar"}]},
            {"category": "Systems & Concurrency", "skills": [{"name": "Rate Limiting", "level": "proficient"}, {"name": "Caching", "level": "familiar"}]}
        ],
        "weaknesses": [
            {"name": "Dynamic Programming", "reason": "Chamber 4 trial ahead"},
            {"name": "Graph Traversal", "reason": "Advanced topological sort trial pending"}
        ]
    }
    schedule_data = {
        "schedule": [
            {"day": i, "topic": f"Sector Trial {i}", "taunt": f"Protocol sequence {i} awaits."}
            for i in range(1, 31)
        ],
        "taunts": ["NEXUS observes your steady progress, Cadet Nova.", "Chamber 4 will test your true endurance."]
    }

    # 4. Upsert Player Profile (3 Chambers passed, current Chamber 4, streak 3, total NXP 875)
    cursor.execute("""
        INSERT INTO player_profile (
            user_id, total_nxp, current_streak, best_streak, current_chamber,
            dsa_score, system_design_score, cleanliness_score,
            onboarding_complete, intro_seen, schedule_json, skill_tree_json
        ) VALUES (?, 875, 3, 3, 4, 78, 72, 85, 1, 1, ?, ?)
        ON CONFLICT(user_id) DO UPDATE SET
            total_nxp = 875,
            current_streak = 3,
            best_streak = 3,
            current_chamber = 4,
            dsa_score = 78,
            system_design_score = 72,
            cleanliness_score = 85,
            onboarding_complete = 1,
            intro_seen = 1,
            schedule_json = excluded.schedule_json,
            skill_tree_json = excluded.skill_tree_json
    """, (user_id, json.dumps(schedule_data), json.dumps(skill_tree_data)))

    # 5. Seed Chamber States (Chambers 1-3 PASSED, 4 UNLOCKED, 5-6 LOCKED)
    cursor.execute("DELETE FROM chamber_state WHERE user_id = ?", (user_id,))
    chamber_states = [
        (1, "PASSED", 1),
        (2, "PASSED", 1),
        (3, "PASSED", 2),
        (4, "UNLOCKED", 0),
        (5, "LOCKED", 0),
        (6, "LOCKED", 0)
    ]
    for ch_no, state_str, att in chamber_states:
        cursor.execute("""
            INSERT INTO chamber_state (user_id, chamber_no, state, attempts)
            VALUES (?, ?, ?, ?)
        """, (user_id, ch_no, state_str, att))

    # 6. Seed NXP Ledger Rows
    cursor.execute("DELETE FROM nxp_ledger WHERE user_id = ?", (user_id,))
    ledger_rows = [
        (1, 150, 1, "Chamber 1 clearance bonus"),
        (2, 300, 2, "Chamber 2 clearance bonus"),
        (3, 425, 3, "Chamber 3 clearance bonus")
    ]
    for ch_no, pts, streak, reason in ledger_rows:
        cursor.execute("""
            INSERT INTO nxp_ledger (user_id, chamber_no, points, streak_after, reason)
            VALUES (?, ?, ?, ?, ?)
        """, (user_id, ch_no, pts, streak, reason))

    # 7. Seed Matrix History Rows
    cursor.execute("DELETE FROM matrix_history WHERE user_id = ?", (user_id,))
    history_entries = [
        (65, 58, 72, 150),
        (72, 65, 78, 450),
        (78, 72, 85, 875)
    ]
    for dsa, sd, cl, nxp in history_entries:
        cursor.execute("""
            INSERT INTO matrix_history (user_id, dsa, system_design, cleanliness, total_nxp)
            VALUES (?, ?, ?, ?, ?)
        """, (user_id, dsa, sd, cl, nxp))

    # 8. Seed Finale State (Completed with scores so Bids and Trophy can be demoed)
    cursor.execute("DELETE FROM finale_state WHERE user_id = ?", (user_id,))
    cursor.execute("""
        INSERT INTO finale_state (user_id, round, state, started_at, deadline_at, scores_json)
        VALUES (?, 4, 'COMPLETED', CURRENT_TIMESTAMP, NULL, ?)
    """, (user_id, json.dumps({
        "coding": {"passed": True, "score": 100},
        "quiz": {"score": 80},
        "design": {"score": 85},
        "overall": {"score": 88, "passed": True}
    })))

    conn.commit()
    conn.close()

    print("==================================================================")
    print("[OK] NEXUS DEMO CADET PROFILE SEEDED SUCCESSFULLY")
    print("==================================================================")
    print(f"Cadet Handle:    {demo_username} (Cadet Nova)")
    print(f"User ID:         {user_id}")
    print(f"Auth Token:      {demo_token}")
    print("Progress:        Chambers 1, 2, 3 PASSED // Chamber 4 UNLOCKED")
    print("Matrix Scores:   DSA: 78 | System Design: 72 | Cleanliness: 85")
    print("NXP Total:       875 NXP (Streak: 3)")
    print(f"Session Expiry:  7 days ({expires_at})")
    print("------------------------------------------------------------------")
    print("To use in the browser, navigate to:")
    print(f"  http://localhost:5173/auth/callback#token={demo_token}")
    print("==================================================================")

if __name__ == "__main__":
    seed_demo_player()
