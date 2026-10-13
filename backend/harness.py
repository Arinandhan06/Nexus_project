import sys
import json
import ast
import re

MARKER = "__NEXUS_EVAL__:"

def build_program(player_code: str, entry_point: str) -> str:
    """
    Appends the evaluation harness to the player's source code.
    Reads JSON from stdin, invokes entry_point, and outputs result on MARKER line.
    Stray print() calls by the player remain on stdout and do not corrupt the marker line.
    """
    harness_template = f"""

# --- NEXUS TEST HARNESS (PHASE 6) ---
import sys as __sys
import json as __json

__MARKER = "{MARKER}"

def __nexus_execute_harness():
    try:
        __raw_in = __sys.stdin.read().strip()
        if not __raw_in:
            __args = []
            __kwargs = {{}}
        else:
            __payload = __json.loads(__raw_in)
            if isinstance(__payload, dict) and ("args" in __payload or "kwargs" in __payload):
                __args = __payload.get("args", [])
                __kwargs = __payload.get("kwargs", {{}})
            elif isinstance(__payload, list):
                __args = __payload
                __kwargs = {{}}
            else:
                __args = [__payload]
                __kwargs = {{}}

        # Locate entry_point function or class Solution method
        __fn = globals().get("{entry_point}")
        if __fn is None and "Solution" in globals():
            __sol_inst = globals()["Solution"]()
            __fn = getattr(__sol_inst, "{entry_point}", None)

        if __fn is None:
            print(f"{{__MARKER}}" + __json.dumps({{"error": "EntryPointNotFound: '{entry_point}' not found in code"}}))
            return

        __res = __fn(*__args, **__kwargs)
        print(f"{{__MARKER}}" + __json.dumps({{"result": __res}}))
    except Exception as __e:
        import traceback as __tb
        print(f"{{__MARKER}}" + __json.dumps({{"error": str(__e), "type": type(__e).__name__}}))

if __name__ == "__main__":
    __nexus_execute_harness()
"""
    return player_code + harness_template

def prepare_test_stdin(raw_input: any) -> str:
    """
    Normalizes test inputs (strings like 'height = [1,2,3]', 'sensors = [3,3], target = 6',
    JSON lists, dicts, or scalars) into JSON format expected by test harness:
    {"args": [...], "kwargs": {...}}
    """
    if raw_input is None:
        return json.dumps({"args": [None], "kwargs": {}})

    if isinstance(raw_input, (list, tuple)):
        return json.dumps({"args": [raw_input], "kwargs": {}})

    if isinstance(raw_input, dict):
        if "args" in raw_input or "kwargs" in raw_input:
            return json.dumps(raw_input)
        return json.dumps({"args": [raw_input], "kwargs": {}})

    if isinstance(raw_input, (int, float, bool)):
        return json.dumps({"args": [raw_input], "kwargs": {}})

    if not isinstance(raw_input, str):
        return json.dumps({"args": [raw_input], "kwargs": {}})

    raw_str = raw_input.strip()

    # 1. Check if raw_str is already a valid JSON literal (e.g. "[1,2,3]" or "42")
    try:
        val = json.loads(raw_str)
        if isinstance(val, dict) and ("args" in val or "kwargs" in val):
            return json.dumps(val)
        return json.dumps({"args": [val], "kwargs": {}})
    except (json.JSONDecodeError, ValueError):
        pass

    # 2. Check if raw_str contains assignment syntax: e.g. "height = [1,2,3]" or "sensors = [3,3], target = 6"
    # Convert assignments into kwargs dict
    kwargs = {}
    args = []

    # Try splitting by comma, respecting brackets and quotes
    parts = re.split(r',\s*(?=[a-zA-Z_][a-zA-Z0-9_]*\s*=)', raw_str)
    has_assignment = False

    for part in parts:
        if "=" in part:
            key, val_expr = part.split("=", 1)
            key = key.strip()
            val_expr = val_expr.strip()
            try:
                # Safely evaluate using ast.literal_eval
                parsed_val = ast.literal_eval(val_expr)
                kwargs[key] = parsed_val
                has_assignment = True
            except Exception:
                try:
                    parsed_val = json.loads(val_expr)
                    kwargs[key] = parsed_val
                    has_assignment = True
                except Exception:
                    # fallback to string
                    kwargs[key] = val_expr
                    has_assignment = True
        else:
            try:
                args.append(ast.literal_eval(part.strip()))
            except Exception:
                args.append(part.strip())

    if has_assignment:
        return json.dumps({"args": args, "kwargs": kwargs})

    # 3. Fallback: ast.literal_eval on whole string
    try:
        parsed = ast.literal_eval(raw_str)
        return json.dumps({"args": [parsed], "kwargs": {}})
    except Exception:
        return json.dumps({"args": [raw_str], "kwargs": {}})

def parse_harness_output(raw_stdout: str) -> dict:
    """
    Parses execution stdout.
    Finds the line starting with MARKER, extracts result/error JSON.
    All other lines are returned as user stdout.
    """
    if not raw_stdout:
        return {
            "found": False,
            "result": None,
            "error": "No output produced",
            "stdout": ""
        }

    lines = raw_stdout.splitlines()
    marker_line = None
    user_lines = []

    for line in lines:
        if line.startswith(MARKER):
            marker_line = line[len(MARKER):].strip()
        else:
            user_lines.append(line)

    user_stdout = "\n".join(user_lines).strip()

    if marker_line is None:
        return {
            "found": False,
            "result": None,
            "error": "Test harness output marker not found",
            "stdout": user_stdout
        }

    try:
        payload = json.loads(marker_line)
        return {
            "found": True,
            "result": payload.get("result"),
            "error": payload.get("error"),
            "stdout": user_stdout
        }
    except Exception as e:
        return {
            "found": False,
            "result": None,
            "error": f"Failed to parse harness payload: {str(e)}",
            "stdout": user_stdout
        }

def compare_results(actual: any, expected_raw: any) -> bool:
    """
    Compares the actual function result against expected test output.
    Gracefully normalizes types (e.g. 'true' -> True, 'None' -> None, '[0,1]' -> [0, 1]).
    """
    if actual == expected_raw:
        return True

    expected_val = expected_raw
    if isinstance(expected_raw, str):
        cleaned = expected_raw.strip()
        if cleaned.lower() == "true":
            expected_val = True
        elif cleaned.lower() == "false":
            expected_val = False
        elif cleaned.lower() == "none" or cleaned.lower() == "null":
            expected_val = None
        else:
            try:
                expected_val = json.loads(cleaned)
            except Exception:
                try:
                    expected_val = ast.literal_eval(cleaned)
                except Exception:
                    expected_val = cleaned

    if actual == expected_val:
        return True

    # If both are lists of numbers/strings, check if identical
    if isinstance(actual, (list, tuple)) and isinstance(expected_val, (list, tuple)):
        if list(actual) == list(expected_val):
            return True

    return False
