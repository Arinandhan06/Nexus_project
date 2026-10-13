import os
import base64
import asyncio
import re
import httpx
from typing import Optional, List, Dict, Any, Tuple

# Environment configurations
JUDGE0_URL = os.getenv("JUDGE0_URL", "http://localhost:2358").rstrip("/")
JUDGE0_API_KEY = os.getenv("JUDGE0_API_KEY", "")
JUDGE0_AUTH_HEADER = os.getenv("JUDGE0_AUTH_HEADER", "X-Auth-Token")

# Global cached Python language ID
_python_language_id: Optional[int] = None
_custom_client: Optional[httpx.AsyncClient] = None

def set_client(client: Optional[httpx.AsyncClient]):
    """Sets a global custom httpx client (e.g. for testing with MockTransport)."""
    global _custom_client
    _custom_client = client

def get_client() -> Tuple[httpx.AsyncClient, bool]:
    """Returns (client, owns_client). If custom client is set, owns_client is False."""
    global _custom_client
    if _custom_client is not None:
        return _custom_client, False
    return httpx.AsyncClient(headers=get_headers(), timeout=15.0), True

# Judge0 status mapping
# 1: In Queue, 2: Processing, 3: Accepted, 4: Wrong Answer, 5: Time Limit Exceeded,
# 6: Compilation Error, 7-12: Runtime Errors (SIGSEGV, SIGXFSZ, SIGFPE, SIGABRT, NZEC, etc.)
# 13: Internal Error, 14: Exec Format Error
STATUS_MAP = {
    3: "passed",
    4: "wrong_answer",
    5: "time_limit",
    6: "compile_error",
}

def get_headers() -> Dict[str, str]:
    headers = {
        "Content-Type": "application/json"
    }
    if JUDGE0_API_KEY:
        headers[JUDGE0_AUTH_HEADER] = JUDGE0_API_KEY
    return headers

def b64_encode(text: str) -> str:
    if text is None:
        return ""
    return base64.b64encode(text.encode("utf-8")).decode("utf-8")

def b64_decode(encoded: Optional[str]) -> str:
    if not encoded:
        return ""
    try:
        return base64.b64decode(encoded).decode("utf-8", errors="replace")
    except Exception:
        return ""

def map_judge0_status(status_id: int) -> str:
    if status_id == 3:
        return "passed"
    if status_id == 4:
        return "wrong_answer"
    if status_id == 5:
        return "time_limit"
    if status_id == 6:
        return "compile_error"
    if 7 <= status_id <= 12:
        return "runtime_error"
    return "internal_error"

def is_mock_externals() -> bool:
    return os.getenv("MOCK_EXTERNALS", "").lower() in ("true", "1", "yes")

def should_use_mock_externals(client: Optional[httpx.AsyncClient] = None) -> bool:
    if not is_mock_externals():
        return False
    if client is not None:
        return False
    return _custom_client is None

async def resolve_python_language_id(client: Optional[httpx.AsyncClient] = None) -> int:
    """
    Calls GET /languages once and resolves Python 3 language ID by NAME.
    Caches the ID in memory. Does not hard-code an ID.
    """
    global _python_language_id
    if _python_language_id is not None:
        return _python_language_id

    if should_use_mock_externals(client):
        _python_language_id = 71
        return 71

    owns_client = False
    if client is None:
        client, owns_client = get_client()

    try:
        resp = await client.get(f"{JUDGE0_URL}/languages")
        resp.raise_for_status()
        languages = resp.json()

        # Prioritize Python 3.x
        matched_id = None
        for lang in languages:
            name = lang.get("name", "")
            if re.search(r"python\s*\(?3", name, re.IGNORECASE):
                matched_id = lang.get("id")
                break

        # Fallback to any python
        if matched_id is None:
            for lang in languages:
                name = lang.get("name", "")
                if "python" in name.lower():
                    matched_id = lang.get("id")
                    break

        if matched_id is None:
            raise RuntimeError("Python language not found on Judge0 instance.")

        _python_language_id = matched_id
        return matched_id
    finally:
        if owns_client:
            await client.aclose()

def reset_language_cache():
    """Allows resetting the language ID cache (useful for tests)."""
    global _python_language_id
    _python_language_id = None

async def execute_batch(
    submissions: List[Dict[str, Any]],
    client: Optional[httpx.AsyncClient] = None,
    timeout_seconds: float = 20.0
) -> List[Dict[str, Any]]:
    """
    Submits a batch of code executions to Judge0 with base64 encoding and polls
    until completion or timeout (20s) with exponential backoff.
    """
    if not submissions:
        return []

    if should_use_mock_externals(client):
        import sys
        import subprocess
        import time as _time
        parsed_results = []
        for sub in submissions:
            source = sub.get("source_code", "")
            stdin_data = sub.get("stdin", "")
            start_t = _time.time()
            try:
                proc = subprocess.run(
                    [sys.executable, "-c", source],
                    input=stdin_data,
                    text=True,
                    capture_output=True,
                    timeout=sub.get("cpu_time_limit", 2.0)
                )
                time_ms = int((_time.time() - start_t) * 1000)
                if proc.returncode == 0:
                    parsed_results.append({
                        "token": "mock_judge0_token",
                        "status_id": 3,
                        "status": "passed",
                        "time_ms": max(1, time_ms),
                        "memory_kb": 12000,
                        "stdout": proc.stdout,
                        "stderr": "",
                        "error_message": ""
                    })
                else:
                    parsed_results.append({
                        "token": "mock_judge0_token",
                        "status_id": 11,
                        "status": "runtime_error",
                        "time_ms": time_ms,
                        "memory_kb": 12000,
                        "stdout": proc.stdout,
                        "stderr": proc.stderr,
                        "error_message": proc.stderr
                    })
            except subprocess.TimeoutExpired:
                parsed_results.append({
                    "token": "mock_judge0_token",
                    "status_id": 5,
                    "status": "time_limit",
                    "time_ms": int(sub.get("cpu_time_limit", 2.0) * 1000),
                    "memory_kb": 12000,
                    "stdout": "",
                    "stderr": "Time limit exceeded",
                    "error_message": "Time limit exceeded"
                })
            except Exception as e:
                parsed_results.append({
                    "token": "mock_judge0_token",
                    "status_id": 13,
                    "status": "internal_error",
                    "time_ms": 0,
                    "memory_kb": 0,
                    "stdout": "",
                    "stderr": str(e),
                    "error_message": "Mock execution error"
                })
        return parsed_results

    owns_client = False
    if client is None:
        client, owns_client = get_client()

    try:
        # 1. Resolve Python language ID dynamically
        lang_id = await resolve_python_language_id(client)

        # 2. Build batch payload with base64 encoding
        formatted_subs = []
        for sub in submissions:
            formatted_subs.append({
                "language_id": lang_id,
                "source_code": b64_encode(sub.get("source_code", "")),
                "stdin": b64_encode(sub.get("stdin", "")),
                "cpu_time_limit": sub.get("cpu_time_limit", 2.0),
                "memory_limit": sub.get("memory_limit", 128000),
            })

        # 3. POST batch submissions
        post_url = f"{JUDGE0_URL}/submissions/batch?base64_encoded=true"
        post_resp = await client.post(post_url, json={"submissions": formatted_subs})
        post_resp.raise_for_status()
        tokens_data = post_resp.json()
        tokens = [item["token"] for item in tokens_data if "token" in item]

        if not tokens:
            raise RuntimeError("No submission tokens returned from Judge0 batch creation.")

        tokens_param = ",".join(tokens)
        get_url = f"{JUDGE0_URL}/submissions/batch?tokens={tokens_param}&base64_encoded=true"

        # 4. Poll with exponential backoff up to timeout_seconds
        start_time = asyncio.get_event_loop().time()
        delay = 0.1
        results = None

        while True:
            poll_resp = await client.get(get_url)
            poll_resp.raise_for_status()
            poll_data = poll_resp.json()
            submissions_res = poll_data.get("submissions", [])

            # Check if all completed (status_id > 2)
            all_done = all(sub.get("status_id", 0) > 2 for sub in submissions_res)
            if all_done:
                results = submissions_res
                break

            elapsed = asyncio.get_event_loop().time() - start_time
            if elapsed >= timeout_seconds:
                # Timed out waiting for batch
                results = submissions_res
                break

            await asyncio.sleep(delay)
            delay = min(delay * 1.5, 1.5)

        # 5. Format and map statuses
        parsed_results = []
        for res in results:
            raw_status_id = res.get("status_id", 13)
            mapped_status = map_judge0_status(raw_status_id)

            stdout = b64_decode(res.get("stdout"))
            stderr = b64_decode(res.get("stderr"))
            compile_output = b64_decode(res.get("compile_output"))
            time_val = res.get("time")
            time_ms = int(float(time_val) * 1000) if time_val is not None else 0

            # Safe error message (never show raw internal errors)
            if mapped_status == "internal_error":
                safe_error = "Execution engine encountered an internal error. Please retry."
            else:
                safe_error = stderr or compile_output or res.get("message") or ""

            parsed_results.append({
                "token": res.get("token"),
                "status_id": raw_status_id,
                "status": mapped_status,
                "time_ms": time_ms,
                "memory_kb": res.get("memory", 0),
                "stdout": stdout,
                "stderr": stderr,
                "error_message": safe_error
            })

        return parsed_results

    except Exception as e:
        # Wrap internal client/network errors safely
        error_msg = "Execution engine encountered an internal error. Please retry."
        return [
            {
                "status_id": 13,
                "status": "internal_error",
                "time_ms": 0,
                "memory_kb": 0,
                "stdout": "",
                "stderr": "",
                "error_message": error_msg
            }
            for _ in submissions
        ]
    finally:
        if owns_client:
            await client.aclose()
