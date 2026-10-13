import os
import sys

# Ensure backend directory is in python path
cur_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.abspath(os.path.join(cur_dir, "..", "backend"))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

# On Vercel serverless environment, configure persistent /tmp paths
if os.environ.get("VERCEL"):
    os.environ.setdefault("DEMO_MODE", "true")
    os.environ.setdefault("MOCK_EXTERNALS", "true")
    os.environ.setdefault("DB_PATH", "/tmp/career_sapling.db")

from main import app
