import os
import sys

# Ensure backend directory is in python path
cur_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.abspath(os.path.join(cur_dir, "..", "backend"))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

# On Vercel serverless environment, configure persistent /tmp paths and defaults
if os.environ.get("VERCEL"):
    os.environ.setdefault("DEMO_MODE", "true")
    os.environ.setdefault("MOCK_EXTERNALS", "true")
    os.environ.setdefault("DB_PATH", "/tmp/career_sapling.db")
    os.environ.setdefault("GITHUB_CLIENT_ID", "Ov23liBNJ2cHPGunM61D")
    os.environ.setdefault("GITHUB_CLIENT_SECRET", "64e733cd2b46cac807c7a086f57782713c426f86")

from main import app
