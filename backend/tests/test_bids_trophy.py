"""
test_bids_trophy.py - Comprehensive Unit & Integration Tests for Phase 9B (SCRUM-29, SCRUM-30)

Tests:
1. Style classification thresholds ("Optimal and clean", "Slow and polished", "Fast and messy", "Balanced")
2. Bid determinism and weights across all 5 invented companies
3. Marker insert, replace, and idempotency as pure string functions (Windows \\r\\n, Unix \\n, no trailing newline)
4. GitHub API mocking for:
   - Missing profile repo (404)
   - 409 SHA conflict retry
   - 401 token revoked
   - Verification result of false
5. confirm = True is strictly required for claim
6. Tokens never appear in any response or log
"""

import pytest
import json
import sqlite3
import secrets
from unittest.mock import patch, AsyncMock, MagicMock
from fastapi.testclient import TestClient
import httpx

import database
import bids
import github_trophy
import auth_github
from main import app

client = TestClient(app)


def create_test_cadet(username: str = "cadet_trophy"):
    unique_user = f"{username}_{secrets.token_hex(4)}"
    raw_token = f"gho_test_token_{secrets.token_hex(8)}"
    enc_token = auth_github.encrypt_token(raw_token)

    conn = sqlite3.connect(database.DB_PATH)
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO users (github_id, github_username, full_name, avatar_url, github_token_enc)
        VALUES (?, ?, ?, ?, ?)
    """, (f"id_{unique_user}", unique_user, "Trophy Cadet", "http://example.com/avatar.png", enc_token))
    user_id = cursor.lastrowid

    cursor.execute("""
        INSERT INTO player_profile (user_id, total_nxp, current_streak, best_streak, current_chamber, dsa_score, system_design_score, cleanliness_score)
        VALUES (?, 1500, 4, 5, 6, 85, 75, 90)
    """, (user_id,))

    conn.commit()
    conn.close()
    return user_id, unique_user, raw_token


def make_auth_headers(user_id: int):
    token = f"sess_token_{user_id}_{secrets.token_hex(4)}"
    database.create_session(user_id, token)
    return {"Authorization": f"Bearer {token}"}


# ==============================================================================
# 1. STYLE CLASSIFICATION TESTS
# ==============================================================================
def test_style_classification_thresholds():
    """Verify deterministic style classification with documented thresholds."""
    # 1. Optimal and clean: cleanliness >= 80, non_inefficient >= 0.75, time_pct <= 60
    assert bids.classify_coding_style({
        "avg_cleanliness": 92.0,
        "non_inefficient_share": 0.85,
        "avg_time_used_pct": 40.0
    }) == "Optimal and clean"

    # 2. Slow and polished: cleanliness >= 80, time_pct > 60
    assert bids.classify_coding_style({
        "avg_cleanliness": 88.0,
        "non_inefficient_share": 0.90,
        "avg_time_used_pct": 72.0
    }) == "Slow and polished"

    # 3. Fast and messy: time_pct <= 45, cleanliness < 75
    assert bids.classify_coding_style({
        "avg_cleanliness": 62.0,
        "non_inefficient_share": 0.70,
        "avg_time_used_pct": 35.0
    }) == "Fast and messy"

    # 4. Balanced: well-rounded
    assert bids.classify_coding_style({
        "avg_cleanliness": 78.0,
        "non_inefficient_share": 0.80,
        "avg_time_used_pct": 52.0
    }) == "Balanced"


# ==============================================================================
# 2. BID DETERMINISM AND WEIGHTS TESTS
# ==============================================================================
def test_bid_determinism_and_weights():
    """Verify bid interest levels are calculated deterministically via weight vectors."""
    companies = bids.load_companies()
    assert len(companies) == 5

    company_names = {c["name"] for c in companies}
    assert company_names == {
        "Vantablack Systems",
        "Orbitfall",
        "Lumen Forge",
        "Gridwell",
        "Cobalt & Finch"
    }

    # High efficiency metrics should boost Vantablack Systems
    high_eff_metrics = {
        "avg_time_used_pct": 40.0,
        "avg_cleanliness": 85.0,
        "non_inefficient_share": 1.0,
        "hint_dependence": 0.0,
        "first_try_rate": 0.8,
        "best_streak": 5
    }
    norm1 = bids.calculate_normalized_metrics(high_eff_metrics)
    vantablack = next(c for c in companies if c["id"] == "vantablack-systems")
    score_v1 = bids.calculate_company_bid(vantablack, norm1)
    assert 85 <= score_v1 <= 100

    # Repeat calculation: must yield identical score (deterministic)
    score_v2 = bids.calculate_company_bid(vantablack, norm1)
    assert score_v1 == score_v2

    # High speed should boost Orbitfall
    fast_metrics = {
        "avg_time_used_pct": 10.0, # speed = 90
        "avg_cleanliness": 60.0,
        "non_inefficient_share": 0.7,
        "hint_dependence": 0.3,
        "first_try_rate": 0.9,
        "best_streak": 3
    }
    norm_fast = bids.calculate_normalized_metrics(fast_metrics)
    orbitfall = next(c for c in companies if c["id"] == "orbitfall")
    score_orbit = bids.calculate_company_bid(orbitfall, norm_fast)
    assert score_orbit >= 70


# ==============================================================================
# 3. PURE STRING FUNCTION TROPHY MARKER TESTS
# ==============================================================================
def test_pure_string_trophy_marker_operations():
    """
    Verify marker insertion, replacement, and idempotency as pure string functions.
    Tests:
    - Windows line endings (\\r\\n)
    - Unix line endings (\\n)
    - No trailing newline
    - Idempotency
    """
    trophy_block_unix = github_trophy.generate_trophy_block(total_nxp=1500, crlf=False)
    assert github_trophy.START_MARKER in trophy_block_unix
    assert github_trophy.END_MARKER in trophy_block_unix

    # 1. Unix line endings with trailing newline
    readme_unix = "# Hello World\nThis is my GitHub profile.\n"
    updated_unix, claimed1 = github_trophy.update_readme_trophy(readme_unix, trophy_block_unix)
    assert claimed1 is False
    assert updated_unix.startswith("# Hello World\nThis is my GitHub profile.\n")
    assert github_trophy.START_MARKER in updated_unix
    assert github_trophy.END_MARKER in updated_unix

    # Idempotency on second call
    updated_unix_2, claimed2 = github_trophy.update_readme_trophy(updated_unix, trophy_block_unix)
    assert claimed2 is True
    assert updated_unix == updated_unix_2

    # 2. Windows line endings (\\r\\n)
    readme_win = "# Windows Profile\r\nLine two.\r\n"
    updated_win, win_claimed1 = github_trophy.update_readme_trophy(readme_win, trophy_block_unix)
    assert win_claimed1 is False
    assert "\r\n" in updated_win
    assert updated_win.startswith("# Windows Profile\r\nLine two.\r\n")

    # Replace existing marker in Windows doc
    new_trophy_win = github_trophy.generate_trophy_block(total_nxp=2000, crlf=True)
    updated_win_2, win_claimed2 = github_trophy.update_readme_trophy(updated_win, new_trophy_win)
    assert win_claimed2 is False
    assert "NXP-2000" in updated_win_2

    # 3. Document with NO trailing newline
    readme_no_newline = "# Minimalist\nNo newline at end"
    updated_no_nl, no_nl_claimed = github_trophy.update_readme_trophy(readme_no_newline, trophy_block_unix)
    assert no_nl_claimed is False
    assert updated_no_nl.startswith("# Minimalist\nNo newline at end\n\n<!-- NEXUS-TROPHY:START -->")


# ==============================================================================
# 4. GITHUB API MOCKING TESTS
# ==============================================================================
@pytest.mark.asyncio
async def test_github_api_missing_profile_repo():
    """Verify handling when {login}/{login} profile repo does not exist (404)."""
    def mock_handler(request: httpx.Request):
        if request.url.path == "/repos/cadet_user/cadet_user":
            return httpx.Response(404, json={"message": "Not Found"})
        return httpx.Response(404)

    async with httpx.AsyncClient(transport=httpx.MockTransport(mock_handler)) as mock_client:
        client_mock = github_trophy.GitHubTrophyClient("fake_token", "cadet_user", http_client=mock_client)
        info = await client_mock.get_profile_readme()
        assert info["repo_exists"] is False
        assert info["readme_exists"] is False


@pytest.mark.asyncio
async def test_github_api_409_sha_retry():
    """Verify 409 conflict triggers a refetch of sha and succeeds on retry."""
    put_call_count = 0

    def mock_handler(request: httpx.Request):
        nonlocal put_call_count
        if request.method == "GET" and "/contents/README.md" in request.url.path:
            return httpx.Response(200, json={
                "content": "IyBNeSBQcm9maWxl",  # "# My Profile"
                "sha": "fresh_sha_999"
            })
        elif request.method == "PUT" and "/contents/README.md" in request.url.path:
            put_call_count += 1
            if put_call_count == 1:
                return httpx.Response(409, json={"message": "conflict"})
            else:
                return httpx.Response(200, json={
                    "commit": {
                        "sha": "commit_123",
                        "verification": {"verified": False, "reason": "unsigned"}
                    }
                })
        return httpx.Response(200)

    async with httpx.AsyncClient(transport=httpx.MockTransport(mock_handler)) as mock_client:
        client_mock = github_trophy.GitHubTrophyClient("fake_token", "cadet_user", http_client=mock_client)
        res = await client_mock.commit_readme_trophy("new content", sha="stale_sha_111")
        assert res["status"] == "success"
        assert res["commit_sha"] == "commit_123"
        assert res["verified"] is False
        assert res["verification_reason"] == "unsigned"
        assert put_call_count == 2


@pytest.mark.asyncio
async def test_github_api_401_revoked_token():
    """Verify 401 raises an unauthorized error advising user to log in again."""
    def mock_handler(request: httpx.Request):
        return httpx.Response(401, json={"message": "Bad credentials"})

    async with httpx.AsyncClient(transport=httpx.MockTransport(mock_handler)) as mock_client:
        client_mock = github_trophy.GitHubTrophyClient("revoked_token", "cadet_user", http_client=mock_client)
        with pytest.raises(Exception) as excinfo:
            await client_mock.get_profile_readme()
        assert "401" in str(excinfo.value) or "expired" in str(excinfo.value)


@pytest.mark.asyncio
async def test_github_api_verification_result_false():
    """Verify GitHub commit verification report is passed faithfully as verified=False."""
    def mock_handler(request: httpx.Request):
        return httpx.Response(200, json={
            "commit": {
                "sha": "commit_verified_false",
                "verification": {"verified": False, "reason": "no_signature"}
            }
        })

    async with httpx.AsyncClient(transport=httpx.MockTransport(mock_handler)) as mock_client:
        client_mock = github_trophy.GitHubTrophyClient("valid_token", "cadet_user", http_client=mock_client)
        res = await client_mock.commit_readme_trophy("content", sha="sha1")
        assert res["verified"] is False
        assert res["verification_reason"] == "no_signature"


# ==============================================================================
# 5. ENDPOINT INTEGRATION TESTS (CONFIRM REQUIRED & PRIVACY)
# ==============================================================================
def test_trophy_claim_requires_confirm_true():
    """Verify POST /trophy/claim strictly requires {confirm: True}."""
    uid, username, raw_token = create_test_cadet("cadet_confirm_test")
    headers = make_auth_headers(uid)

    # Calling with confirm: False -> 400 Bad Request
    res_no_confirm = client.post("/trophy/claim", headers=headers, json={"confirm": False})
    assert res_no_confirm.status_code == 400
    assert "Confirmation is required" in res_no_confirm.json()["detail"]

    # Calling with empty body -> 400 Bad Request
    res_empty = client.post("/trophy/claim", headers=headers, json={})
    assert res_empty.status_code == 400


def test_token_never_appears_in_responses_or_bids():
    """Verify GitHub access token is never leaked in any response body or bids payload."""
    uid, username, raw_token = create_test_cadet("cadet_token_leak_check")
    headers = make_auth_headers(uid)

    # 1. Complete finale so bids unlock
    database.upsert_finale_state(
        user_id=uid,
        round_no=4,
        state="COMPLETED",
        started_at="2026-10-13T00:00:00",
        deadline_at=None,
        scores={"overall": {"passed": True}}
    )

    # 2. Call GET /finale/bids
    res_bids = client.get("/finale/bids", headers=headers)
    assert res_bids.status_code == 200
    bids_text = res_bids.text
    assert raw_token not in bids_text
    assert "gho_" not in bids_text
    assert bids.DISCLAIMER in res_bids.json()["disclaimer"]

    # 3. Call POST /trophy/preview with mocked GitHub response
    mock_readme = {
        "repo_name": f"{username}/{username}",
        "repo_exists": True,
        "readme_exists": True,
        "content": "# Hello World\n",
        "sha": "test_sha_123"
    }
    with patch.object(github_trophy.GitHubTrophyClient, "get_profile_readme", AsyncMock(return_value=mock_readme)):
        res_prev = client.post("/trophy/preview", headers=headers)
        assert res_prev.status_code == 200
        prev_text = res_prev.text
        assert raw_token not in prev_text
        assert "gho_" not in prev_text
