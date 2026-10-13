import subprocess
import re
import os

patterns = [
    re.compile(r'sk-[a-zA-Z0-9]{20,}'),
    re.compile(r'ghp_[a-zA-Z0-9]{20,}'),
    re.compile(r'github_pat_[a-zA-Z0-9_]{20,}'),
    re.compile(r'(?i)(api_key|client_secret|jwt_secret)\s*[:=]\s*["\'][a-zA-Z0-9_\-]{16,}["\']')
]

print("Scanning git history...")
try:
    out = subprocess.check_output(['git', 'log', '-p', '--all'], encoding='utf-8', errors='ignore')
    findings = []
    for line in out.splitlines():
        if line.startswith(('+', '-')) and not line.startswith(('+++', '---')):
            for p in patterns:
                m = p.search(line)
                if m:
                    # Ignore test fixture tokens
                    if any(ignore in line.lower() for ignore in ['test_', 'dummy', 'example', 'sample', 'fake', 'secret_token_123', 'mock']):
                        continue
                    findings.append(line.strip())

    print(f"Total suspicious lines in git log: {len(findings)}")
    for f in findings[:20]:
        print("  Found:", f)
except Exception as e:
    print("Git log error:", e)

print("\nScanning working tree files (excluding .git, node_modules, venv)...")
for root, dirs, files in os.walk('.'):
    dirs[:] = [d for d in dirs if d not in ['.git', 'node_modules', 'venv', '.pytest_cache', '__pycache__']]
    for file in files:
        if file.endswith(('.py', '.js', '.jsx', '.json', '.env', '.md', '.yml', '.yaml')):
            filepath = os.path.join(root, file)
            try:
                with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
                    for lno, line in enumerate(f, 1):
                        for p in patterns:
                            if p.search(line):
                                if any(ignore in line.lower() for ignore in ['test_', 'dummy', 'example', 'sample', 'fake', 'secret_token_123', 'mock', 'placeholder']):
                                    continue
                                print(f"  Working tree: {filepath}:{lno}: {line.strip()}")
            except Exception:
                pass
print("Scan complete.")
