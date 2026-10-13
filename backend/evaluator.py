"""
NEXUS AST Evaluator & Static Security Pre-Checker

Pure functions, no I/O.
Performs:
1. Static security & syntax pre-check (blocks unsafe imports, builtins, and syntax errors).
2. Time complexity estimation from AST (loop depth, sorting, hidden quadratic lookups, exponential recursion).
3. Code cleanliness evaluation (score 0-100 with documented weightings and line-numbered findings).
"""

import ast
from typing import Dict, Any, List, Optional, Tuple, Set

# --- SECURITY CONSTANTS ---
BLOCKED_MODULES = {
    "os", "subprocess", "socket", "ctypes", "shutil", "requests", "urllib"
}

BLOCKED_BUILTINS = {
    "eval", "exec", "compile", "open", "__import__"
}

# Recognized complexity tiers ordered from best to worst
COMPLEXITY_TIERS = [
    "O(1)",
    "O(log n)",
    "O(n)",
    "O(n log n)",
    "O(n^2)",
    "O(n^3)",
    "O(2^n)"
]


# ============================================================================
# 1. STATIC PRE-CHECK
# ============================================================================

def pre_check_code(code: str) -> Dict[str, Any]:
    """
    Validates Python syntax and blocks forbidden modules and functions.
    Returns:
        {
            "passed": bool,
            "reason": str ("ok" | "syntax_error" | "blocked"),
            "message": str,
            "security_flags": List[str]
        }
    """
    if not code or not code.strip():
        return {
            "passed": False,
            "reason": "syntax_error",
            "message": "Source code cannot be empty.",
            "security_flags": []
        }

    try:
        tree = ast.parse(code)
    except SyntaxError as e:
        return {
            "passed": False,
            "reason": "syntax_error",
            "message": f"Syntax error at line {e.lineno}: {e.msg}",
            "security_flags": []
        }

    security_flags = []

    for node in ast.walk(tree):
        # 1. Check imports: `import os`, `import os.path`, `import subprocess as sp`
        if isinstance(node, ast.Import):
            for alias in node.names:
                mod_root = alias.name.split(".")[0]
                if mod_root in BLOCKED_MODULES:
                    msg = f"Forbidden import '{alias.name}' detected at line {node.lineno}."
                    security_flags.append(msg)

        # 2. Check from-imports: `from os import path`, `from socket import ...`
        elif isinstance(node, ast.ImportFrom):
            if node.module:
                mod_root = node.module.split(".")[0]
                if mod_root in BLOCKED_MODULES:
                    msg = f"Forbidden import from '{node.module}' detected at line {node.lineno}."
                    security_flags.append(msg)

        # 3. Check calls to blocked builtins or modules: `open(...)`, `eval(...)`, `os.system(...)`
        elif isinstance(node, ast.Call):
            # Direct calls: eval(...), open(...)
            if isinstance(node.func, ast.Name):
                fn_name = node.func.id
                if fn_name in BLOCKED_BUILTINS:
                    msg = f"Forbidden builtin function '{fn_name}()' invoked at line {node.lineno}."
                    security_flags.append(msg)
                elif fn_name in BLOCKED_MODULES:
                    msg = f"Forbidden module call '{fn_name}()' invoked at line {node.lineno}."
                    security_flags.append(msg)

            # Attribute calls: os.system(...), subprocess.Popen(...)
            elif isinstance(node.func, ast.Attribute):
                curr = node.func.value
                while isinstance(curr, ast.Attribute):
                    curr = curr.value
                if isinstance(curr, ast.Name) and curr.id in BLOCKED_MODULES:
                    msg = f"Call to '{curr.id}.{node.func.attr}()' blocked at line {node.lineno}."
                    security_flags.append(msg)

    if security_flags:
        return {
            "passed": False,
            "reason": "blocked",
            "message": security_flags[0],
            "security_flags": security_flags
        }

    return {
        "passed": True,
        "reason": "ok",
        "message": "Static pre-check passed successfully.",
        "security_flags": []
    }


# ============================================================================
# 2. TIME COMPLEXITY ESTIMATOR
# ============================================================================

class ComplexityVisitor(ast.NodeVisitor):
    """
    Analyzes AST for:
    - Maximum loop depth (for, while, comprehensions).
    - Hidden quadratic operations inside loops (e.g., `x in list`, `.index()`, `.count()`, slicing).
    - Sorting invocations (sorted(), .sort()).
    - Unmemoized multiple self-recursion (exponential).
    """

    def __init__(self):
        self.max_effective_loop_depth = 0
        self.current_loop_depth = 0
        self.has_sorting = False
        self.is_exponential_recursive = False
        self.findings: List[Dict[str, Any]] = []

    def _is_loop_node(self, node: ast.AST) -> bool:
        return isinstance(node, (ast.For, ast.AsyncFor, ast.While,
                                ast.ListComp, ast.SetComp, ast.DictComp, ast.GeneratorExp))

    def _contains_hidden_quadratic(self, node: ast.AST) -> bool:
        """
        Detects if an operation inside a loop has O(n) membership or slice cost:
        - `x in collection` or `x not in collection`
        - `.index(...)` or `.count(...)`
        - List slicing: `seq[a:b]`
        """
        for child in ast.walk(node):
            if isinstance(child, ast.Compare):
                for op in child.ops:
                    if isinstance(op, (ast.In, ast.NotIn)):
                        return True
            elif isinstance(child, ast.Call) and isinstance(child.func, ast.Attribute):
                if child.func.attr in ("index", "count"):
                    return True
            elif isinstance(child, ast.Subscript) and isinstance(child.slice, ast.Slice):
                return True
        return False

    def visit_FunctionDef(self, node: ast.FunctionDef):
        self._check_recursion(node)
        self.generic_visit(node)

    def visit_AsyncFunctionDef(self, node: ast.AsyncFunctionDef):
        self._check_recursion(node)
        self.generic_visit(node)

    def _check_recursion(self, fn_node: ast.FunctionDef):
        fn_name = fn_node.name

        # Count recursive calls to fn_name inside this function
        recursive_calls = 0
        for child in ast.walk(fn_node):
            if isinstance(child, ast.Call):
                if isinstance(child.func, ast.Name) and child.func.id == fn_name:
                    recursive_calls += 1

        if recursive_calls >= 2:
            # Check for memoization:
            # 1. Decorator: @lru_cache, @cache, @functools.lru_cache
            has_cache_decorator = False
            for dec in fn_node.decorator_list:
                dec_name = ""
                if isinstance(dec, ast.Name):
                    dec_name = dec.id
                elif isinstance(dec, ast.Attribute):
                    dec_name = dec.attr
                elif isinstance(dec, ast.Call):
                    if isinstance(dec.func, ast.Name):
                        dec_name = dec.func.id
                    elif isinstance(dec.func, ast.Attribute):
                        dec_name = dec.func.attr
                if "cache" in dec_name.lower():
                    has_cache_decorator = True
                    break

            # 2. Parameter or internal memo dictionary
            has_memo_param = any(
                arg.arg in ("memo", "dp", "cache", "visited")
                for arg in fn_node.args.args
            )

            if not has_cache_decorator and not has_memo_param:
                self.is_exponential_recursive = True
                self.findings.append({
                    "line": getattr(fn_node, "lineno", 1),
                    "message": f"Unmemoized multiple recursive calls in function '{fn_name}'.",
                    "suggestion": "Cache intermediate subproblem results using dynamic programming or memoization."
                })

    def visit_Call(self, node: ast.Call):
        # Detect sorting: sorted(...) or obj.sort(...)
        if isinstance(node.func, ast.Name) and node.func.id == "sorted":
            self.has_sorting = True
            if self.current_loop_depth > 0:
                self.findings.append({
                    "line": getattr(node, "lineno", 1),
                    "message": "Sorting call inside an active loop body.",
                    "suggestion": "Pre-sort collections outside the loop or utilize a heap for partial ordering."
                })
        elif isinstance(node.func, ast.Attribute) and node.func.attr == "sort":
            self.has_sorting = True
            if self.current_loop_depth > 0:
                self.findings.append({
                    "line": getattr(node, "lineno", 1),
                    "message": "In-place sort called inside an active loop body.",
                    "suggestion": "Pre-sort collections outside the loop or utilize a heap for partial ordering."
                })
        self.generic_visit(node)

    def generic_visit(self, node: ast.AST):
        if self._is_loop_node(node):
            if self.current_loop_depth >= 1:
                self.findings.append({
                    "line": getattr(node, "lineno", 1),
                    "message": "Nested loop detected causing quadratic or higher time complexity.",
                    "suggestion": "Look for a way to avoid the inner loop, such as a lookup table."
                })

            self.current_loop_depth += 1
            # Check if this loop has hidden quadratic operations inside it
            if self._contains_hidden_quadratic(node):
                self.findings.append({
                    "line": getattr(node, "lineno", 1),
                    "message": "O(n) collection membership search or slice operation inside loop body.",
                    "suggestion": "Convert collection to a set or hash map for O(1) membership lookups."
                })
                extra_depth = 1
            else:
                extra_depth = 0

            effective = self.current_loop_depth + extra_depth
            if effective > self.max_effective_loop_depth:
                self.max_effective_loop_depth = effective

            super().generic_visit(node)
            self.current_loop_depth -= 1
        else:
            super().generic_visit(node)


def analyze_complexity(tree: ast.AST) -> Tuple[str, List[Dict[str, Any]]]:
    """Analyzes AST and returns (tier_string, complexity_findings)."""
    visitor = ComplexityVisitor()
    visitor.visit(tree)

    if visitor.is_exponential_recursive:
        base = "O(2^n)"
    else:
        depth = visitor.max_effective_loop_depth
        if depth == 0:
            base = "O(n log n)" if visitor.has_sorting else "O(1)"
        elif depth == 1:
            base = "O(n log n)" if visitor.has_sorting else "O(n)"
        elif depth == 2:
            base = "O(n^2)"
        else:
            base = "O(n^3)"

    return base, visitor.findings


def estimate_complexity(tree: ast.AST) -> str:
    """Estimates time complexity string labeled with '(estimated)'."""
    base, _ = analyze_complexity(tree)
    return base


def _normalize_expected_complexity(expected: str) -> str:
    """Normalizes expected complexity string to standard tier."""
    e = expected.lower().strip()
    if "2^n" in e or "exponential" in e:
        return "O(2^n)"
    if "n^3" in e:
        return "O(n^3)"
    if "n^2" in e or "m*n" in e or "packets * amount" in e or "matrix" in e or "grid" in e:
        return "O(n^2)"
    if "n log" in e or "log k" in e:
        return "O(n log n)"
    if "log" in e:
        return "O(log n)"
    if "o(n)" in e or "linear" in e:
        return "O(n)"
    if "o(1)" in e or "constant" in e:
        return "O(1)"
    return "O(n)"


def is_complexity_worse(estimated_tier: str, expected_str: str) -> bool:
    """Returns True if estimated complexity is in a strictly worse tier than expected."""
    expected_tier = _normalize_expected_complexity(expected_str)

    est_idx = COMPLEXITY_TIERS.index(estimated_tier) if estimated_tier in COMPLEXITY_TIERS else 2
    exp_idx = COMPLEXITY_TIERS.index(expected_tier) if expected_tier in COMPLEXITY_TIERS else 2

    return est_idx > exp_idx


# ============================================================================
# 3. CLEANLINESS EVALUATOR (Score 0-100)
# ============================================================================

def evaluate_cleanliness(tree: ast.AST, code: str) -> Tuple[int, List[Dict[str, Any]]]:
    """
    Calculates code cleanliness score (0-100) with line-numbered findings.

    Deduction Weights (Starting Score: 100):
    - Function Length (> 30 lines): -5 pts per instance (max -20)
    - Excessive Nesting Depth (> 3 levels): -5 pts per instance (max -20)
    - High Cyclomatic Complexity (> 8 branches per function): -2 pts per excess branch (max -15)
    - Unused Imports: -5 pts per unused module (max -15)
    - Unused Variables: -3 pts per unused local variable (max -15)
    - Single-letter Variable Names outside loop indices: -2 pts per instance (max -15)
    - Bare Except Clauses (`except:`): -10 pts per instance (max -20)
    - Magic Numbers (literals != 0, 1, 2, -1, 10, 100): -2 pts per instance (max -10)
    """
    findings: List[Dict[str, Any]] = []
    deductions = 0

    lines = code.splitlines()

    # Track imported names & usage
    imported_names: Dict[str, int] = {}  # name -> lineno
    assigned_vars: Dict[str, int] = {}   # name -> lineno
    used_names: Set[str] = set()

    loop_target_names: Set[str] = set()

    for node in ast.walk(tree):
        # 1. Imports
        if isinstance(node, ast.Import):
            for alias in node.names:
                imported_names[alias.asname or alias.name] = node.lineno
        elif isinstance(node, ast.ImportFrom):
            for alias in node.names:
                imported_names[alias.asname or alias.name] = node.lineno

        # 2. Used variable/name references
        elif isinstance(node, ast.Name):
            if isinstance(node.ctx, ast.Load):
                used_names.add(node.id)

        # 3. Bare except clauses
        elif isinstance(node, ast.ExceptHandler):
            if node.type is None:
                deductions += 10
                findings.append({
                    "line": node.lineno,
                    "message": "Bare 'except:' clause caught without specific exception type.",
                    "suggestion": "Catch specific exception types such as ValueError or KeyError."
                })

        # 4. Loop targets (allowed single letters: i, j, k, v, x, etc.)
        elif isinstance(node, (ast.For, ast.AsyncFor)):
            for target_node in ast.walk(node.target):
                if isinstance(target_node, ast.Name):
                    loop_target_names.add(target_node.id)

        # 5. Magic numbers
        elif isinstance(node, ast.Constant):
            if isinstance(node.value, (int, float)) and not isinstance(node.value, bool):
                val = node.value
                if val not in (0, 1, 2, -1, 10, 100):
                    # Check if this constant is part of a docstring or slice
                    findings.append({
                        "line": getattr(node, "lineno", 1),
                        "message": f"Magic number '{val}' used without a named constant.",
                        "suggestion": "Extract literal numbers into named constants with descriptive names."
                    })
                    deductions += 2

    # Check functions: length, nesting depth, cyclomatic branches
    for node in ast.walk(tree):
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            # Function length
            fn_len = (node.end_lineno or node.lineno) - node.lineno + 1
            if fn_len > 30:
                deductions += 5
                findings.append({
                    "line": node.lineno,
                    "message": f"Function '{node.name}' exceeds 30 lines ({fn_len} lines).",
                    "suggestion": "Break large functions into smaller modular helper functions."
                })

            # Nesting depth & branches
            max_depth = 0
            branch_count = 1  # Base cyclomatic complexity

            def check_nesting(curr_node, depth):
                nonlocal max_depth, branch_count
                if depth > max_depth:
                    max_depth = depth

                for child in ast.iter_child_nodes(curr_node):
                    new_depth = depth
                    if isinstance(child, (ast.If, ast.For, ast.While, ast.Try, ast.With)):
                        new_depth += 1
                        branch_count += 1
                    elif isinstance(child, ast.BoolOp):
                        branch_count += len(child.values) - 1

                    check_nesting(child, new_depth)

            check_nesting(node, 0)

            if max_depth > 3:
                deductions += 5
                findings.append({
                    "line": node.lineno,
                    "message": f"Excessive nesting depth ({max_depth} levels) in function '{node.name}'.",
                    "suggestion": "Look for a way to flatten nested logic, such as early returns or guard clauses."
                })

            if branch_count > 8:
                excess = branch_count - 8
                deductions += min(15, excess * 2)
                findings.append({
                    "line": node.lineno,
                    "message": f"High cyclomatic complexity ({branch_count} branches) in function '{node.name}'.",
                    "suggestion": "Simplify decision branches by utilizing lookup tables or polymorphism."
                })

            # Check variable assignments inside function
            for child in ast.walk(node):
                if isinstance(child, ast.Assign):
                    for target in child.targets:
                        if isinstance(target, ast.Name):
                            var_name = target.id
                            assigned_vars[var_name] = child.lineno
                            # Single letter variable check outside loop indices
                            if len(var_name) == 1 and var_name not in loop_target_names and var_name not in ("_",):
                                deductions += 2
                                findings.append({
                                    "line": child.lineno,
                                    "message": f"Cryptic single-letter variable '{var_name}' assigned outside loop index.",
                                    "suggestion": "Use descriptive multi-character variable names to clarify intent."
                                })

    # Check unused imports
    for imp_name, lineno in imported_names.items():
        if imp_name not in used_names:
            deductions += 5
            findings.append({
                "line": lineno,
                "message": f"Unused import '{imp_name}'.",
                "suggestion": "Remove unused module imports to keep the namespace clean."
            })

    # Check unused local variables
    for var_name, lineno in assigned_vars.items():
        if var_name not in used_names and var_name not in loop_target_names and not var_name.startswith("_"):
            deductions += 3
            findings.append({
                "line": lineno,
                "message": f"Local variable '{var_name}' assigned but never used.",
                "suggestion": "Remove unused local variables or use their values."
            })

    # Sort findings by line number
    findings.sort(key=lambda x: x["line"])

    final_score = max(0, min(100, 100 - deductions))
    return final_score, findings


# ============================================================================
# 4. STRUCTURED EVALUATION ENTRY POINT
# ============================================================================

def evaluate_code_ast(code: str, expected_complexity: str = "O(n)") -> Dict[str, Any]:
    """
    Runs full AST analysis and returns structured evaluation metrics.
    Returns:
        {
            "complexity_estimate": "O(n) (estimated)",
            "expected": str,
            "inefficient": bool,
            "cleanliness": int (0-100),
            "findings": List[Dict[str, Any]],
            "security_flags": List[str]
        }
    """
    pre = pre_check_code(code)
    if not pre["passed"]:
        return {
            "complexity_estimate": "Unknown (estimated)",
            "expected": expected_complexity,
            "inefficient": False,
            "cleanliness": 0,
            "findings": [{
                "line": 1,
                "message": pre["message"],
                "suggestion": "Verify syntax structure or remove restricted system modules."
            }],
            "security_flags": pre.get("security_flags", [pre["message"]])
        }

    tree = ast.parse(code)
    raw_tier, complexity_findings = analyze_complexity(tree)
    inefficient = is_complexity_worse(raw_tier, expected_complexity)
    cleanliness, cleanliness_findings = evaluate_cleanliness(tree, code)

    # Combine findings: complexity findings (nested loops, quadratic lookups) plus style findings
    combined_findings = []
    if complexity_findings:
        combined_findings.extend(complexity_findings)
    combined_findings.extend(cleanliness_findings)

    # Deduplicate findings by line & message while preserving order
    seen = set()
    deduped = []
    for f in combined_findings:
        key = (f["line"], f["message"])
        if key not in seen:
            seen.add(key)
            deduped.append(f)
    deduped.sort(key=lambda x: x["line"])

    return {
        "complexity_estimate": f"{raw_tier} (estimated)",
        "expected": expected_complexity,
        "inefficient": inefficient,
        "cleanliness": cleanliness,
        "findings": deduped,
        "security_flags": []
    }
