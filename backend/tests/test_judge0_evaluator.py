import pytest
import json
import base64
import httpx
import secrets
import database
import evaluator
import harness
import judge0
import chamber_engine
from chamber_engine import ChamberState
from main import app
from fastapi.testclient import TestClient

client = TestClient(app)

def get_auth_token(user_id=None, username="cadet"):
    uid_suffix = secrets.token_hex(6)
    unique_github_id = f"test_{user_id}_{uid_suffix}" if user_id is not None else f"cadet_{uid_suffix}"
    token = f"test_token_phase6_{uid_suffix}"
    user = database.upsert_github_user(
        github_id=unique_github_id,
        github_username=f"{username}_{uid_suffix}",
        avatar_url="https://github.com/avatar.png",
        github_token_enc="enc_token",
        email=f"{username}_{uid_suffix}@nexus.test",
        display_name=username
    )
    database.create_session(user["id"], token)
    return token, user["id"]


# ============================================================================
# 1. EVALUATOR AST COMPLEXITY TESTS
# ============================================================================

def test_evaluator_single_loop_is_on():
    code = """
def solve(nums):
    total = 0
    for x in nums:
        total += x
    return total
"""
    res = evaluator.evaluate_code_ast(code, expected_complexity="O(n)")
    assert res["complexity_estimate"] == "O(n) (estimated)"
    assert res["inefficient"] is False


def test_evaluator_nested_loop_is_on2():
    code = """
def solve(nums):
    count = 0
    for i in range(len(nums)):
        for j in range(i + 1, len(nums)):
            if nums[i] == nums[j]:
                count += 1
    return count
"""
    res = evaluator.evaluate_code_ast(code, expected_complexity="O(n)")
    assert res["complexity_estimate"] == "O(n^2) (estimated)"
    assert res["inefficient"] is True


def test_evaluator_triple_loop_is_on3():
    code = """
def solve(grid):
    total = 0
    for i in range(len(grid)):
        for j in range(len(grid)):
            for k in range(len(grid)):
                total += grid[i][j][k]
    return total
"""
    res = evaluator.evaluate_code_ast(code, expected_complexity="O(n^2)")
    assert res["complexity_estimate"] == "O(n^3) (estimated)"
    assert res["inefficient"] is True


def test_evaluator_recursive_fib_flagged_exponential():
    code = """
def fib(n):
    if n <= 1:
        return n
    return fib(n - 1) + fib(n - 2)
"""
    res = evaluator.evaluate_code_ast(code, expected_complexity="O(n)")
    assert res["complexity_estimate"] == "O(2^n) (estimated)"
    assert res["inefficient"] is True


def test_evaluator_hidden_quadratic_in_loop():
    code = """
def find_duplicates(nums):
    seen = []
    dups = []
    for item in nums:
        if item in seen:
            dups.append(item)
        else:
            seen.append(item)
    return dups
"""
    res = evaluator.evaluate_code_ast(code, expected_complexity="O(n)")
    # `item in seen` inside loop adds 1 loop level -> O(n^2)
    assert res["complexity_estimate"] == "O(n^2) (estimated)"
    assert res["inefficient"] is True


def test_evaluator_sorting_adds_nlogn():
    code = """
def sort_items(nums):
    return sorted(nums)
"""
    res = evaluator.evaluate_code_ast(code, expected_complexity="O(n log n)")
    assert res["complexity_estimate"] == "O(n log n) (estimated)"
    assert res["inefficient"] is False


# ============================================================================
# 2. EVALUATOR STATIC SECURITY & PRE-CHECK TESTS
# ============================================================================

def test_evaluator_blocks_forbidden_imports():
    bad_codes = [
        "import os\ndef f(): pass",
        "import subprocess\ndef f(): pass",
        "from socket import socket\ndef f(): pass",
        "import ctypes\ndef f(): pass",
        "import shutil\ndef f(): pass",
        "import requests\ndef f(): pass",
        "import urllib.request\ndef f(): pass",
    ]
    for code in bad_codes:
        check = evaluator.pre_check_code(code)
        assert check["passed"] is False
        assert check["reason"] == "blocked"
        assert len(check["security_flags"]) > 0


def test_evaluator_blocks_forbidden_builtins():
    bad_codes = [
        "def f(): eval('1+1')",
        "def f(): exec('a = 1')",
        "def f(): compile('pass', '', 'exec')",
        "def f(): open('secret.txt', 'r')",
        "def f(): __import__('os')",
    ]
    for code in bad_codes:
        check = evaluator.pre_check_code(code)
        assert check["passed"] is False
        assert check["reason"] == "blocked"


def test_evaluator_handles_syntax_errors():
    bad_code = "def broken(x return x +"
    check = evaluator.pre_check_code(bad_code)
    assert check["passed"] is False
    assert check["reason"] == "syntax_error"
    assert "Syntax error" in check["message"]


def test_evaluator_cleanliness_scoring():
    # Code with bare except, magic numbers, and single letter variable outside loop
    messy_code = """
def process_data(items):
    z = 42
    y = 9999
    try:
        return z * y
    except:
        return 0
"""
    cleanliness, findings = evaluator.evaluate_cleanliness(evaluator.ast.parse(messy_code), messy_code)
    assert cleanliness < 90
    assert any("Bare 'except:'" in f["message"] for f in findings)
    assert any("Magic number" in f["message"] for f in findings)
    assert any("Single-letter" in f["message"] or "Cryptic" in f["message"] for f in findings)


# ============================================================================
# 3. HARNESS TESTS
# ============================================================================

def test_harness_stray_print_does_not_break_grading():
    player_code = """
def solve_drainage(height):
    print("DEBUG: Checking barrier heights...")
    print("DEBUG:", height)
    return 49
"""
    full_prog = harness.build_program(player_code, "solve_drainage")
    assert "__NEXUS_EVAL__:" in full_prog

    # Simulate raw stdout containing player's stray prints followed by harness marker line
    mock_stdout = (
        "DEBUG: Checking barrier heights...\n"
        "DEBUG: [1, 8, 6, 2, 5, 4, 8, 3, 7]\n"
        "__NEXUS_EVAL__:{\"result\": 49}\n"
    )

    parsed = harness.parse_harness_output(mock_stdout)
    assert parsed["found"] is True
    assert parsed["result"] == 49
    assert parsed["error"] is None
    assert "DEBUG: Checking barrier heights..." in parsed["stdout"]


def test_harness_prepare_test_stdin():
    # 1. Assignment string
    s1 = harness.prepare_test_stdin("height = [1, 2, 3]")
    d1 = json.loads(s1)
    assert d1["kwargs"]["height"] == [1, 2, 3]

    # 2. Plain list JSON
    s2 = harness.prepare_test_stdin("[1, 2, 1]")
    d2 = json.loads(s2)
    assert d2["args"][0] == [1, 2, 1]


def test_harness_compare_results():
    assert harness.compare_results(49, 49) is True
    assert harness.compare_results(49, "49") is True
    assert harness.compare_results([0, 1], "[0, 1]") is True
    assert harness.compare_results(True, "true") is True
    assert harness.compare_results(False, "false") is True
    assert harness.compare_results(42, 99) is False


# ============================================================================
# 4. JUDGE0 CLIENT & MOCK TRANSPORT TESTS
# ============================================================================

@pytest.mark.asyncio
async def test_judge0_client_with_mock_transport():
    judge0.reset_language_cache()

    # Mock Judge0 responses
    def handler(request: httpx.Request):
        url = str(request.url)
        if "/languages" in url:
            return httpx.Response(200, json=[
                {"id": 71, "name": "Python (3.8.1)"},
                {"id": 92, "name": "Python (3.11.2)"},
                {"id": 63, "name": "JavaScript (Node.js 12.14.0)"}
            ])
        elif "/submissions/batch" in url and request.method == "POST":
            return httpx.Response(201, json=[
                {"token": "tok_1"},
                {"token": "tok_2"}
            ])
        elif "/submissions/batch" in url and request.method == "GET":
            # Simulate status 3 (Accepted)
            out1 = base64.b64encode(b"__NEXUS_EVAL__:{\"result\": 2}\n").decode()
            out2 = base64.b64encode(b"__NEXUS_EVAL__:{\"result\": 16}\n").decode()
            return httpx.Response(200, json={
                "submissions": [
                    {"token": "tok_1", "status_id": 3, "stdout": out1, "time": "0.012"},
                    {"token": "tok_2", "status_id": 3, "stdout": out2, "time": "0.015"}
                ]
            })
        return httpx.Response(404)

    mock_transport = httpx.MockTransport(handler)
    mock_client = httpx.AsyncClient(transport=mock_transport)
    judge0.set_client(mock_client)

    try:
        # 1. Resolve language ID
        lang_id = await judge0.resolve_python_language_id()
        assert lang_id in (71, 92)

        # 2. Execute batch
        subs = [
            {"source_code": "print(1)", "stdin": ""},
            {"source_code": "print(2)", "stdin": ""}
        ]
        results = await judge0.execute_batch(subs)
        assert len(results) == 2
        assert results[0]["status"] == "passed"
        assert results[1]["status"] == "passed"
        assert results[0]["time_ms"] == 12
    finally:
        judge0.set_client(None)
        await mock_client.aclose()


# ============================================================================
# 5. SUBMIT PIPELINE END-TO-END TESTS (ACCEPTANCE CRITERIA)
# ============================================================================

@pytest.mark.asyncio
async def test_correct_on_solution_passes_chamber_1():
    token, user_id = get_auth_token(username="cadet_pass")
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Enter Chamber 1
    enter_res = client.post("/chambers/1/enter", headers=headers)
    assert enter_res.status_code == 200

    # Mock Judge0 to return correct results for hidden tests [1,2,1]->2 and [4,3,2,1,4]->16
    def handler(request: httpx.Request):
        url = str(request.url)
        if "/languages" in url:
            return httpx.Response(200, json=[{"id": 92, "name": "Python (3.11.2)"}])
        elif "/submissions/batch" in url and request.method == "POST":
            return httpx.Response(201, json=[{"token": "t1"}, {"token": "t2"}])
        elif "/submissions/batch" in url and request.method == "GET":
            out1 = base64.b64encode(b"__NEXUS_EVAL__:{\"result\": 2}\n").decode()
            out2 = base64.b64encode(b"__NEXUS_EVAL__:{\"result\": 16}\n").decode()
            return httpx.Response(200, json={
                "submissions": [
                    {"token": "t1", "status_id": 3, "stdout": out1, "time": "0.010"},
                    {"token": "t2", "status_id": 3, "stdout": out2, "time": "0.012"}
                ]
            })
        return httpx.Response(404)

    mock_client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    judge0.set_client(mock_client)

    try:
        # Correct O(n) Two Pointers solution for max_containment
        optimal_code = """
def max_containment(height: list[int]) -> int:
    left = 0
    right = len(height) - 1
    max_area = 0
    while left < right:
        curr_width = right - left
        curr_height = min(height[left], height[right])
        curr_area = curr_width * curr_height
        if curr_area > max_area:
            max_area = curr_area
        if height[left] < height[right]:
            left += 1
        else:
            right -= 1
    return max_area
"""
        # Run pipeline directly to test synchronously
        await chamber_engine.process_chamber_submission_pipeline(
            user_id=user_id,
            chamber_no=1,
            code=optimal_code
        )

        # Check chamber state: PASSED
        st = chamber_engine.get_or_init_user_chamber_state(user_id, 1)
        assert st["state"] == ChamberState.PASSED

        # Chamber 2 should now be UNLOCKED
        st2 = chamber_engine.get_or_init_user_chamber_state(user_id, 2)
        assert st2["state"] == ChamberState.UNLOCKED

    finally:
        judge0.set_client(None)
        await mock_client.aclose()


@pytest.mark.asyncio
async def test_nested_loop_solution_passes_but_marked_inefficient():
    token, user_id = get_auth_token(username="cadet_ineff")
    headers = {"Authorization": f"Bearer {token}"}

    client.post("/chambers/1/enter", headers=headers)

    # Mock Judge0 to return correct results
    def handler(request: httpx.Request):
        url = str(request.url)
        if "/languages" in url:
            return httpx.Response(200, json=[{"id": 92, "name": "Python (3.11.2)"}])
        elif "/submissions/batch" in url and request.method == "POST":
            return httpx.Response(201, json=[{"token": "t1"}, {"token": "t2"}])
        elif "/submissions/batch" in url and request.method == "GET":
            out1 = base64.b64encode(b"__NEXUS_EVAL__:{\"result\": 2}\n").decode()
            out2 = base64.b64encode(b"__NEXUS_EVAL__:{\"result\": 16}\n").decode()
            return httpx.Response(200, json={
                "submissions": [
                    {"token": "t1", "status_id": 3, "stdout": out1, "time": "0.030"},
                    {"token": "t2", "status_id": 3, "stdout": out2, "time": "0.040"}
                ]
            })
        return httpx.Response(404)

    mock_client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    judge0.set_client(mock_client)

    try:
        # Nested loop O(n^2) brute force solution
        inefficient_code = """
def max_containment(height: list[int]) -> int:
    max_area = 0
    n = len(height)
    for i in range(n):
        for j in range(i + 1, n):
            area = (j - i) * min(height[i], height[j])
            if area > max_area:
                max_area = area
    return max_area
"""
        # Verify AST evaluator flags it inefficient
        eval_res = evaluator.evaluate_code_ast(inefficient_code, "O(n)")
        assert eval_res["complexity_estimate"] == "O(n^2) (estimated)"
        assert eval_res["inefficient"] is True

        # Run pipeline
        await chamber_engine.process_chamber_submission_pipeline(
            user_id=user_id,
            chamber_no=1,
            code=inefficient_code
        )

        # Inefficiency does NOT fail the Chamber; it passes
        st = chamber_engine.get_or_init_user_chamber_state(user_id, 1)
        assert st["state"] == ChamberState.PASSED

    finally:
        judge0.set_client(None)
        await mock_client.aclose()


@pytest.mark.asyncio
async def test_wrong_answer_fails():
    token, user_id = get_auth_token(username="cadet_wrong")
    headers = {"Authorization": f"Bearer {token}"}

    client.post("/chambers/1/enter", headers=headers)

    # Mock Judge0 to return incorrect answers (result: 0 instead of 2 and 16)
    def handler(request: httpx.Request):
        url = str(request.url)
        if "/languages" in url:
            return httpx.Response(200, json=[{"id": 92, "name": "Python (3.11.2)"}])
        elif "/submissions/batch" in url and request.method == "POST":
            return httpx.Response(201, json=[{"token": "t1"}, {"token": "t2"}])
        elif "/submissions/batch" in url and request.method == "GET":
            out1 = base64.b64encode(b"__NEXUS_EVAL__:{\"result\": 0}\n").decode()
            out2 = base64.b64encode(b"__NEXUS_EVAL__:{\"result\": 0}\n").decode()
            return httpx.Response(200, json={
                "submissions": [
                    {"token": "t1", "status_id": 3, "stdout": out1, "time": "0.005"},
                    {"token": "t2", "status_id": 3, "stdout": out2, "time": "0.005"}
                ]
            })
        return httpx.Response(404)

    mock_client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    judge0.set_client(mock_client)

    try:
        wrong_code = """
def max_containment(height: list[int]) -> int:
    return 0
"""
        await chamber_engine.process_chamber_submission_pipeline(
            user_id=user_id,
            chamber_no=1,
            code=wrong_code
        )

        st = chamber_engine.get_or_init_user_chamber_state(user_id, 1)
        assert st["state"] == ChamberState.FAILED

    finally:
        judge0.set_client(None)
        await mock_client.aclose()


@pytest.mark.asyncio
async def test_forbidden_code_is_blocked_without_reaching_judge0():
    token, user_id = get_auth_token(username="cadet_hacker")
    headers = {"Authorization": f"Bearer {token}"}

    client.post("/chambers/1/enter", headers=headers)

    # If Judge0 is called, raise an error to prove it was never reached
    def fail_if_called(request: httpx.Request):
        raise AssertionError("Judge0 was contacted! Forbidden code should be blocked at pre-check.")

    mock_client = httpx.AsyncClient(transport=httpx.MockTransport(fail_if_called))
    judge0.set_client(mock_client)

    try:
        malicious_code = """
import os
def max_containment(height: list[int]) -> int:
    os.system("rm -rf /")
    return 49
"""
        await chamber_engine.process_chamber_submission_pipeline(
            user_id=user_id,
            chamber_no=1,
            code=malicious_code
        )

        st = chamber_engine.get_or_init_user_chamber_state(user_id, 1)
        assert st["state"] == ChamberState.FAILED

    finally:
        judge0.set_client(None)
        await mock_client.aclose()


def test_hidden_tests_never_leave_server():
    token, user_id = get_auth_token(username="cadet_privacy")
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Check enter
    res_enter = client.post("/chambers/1/enter", headers=headers)
    assert res_enter.status_code == 200
    assert "hidden_tests" not in res_enter.text

    # 2. Check current
    res_curr = client.get("/chambers/1/current", headers=headers)
    assert res_curr.status_code == 200
    assert "hidden_tests" not in res_curr.text
    assert "[1,2,1]" not in res_curr.text
    assert "[4,3,2,1,4]" not in res_curr.text


@pytest.mark.asyncio
async def test_construct_run_endpoint():
    token, user_id = get_auth_token(username="cadet_construct")
    headers = {"Authorization": f"Bearer {token}"}

    # Mock Judge0 for two-sum public examples: nums=[2,7,11,15], target=9 -> [0,1]
    def handler(request: httpx.Request):
        url = str(request.url)
        if "/languages" in url:
            return httpx.Response(200, json=[{"id": 92, "name": "Python (3.11.2)"}])
        elif "/submissions/batch" in url and request.method == "POST":
            return httpx.Response(201, json=[{"token": "t1"}, {"token": "t2"}])
        elif "/submissions/batch" in url and request.method == "GET":
            out1 = base64.b64encode(b"__NEXUS_EVAL__:{\"result\": [0, 1]}\n").decode()
            out2 = base64.b64encode(b"__NEXUS_EVAL__:{\"result\": [1, 2]}\n").decode()
            return httpx.Response(200, json={
                "submissions": [
                    {"token": "t1", "status_id": 3, "stdout": out1, "time": "0.010"},
                    {"token": "t2", "status_id": 3, "stdout": out2, "time": "0.010"}
                ]
            })
        return httpx.Response(404)

    mock_client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    judge0.set_client(mock_client)

    try:
        run_code = """
class Solution:
    def twoSum(self, nums: list[int], target: int) -> list[int]:
        lookup = {}
        for i, num in enumerate(nums):
            comp = target - num
            if comp in lookup:
                return [lookup[comp], i]
            lookup[num] = i
        return []
"""
        res = client.post("/construct/run", headers=headers, json={
            "prompt_id": "two-sum",
            "code": run_code
        })
        assert res.status_code == 200
        data = res.json()
        assert data["success"] is True
        assert len(data["results"]) == 2
        assert data["results"][0]["passed"] is True
    finally:
        judge0.set_client(None)
        await mock_client.aclose()
