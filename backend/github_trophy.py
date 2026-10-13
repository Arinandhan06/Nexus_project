"""
github_trophy.py - GitHub Profile README Trophy Integration (SCRUM-30)

Pure string functions for deterministic marker insertion/replacement and idempotency,
plus GitHub REST API integration for user-consented profile README updates.

Security Guarantees:
- Nothing is written to GitHub without explicit player confirmation ({confirm: True}).
- Tokens are decrypted strictly in memory and never logged or exposed in responses.
- Touches ONLY README.md in the player's personal profile repository ({login}/{login}).
- Verification status is reported exactly as returned by GitHub's API.
"""

import base64
import difflib
from datetime import datetime
from typing import Dict, Any, Tuple, Optional
import httpx
from fastapi import HTTPException, status

from contextlib import asynccontextmanager

START_MARKER = "<!-- NEXUS-TROPHY:START -->"
END_MARKER = "<!-- NEXUS-TROPHY:END -->"



def generate_trophy_block(
    total_nxp: int,
    chambers_completed: int = 6,
    awarded_date: Optional[str] = None,
    crlf: bool = False
) -> str:
    """
    Generates the trophy markdown block bounded by canonical markers.
    Never includes any resume data or personal details.
    """
    date_str = awarded_date or datetime.utcnow().strftime("%Y-%m-%d")
    sep = "\r\n" if crlf else "\n"

    badge_url = "https://img.shields.io/badge/NEXUS-Code_Awakened-00f0ff?style=for-the-badge&logo=shield&logoColor=white"
    nxp_badge = f"https://img.shields.io/badge/NXP-{total_nxp}-a855f7?style=for-the-badge"
    chamber_badge = f"https://img.shields.io/badge/CHAMBERS-{chambers_completed}%2F6-22c55e?style=for-the-badge"

    lines = [
        START_MARKER,
        "### ⚡ NEXUS // CODE AWAKENED",
        f"[![NEXUS: Code Awakened]({badge_url})](https://github.com) [![Chambers]({chamber_badge})](https://github.com) [![NXP]({nxp_badge})](https://github.com)",
        f"> *Concluded the adversarial coding simulation on {date_str}. All {chambers_completed} Chambers conquered.*",
        END_MARKER
    ]

    return sep.join(lines)


def update_readme_trophy(original_readme: str, trophy_block: str) -> Tuple[str, bool]:
    """
    Pure function: inserts or replaces ONLY the block between
    <!-- NEXUS-TROPHY:START --> and <!-- NEXUS-TROPHY:END -->.
    Leaves everything else byte-for-byte unchanged.

    Handles:
    - Windows line endings (\\r\\n) and Unix line endings (\\n)
    - READMEs with no trailing newline
    - Empty READMEs
    - Idempotency (if identical trophy is already present, returns already_claimed=True)

    Returns:
        tuple (updated_readme: str, already_claimed: bool)
    """
    is_crlf = "\r\n" in original_readme
    sep = "\r\n" if is_crlf else "\n"

    # Normalize trophy_block to match document line endings
    norm_block = trophy_block.replace("\r\n", "\n").replace("\n", sep)

    start_idx = original_readme.find(START_MARKER)
    end_idx = original_readme.find(END_MARKER)

    if start_idx != -1 and end_idx != -1 and end_idx >= start_idx:
        # Markers exist: replace everything between start and end (inclusive)
        end_idx += len(END_MARKER)
        current_block = original_readme[start_idx:end_idx]

        if current_block.strip() == norm_block.strip():
            return original_readme, True

        updated = original_readme[:start_idx] + norm_block + original_readme[end_idx:]
        return updated, False
    else:
        # Markers do not exist: append to the end
        if not original_readme:
            return norm_block + sep, False

        if original_readme.endswith(sep):
            updated = original_readme + norm_block + sep
        elif original_readme.endswith("\n") or original_readme.endswith("\r"):
            updated = original_readme + norm_block + sep
        else:
            updated = original_readme + sep + sep + norm_block + sep

        return updated, False


def compute_readme_diff(original: str, updated: str) -> str:
    """Computes a unified diff string between original and updated README."""
    orig_lines = original.splitlines(keepends=True)
    upd_lines = updated.splitlines(keepends=True)
    diff = difflib.unified_diff(
        orig_lines,
        upd_lines,
        fromfile="README.md (current)",
        tofile="README.md (with trophy)",
        n=3
    )
    return "".join(diff)


class GitHubTrophyClient:
    """
    Client for interacting with GitHub REST API using the user's decrypted OAuth token.
    Enforces that token is never logged and only profile repository is touched.
    """

    def __init__(self, token: str, login: str, http_client: Optional[httpx.AsyncClient] = None):
        self.token = token
        self.login = login
        self.http_client = http_client
        self.base_url = "https://api.github.com"
        self.headers = {
            "Authorization": f"Bearer {token}",
            "Accept": "application/vnd.github.v3+json",
            "User-Agent": "Nexus-Code-Awakening/1.0"
        }

    @asynccontextmanager
    async def _session(self):
        if self.http_client is not None:
            yield self.http_client
        else:
            async with httpx.AsyncClient(timeout=20.0) as client:
                yield client

    def _should_mock_externals(self) -> bool:
        import os
        return self.http_client is None and os.getenv("MOCK_EXTERNALS", "").lower() in ("true", "1", "yes")

    def _check_rate_limit(self, response: httpx.Response):
        rem = response.headers.get("x-ratelimit-remaining")
        reset_ts = response.headers.get("x-ratelimit-reset")
        if response.status_code == 403 and rem == "0":
            reset_time = ""
            if reset_ts:
                try:
                    dt = datetime.utcfromtimestamp(int(reset_ts))
                    reset_time = f" Reset time: {dt.strftime('%H:%M:%S UTC')}."
                except Exception:
                    pass
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"GitHub API rate limit exceeded.{reset_time}"
            )

    async def get_profile_readme(self) -> Dict[str, Any]:
        """
        Fetches the user's profile README from https://api.github.com/repos/{login}/{login}/contents/README.md.
        """
        if self._should_mock_externals():
            return {
                "repo_name": f"{self.login}/{self.login}",
                "repo_exists": True,
                "readme_exists": True,
                "content": f"# Hi, I'm {self.login}!\nWelcome to my developer profile.\n",
                "sha": "mock_readme_sha_123"
            }

        async with self._session() as client:
            # 1. Check if profile repo exists
            repo_res = await client.get(
                f"{self.base_url}/repos/{self.login}/{self.login}",
                headers=self.headers
            )
            self._check_rate_limit(repo_res)

            if repo_res.status_code == 401:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="GitHub token expired or revoked. Please log in again."
                )
            if repo_res.status_code == 404:
                return {
                    "repo_name": f"{self.login}/{self.login}",
                    "repo_exists": False,
                    "readme_exists": False,
                    "content": "",
                    "sha": None
                }

            # 2. Check if README exists in the repo
            readme_res = await client.get(
                f"{self.base_url}/repos/{self.login}/{self.login}/contents/README.md",
                headers=self.headers
            )
            self._check_rate_limit(readme_res)

            if readme_res.status_code == 404:
                return {
                    "repo_name": f"{self.login}/{self.login}",
                    "repo_exists": True,
                    "readme_exists": False,
                    "content": "",
                    "sha": None
                }

            if readme_res.status_code == 200:
                data = readme_res.json()
                raw_b64 = data.get("content", "")
                decoded = ""
                if raw_b64:
                    try:
                        decoded = base64.b64decode(raw_b64).decode("utf-8")
                    except Exception:
                        decoded = ""
                return {
                    "repo_name": f"{self.login}/{self.login}",
                    "repo_exists": True,
                    "readme_exists": True,
                    "content": decoded,
                    "sha": data.get("sha")
                }

            raise HTTPException(
                status_code=readme_res.status_code,
                detail=f"GitHub returned unexpected status {readme_res.status_code} fetching README."
            )

    async def create_profile_repo(self) -> bool:
        """
        Creates public {login}/{login} profile repository with auto_init=True if confirmed by user.
        """
        if self._should_mock_externals():
            return True

        async with self._session() as client:
            res = await client.post(
                f"{self.base_url}/user/repos",
                headers=self.headers,
                json={
                    "name": self.login,
                    "description": "My GitHub Profile",
                    "private": False,
                    "auto_init": True
                }
            )
            self._check_rate_limit(res)
            if res.status_code == 401:
                raise HTTPException(status_code=401, detail="GitHub token expired or revoked.")
            if res.status_code in (200, 201):
                return True
            raise HTTPException(
                status_code=res.status_code,
                detail=f"Failed to create profile repository: {res.text}"
            )

    async def commit_readme_trophy(self, new_content: str, sha: Optional[str]) -> Dict[str, Any]:
        """
        Commits updated README to {login}/{login}.
        Handles 409 sha conflict with single retry.
        Parses commit.verification strictly.
        """
        if self._should_mock_externals():
            return {
                "status": "success",
                "already_claimed": False,
                "commit_sha": "mock_trophy_commit_sha_888",
                "verified": False,
                "verification_reason": "unsigned",
                "message": "Trophy badge committed to your profile README."
            }

        b64_content = base64.b64encode(new_content.encode("utf-8")).decode("utf-8")
        payload = {
            "message": "NEXUS: Code Awakened trophy",
            "content": b64_content
        }
        if sha:
            payload["sha"] = sha

        async with self._session() as client:
            res = await client.put(
                f"{self.base_url}/repos/{self.login}/{self.login}/contents/README.md",
                headers=self.headers,
                json=payload
            )
            self._check_rate_limit(res)

            # 409 Conflict Retry: fetch fresh sha and retry once
            if res.status_code == 409:
                fresh = await self.get_profile_readme()
                if fresh["sha"]:
                    payload["sha"] = fresh["sha"]
                    res = await client.put(
                        f"{self.base_url}/repos/{self.login}/{self.login}/contents/README.md",
                        headers=self.headers,
                        json=payload
                    )
                    self._check_rate_limit(res)

            if res.status_code == 401:
                raise HTTPException(status_code=401, detail="GitHub token expired or revoked.")

            if res.status_code in (200, 201):
                data = res.json()
                verification = data.get("commit", {}).get("verification", {})
                verified = bool(verification.get("verified", False))
                reason = verification.get("reason", "unsigned")

                return {
                    "status": "success",
                    "already_claimed": False,
                    "commit_sha": data.get("commit", {}).get("sha", ""),
                    "verified": verified,
                    "verification_reason": reason,
                    "message": "Trophy badge committed to your profile README."
                }

            raise HTTPException(
                status_code=res.status_code,
                detail=f"GitHub error updating README: {res.text}"
            )
