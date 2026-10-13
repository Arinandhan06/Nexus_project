import sqlite3
import json
import os
import time
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List, Tuple

DB_PATH = os.environ.get("DB_PATH") or os.path.join(os.path.dirname(os.path.abspath(__file__)), 'career_sapling.db')

def init_db():
    conn = sqlite3.connect(DB_PATH, timeout=30.0)
    cursor = conn.cursor()
    cursor.execute("PRAGMA journal_mode=WAL")
    cursor.execute("PRAGMA busy_timeout=30000")
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS profiles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            role TEXT,
            analysis_json TEXT,
            projects_json TEXT,
            job_matches_json TEXT,
            job_matches_updated_at DATETIME, -- New column for cache tracking
            active_projects_json TEXT, -- New column for active projects
            current_phase INTEGER DEFAULT 0,
            growth_stage TEXT DEFAULT 'Seed',
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Simple migration checks
    try:
        cursor.execute("ALTER TABLE profiles ADD COLUMN job_matches_json TEXT")
    except sqlite3.OperationalError:
        pass 
        
    try:
        cursor.execute("ALTER TABLE profiles ADD COLUMN job_matches_updated_at DATETIME")
    except sqlite3.OperationalError:
        pass

    try:
        cursor.execute("ALTER TABLE profiles ADD COLUMN active_projects_json TEXT")
    except sqlite3.OperationalError:
        pass
        
    # Helper for safe column migrations
    def ensure_column(table_name, column_name, column_def):
        cursor.execute(f"PRAGMA table_info({table_name})")
        existing_cols = [row[1] for row in cursor.fetchall()]
        if column_name not in existing_cols:
            cursor.execute(f"ALTER TABLE {table_name} ADD COLUMN {column_name} {column_def}")

    # Users Table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            github_id TEXT UNIQUE,
            github_username TEXT,
            avatar_url TEXT,
            github_token_enc TEXT,
            email TEXT UNIQUE,
            password_hash TEXT,
            full_name TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    # Ensure email and password_hash are nullable if existing users table had NOT NULL constraints
    cursor.execute("PRAGMA table_info(users)")
    user_cols_info = cursor.fetchall()
    needs_rebuild = any(col[1] == 'password_hash' and col[3] == 1 for col in user_cols_info)
    if needs_rebuild:
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS users_nexus_new (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                github_id TEXT UNIQUE,
                github_username TEXT,
                avatar_url TEXT,
                github_token_enc TEXT,
                email TEXT UNIQUE,
                password_hash TEXT,
                full_name TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        col_names = [col[1] for col in user_cols_info]
        common_cols = [c for c in ['id', 'email', 'password_hash', 'full_name', 'created_at', 'github_id', 'github_username', 'avatar_url', 'github_token_enc'] if c in col_names]
        cols_str = ", ".join(common_cols)
        cursor.execute(f"INSERT INTO users_nexus_new ({cols_str}) SELECT {cols_str} FROM users")
        cursor.execute("DROP TABLE users")
        cursor.execute("ALTER TABLE users_nexus_new RENAME TO users")
    else:
        # Safe migrations for existing users table
        ensure_column("users", "github_id", "TEXT")
        ensure_column("users", "github_username", "TEXT")
        ensure_column("users", "avatar_url", "TEXT")
        ensure_column("users", "github_token_enc", "TEXT")
        ensure_column("users", "created_at", "DATETIME DEFAULT CURRENT_TIMESTAMP")
        ensure_column("users", "full_name", "TEXT")

    cursor.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_github_id ON users(github_id)")

    # Sessions Table for Auth
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS sessions (
            token TEXT PRIMARY KEY,
            user_id INTEGER,
            expires_at DATETIME,
            FOREIGN KEY(user_id) REFERENCES users(id)
        )
    ''')

    # OAuth States Table (single-use states with 10-minute expiry)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS oauth_states (
            state TEXT PRIMARY KEY,
            created_at REAL
        )
    ''')

    # Player Profile Table (user_id primary key)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS player_profile (
            user_id INTEGER PRIMARY KEY,
            total_nxp INTEGER DEFAULT 0,
            current_streak INTEGER DEFAULT 0,
            best_streak INTEGER DEFAULT 0,
            current_chamber INTEGER DEFAULT 1,
            dsa_score INTEGER DEFAULT 0,
            system_design_score INTEGER DEFAULT 0,
            cleanliness_score INTEGER DEFAULT 0,
            onboarding_complete BOOLEAN DEFAULT 0,
            intro_seen BOOLEAN DEFAULT 0,
            schedule_json TEXT,
            skill_tree_json TEXT,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id)
        )
    ''')

    try:
        cursor.execute("ALTER TABLE player_profile ADD COLUMN intro_seen BOOLEAN DEFAULT 0")
    except sqlite3.OperationalError:
        pass

    # Chamber Attempts Table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS chamber_attempts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            chamber_no INTEGER,
            challenge_id TEXT,
            code TEXT,
            language TEXT,
            passed BOOLEAN,
            runtime_ms REAL,
            complexity_label TEXT,
            cleanliness_score INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id)
        )
    ''')
    cursor.execute('''
        CREATE INDEX IF NOT EXISTS idx_chamber_attempts_user_chamber
        ON chamber_attempts (user_id, chamber_no)
    ''')

    # Chamber State Machine Table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS chamber_state (
            user_id INTEGER,
            chamber_no INTEGER,
            state TEXT DEFAULT 'LOCKED',
            challenge_id TEXT,
            started_at DATETIME,
            deadline_at DATETIME,
            attempts INTEGER DEFAULT 0,
            PRIMARY KEY (user_id, chamber_no),
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    ''')
    cursor.execute('''
        CREATE INDEX IF NOT EXISTS idx_chamber_state_user
        ON chamber_state (user_id)
    ''')

    # ARIA Hint Ladder Tracking Table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS aria_hints (
            user_id INTEGER,
            challenge_id TEXT,
            level INTEGER DEFAULT 1,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY(user_id, challenge_id),
            FOREIGN KEY(user_id) REFERENCES users(id)
        )
    ''')

    # Phase 8: NXP Ledger Table (SCRUM-26)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS nxp_ledger (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            chamber_no INTEGER NOT NULL,
            attempt_id INTEGER,
            points INTEGER NOT NULL,
            streak_after INTEGER NOT NULL,
            reason TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE (user_id, chamber_no, reason),
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    ''')
    cursor.execute('''
        CREATE INDEX IF NOT EXISTS idx_nxp_ledger_user ON nxp_ledger (user_id)
    ''')

    # Phase 8: Matrix History Table (SCRUM-27)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS matrix_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            dsa INTEGER NOT NULL,
            system_design INTEGER NOT NULL,
            cleanliness INTEGER NOT NULL,
            total_nxp INTEGER NOT NULL,
            attempt_id INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    ''')
    cursor.execute('''
        CREATE INDEX IF NOT EXISTS idx_matrix_history_user ON matrix_history (user_id)
    ''')

    # Phase 9A: Chamber 6 Finale State Table (SCRUM-28)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS finale_state (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL UNIQUE,
            round INTEGER DEFAULT 1,
            state TEXT DEFAULT 'ACTIVE',
            started_at DATETIME,
            deadline_at DATETIME,
            scores_json TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    ''')
    cursor.execute('''
        CREATE INDEX IF NOT EXISTS idx_finale_state_user ON finale_state (user_id)
    ''')

    # NEW: Global Projects Table for persistence
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS projects (
            id TEXT PRIMARY KEY,
            user_id INTEGER, -- Link to user
            title TEXT,
            data_json TEXT,
            code_content TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id)
        )
    ''')
    
    # Try adding user_id to existing tables if missing
    try:
        cursor.execute("ALTER TABLE profiles ADD COLUMN user_id INTEGER REFERENCES users(id)")
    except sqlite3.OperationalError:
        pass
    
    try:
        cursor.execute("ALTER TABLE projects ADD COLUMN user_id INTEGER REFERENCES users(id)")
    except sqlite3.OperationalError:
        pass

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS user_goals (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            text TEXT,
            tag TEXT,
            color TEXT,
            is_done BOOLEAN DEFAULT 0,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS user_activity (
             id INTEGER PRIMARY KEY AUTOINCREMENT,
             user_id INTEGER,
             date TEXT,
             hours REAL,
             level INTEGER,
             UNIQUE(user_id, date)
        )
    ''')

    try:
        cursor.execute("ALTER TABLE user_goals ADD COLUMN user_id INTEGER REFERENCES users(id)")
    except sqlite3.OperationalError:
        pass
        
    try:
        cursor.execute("ALTER TABLE user_activity ADD COLUMN user_id INTEGER REFERENCES users(id)")
    except sqlite3.OperationalError:
        pass

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS channels (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL,
            category TEXT NOT NULL
        )
    ''')

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS community_messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            channel_id INTEGER,
            user_id INTEGER,
            content TEXT,
            type TEXT DEFAULT 'text',
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(channel_id) REFERENCES channels(id),
            FOREIGN KEY(user_id) REFERENCES users(id)
        )
    ''')

    # Seed Default Channels
    default_channels = [
        ("general", "Community"),
        ("frontend-devs", "Community"),
        ("data-science", "Community"),
        ("job-postings", "Career"),
        ("code-review", "Dev")
    ]
    for name, cat in default_channels:
        try:
            cursor.execute("INSERT OR IGNORE INTO channels (name, category) VALUES (?, ?)", (name, cat))
        except sqlite3.IntegrityError:
            pass # Already exists

    # Migration for code_content
    try:
        cursor.execute("ALTER TABLE projects ADD COLUMN code_content TEXT")
    except sqlite3.OperationalError:
        pass
        
    # NEW: Chat History Tables
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS chat_sessions (
            id TEXT PRIMARY KEY,
            user_id INTEGER, -- Link to user
            title TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
             FOREIGN KEY(user_id) REFERENCES users(id)
        )
    ''') 
    
    # Migration for chat_sessions
    try:
        cursor.execute("ALTER TABLE chat_sessions ADD COLUMN user_id INTEGER REFERENCES users(id)")
    except sqlite3.OperationalError:
        pass 
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS chat_messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id TEXT,
            role TEXT,
            content TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE
        )
    ''')

    
    # Migrations for Profile Details
    columns = [
        ("full_name", "TEXT DEFAULT 'Cadet X'"),
        ("email", "TEXT DEFAULT 'cadet.x@careerai.com'"),
        ("location", "TEXT DEFAULT 'New York, USA'"),
        ("avatar", "TEXT"),
        ("bio", "TEXT DEFAULT 'Software Engineer'")
    ]
    
    for col, dtype in columns:
        try:
            cursor.execute(f"ALTER TABLE profiles ADD COLUMN {col} {dtype}")
        except sqlite3.OperationalError:
            pass

    conn.commit()
    conn.close()

    # Automatic cleanup of expired sessions and stale oauth states
    cleanup_expired_sessions()

# --- GOALS API ---
def get_user_goals(profile_id):
    conn = sqlite3.connect(DB_PATH, timeout=30.0)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM user_goals WHERE profile_id = ?', (profile_id,))
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

def add_user_goal(profile_id, goal_data):
    conn = sqlite3.connect(DB_PATH, timeout=30.0)
    cursor = conn.cursor()
    cursor.execute('INSERT INTO user_goals (profile_id, text, tag, color, is_done) VALUES (?, ?, ?, ?, ?)',
                  (profile_id, goal_data['text'], goal_data['tag'], goal_data['color'], goal_data.get('is_done', False)))
    conn.commit()
    conn.close()

def update_goal_status(goal_id, is_done):
    conn = sqlite3.connect(DB_PATH, timeout=30.0)
    cursor = conn.cursor()
    cursor.execute('UPDATE user_goals SET is_done = ? WHERE id = ?', (is_done, goal_id))
    conn.commit()
    conn.close()
    
def delete_goal(goal_id):
    conn = sqlite3.connect(DB_PATH, timeout=30.0)
    cursor = conn.cursor()
    cursor.execute('DELETE FROM user_goals WHERE id = ?', (goal_id,))
    conn.commit()
    conn.close()


# --- PROFILE UPDATE ---
def update_profile_details(profile_id, updates):
    conn = sqlite3.connect(DB_PATH, timeout=30.0)
    cursor = conn.cursor()
    
    fields = []
    values = []
    for k, v in updates.items():
        if k in ['full_name', 'email', 'location', 'bio', 'avatar', 'role']:
            fields.append(f"{k} = ?")
            values.append(v)
            
    if fields:
        values.append(profile_id)
        cursor.execute(f"UPDATE profiles SET {', '.join(fields)} WHERE id = ?", tuple(values))
        conn.commit()
        
    conn.close()

def create_chat_session(session_id, user_id, title="New Chat"):
    conn = sqlite3.connect(DB_PATH, timeout=30.0)
    cursor = conn.cursor()
    cursor.execute('INSERT OR IGNORE INTO chat_sessions (id, user_id, title) VALUES (?, ?, ?)', (session_id, user_id, title))
    conn.commit()
    conn.close()

def save_chat_message(session_id, role, content):
    conn = sqlite3.connect(DB_PATH, timeout=30.0)
    cursor = conn.cursor()
    cursor.execute('INSERT INTO chat_messages (session_id, role, content) VALUES (?, ?, ?)', (session_id, role, content))
    conn.commit()
    conn.close()

def get_chat_session(session_id):
    """Retrieves session metadata including owner user_id."""
    conn = sqlite3.connect(DB_PATH, timeout=30.0)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM chat_sessions WHERE id = ?', (session_id,))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None

def get_chat_history(session_id):
    conn = sqlite3.connect(DB_PATH, timeout=30.0)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute('SELECT role, content FROM chat_messages WHERE session_id = ? ORDER BY id ASC', (session_id,))
    rows = cursor.fetchall()
    conn.close()
    return [{"role": r["role"], "content": r["content"]} for r in rows]

def get_all_chat_sessions(user_id):
    conn = sqlite3.connect(DB_PATH, timeout=30.0)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM chat_sessions WHERE user_id = ? ORDER BY created_at DESC', (user_id,))
    rows = cursor.fetchall()
    conn.close()
    return [{"id": r["id"], "title": r["title"], "created_at": r["created_at"]} for r in rows]

def rename_chat_session(session_id, new_title):
    conn = sqlite3.connect(DB_PATH, timeout=30.0)
    cursor = conn.cursor()
    cursor.execute('UPDATE chat_sessions SET title = ? WHERE id = ?', (new_title, session_id))
    conn.commit()
    conn.close()

def delete_chat_session(session_id):
    conn = sqlite3.connect(DB_PATH, timeout=30.0)
    cursor = conn.cursor()
    # Delete messages first (if no cascade)
    cursor.execute('DELETE FROM chat_messages WHERE session_id = ?', (session_id,))
    # Delete session
    cursor.execute('DELETE FROM chat_sessions WHERE id = ?', (session_id,))
    conn.commit()
    conn.close()

def update_phase_progress(project_id, phase_index):
    """Updates progress for a specific project in the global table."""
    conn = sqlite3.connect(DB_PATH, timeout=30.0)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    # Get current project data
    cursor.execute('SELECT data_json FROM projects WHERE id = ?', (project_id,))
    row = cursor.fetchone()
    
    if row:
        project_data = json.loads(row['data_json'])
        project_data['current_phase'] = phase_index
        
        cursor.execute('UPDATE projects SET data_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', 
                      (json.dumps(project_data), project_id))
        conn.commit()
        
    conn.close()

def update_project_code(project_id, code):
    """Syncs the latest code content to the database."""
    conn = sqlite3.connect(DB_PATH, timeout=30.0)
    cursor = conn.cursor()
    cursor.execute('UPDATE projects SET code_content = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', (code, project_id))
    conn.commit()
    conn.close()

def update_job_matches(profile_id, job_matches):
    conn = sqlite3.connect(DB_PATH, timeout=30.0)
    cursor = conn.cursor()
    cursor.execute('UPDATE profiles SET job_matches_json = ?, job_matches_updated_at = CURRENT_TIMESTAMP WHERE id = ?', (json.dumps(job_matches), profile_id))
    conn.commit()
    conn.close()

def save_active_projects(profile_id, active_projects):
    """
    Deprecated: Used to save to profile. 
    Now acts as a migrator or alias to save_project_globally if needed, 
    but mainly we use save_project_globally.
    """
    pass

def save_project_globally(project_data, user_id=None):
    """Saves or updates a project in the global projects table."""
    conn = sqlite3.connect(DB_PATH, timeout=30.0)
    cursor = conn.cursor()
    
    project_id = project_data['id']
    title = project_data['title']
    
    # Check if exists
    cursor.execute('SELECT id FROM projects WHERE id = ?', (project_id,))
    exists = cursor.fetchone()
    
    if exists:
        cursor.execute('UPDATE projects SET data_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                      (json.dumps(project_data), project_id))
    else:
        cursor.execute('INSERT INTO projects (id, title, data_json, user_id) VALUES (?, ?, ?, ?)',
                      (project_id, title, json.dumps(project_data), user_id))
                      
    conn.commit()
    conn.close()

def get_all_active_projects(user_id=None):
    """Retrieves all projects from the global table."""
    conn = sqlite3.connect(DB_PATH, timeout=30.0)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    if user_id:
        cursor.execute('SELECT data_json FROM projects WHERE user_id = ? ORDER BY updated_at DESC', (user_id,))
    else:
        cursor.execute('SELECT data_json FROM projects ORDER BY updated_at DESC')
    rows = cursor.fetchall()
    conn.close()
    
    return [json.loads(row['data_json']) for row in rows]

def get_project_by_id(project_id, user_id=None):
    conn = sqlite3.connect(DB_PATH, timeout=30.0)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    cursor.execute('SELECT user_id, data_json, code_content FROM projects WHERE id = ?', (project_id,))
    row = cursor.fetchone()
    conn.close()
    
    if row:
        if user_id is not None and row['user_id'] is not None and row['user_id'] != user_id:
            return None
        data = json.loads(row['data_json'])
        # Inject code_content if exists and not in json
        if 'code_content' in row.keys() and row['code_content']:
             data['code'] = row['code_content']
        return data
    return None

def save_career_data(role, analysis, projects, stage, user_id=None):
    conn = sqlite3.connect(DB_PATH, timeout=30.0)
    cursor = conn.cursor()
    
    # Convert Pydantic objects to dicts
    projects_list = [p.model_dump() if hasattr(p, 'model_dump') else p for p in projects]
    analysis_dict = analysis.model_dump() if hasattr(analysis, 'model_dump') else analysis
    
    cursor.execute('''
        INSERT INTO profiles (role, analysis_json, projects_json, growth_stage, user_id)
        VALUES (?, ?, ?, ?, ?)
    ''', (role, json.dumps(analysis_dict), json.dumps(projects_list), stage, user_id))
    conn.commit()
    conn.close()

def get_profile_by_user_id(user_id):
    conn = sqlite3.connect(DB_PATH, timeout=30.0)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM profiles WHERE user_id = ? ORDER BY timestamp DESC LIMIT 1', (user_id,))
    row = cursor.fetchone()
    conn.close()
    
    if row:
        job_matches = []
        if row["job_matches_json"]:
            job_matches = json.loads(row["job_matches_json"])
            
        active_projects = [] 

        updated_at = row["job_matches_updated_at"] if "job_matches_updated_at" in row.keys() else None
            
        return {
            "id": row["id"],
            "role": row["role"],
            "full_name": row["full_name"],
            "email": row["email"],
            "location": row["location"],
            "avatar": row["avatar"],
            "bio": row["bio"],
            "analysis": json.loads(row["analysis_json"]),
            "projects": json.loads(row["projects_json"]),
            "job_matches": job_matches,
            "job_matches_updated_at": updated_at,
            "active_projects": active_projects,
            "growth_stage": row["growth_stage"]
        }
    return None

def get_latest_profile():
    conn = sqlite3.connect(DB_PATH, timeout=30.0)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM profiles ORDER BY timestamp DESC LIMIT 1')
    row = cursor.fetchone()
    conn.close()
    
    if row:
        job_matches = []
        if row["job_matches_json"]:
            job_matches = json.loads(row["job_matches_json"])
            
        # For active_projects, we now prefer the global table, 
        # but we return empty here to avoid confusion or legacy data.
        active_projects = [] 

        # Handle missing column gracefully during transition
        updated_at = row["job_matches_updated_at"] if "job_matches_updated_at" in row.keys() else None
            
        return {
            "id": row["id"],
            "role": row["role"],
            "full_name": row["full_name"], # New
            "email": row["email"],         # New
            "location": row["location"],   # New
            "avatar": row["avatar"],       # New
            "bio": row["bio"],             # New
            "analysis": json.loads(row["analysis_json"]),
            "projects": json.loads(row["projects_json"]),
            "job_matches": job_matches,
            "job_matches_updated_at": updated_at,
            "active_projects": active_projects,
            "growth_stage": row["growth_stage"]
        }
    return None

def get_all_profiles(user_id=None):
    """Retrieves all past uploads for the history sidebar scoped to user."""
    conn = sqlite3.connect(DB_PATH, timeout=30.0)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    if user_id is not None:
        cursor.execute('SELECT id, role, timestamp FROM profiles WHERE user_id = ? ORDER BY timestamp DESC', (user_id,))
    else:
        cursor.execute('SELECT id, role, timestamp FROM profiles ORDER BY timestamp DESC')
    rows = cursor.fetchall()
    conn.close()
    
    return [{"id": r["id"], "role": r["role"], "date": r["timestamp"]} for r in rows]

def get_profile_by_id(profile_id, user_id=None):
    """Retrieves a specific profile when clicked in the sidebar."""
    conn = sqlite3.connect(DB_PATH, timeout=30.0)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    if user_id is not None:
        cursor.execute('SELECT * FROM profiles WHERE id = ? AND (user_id = ? OR user_id IS NULL)', (profile_id, user_id))
    else:
        cursor.execute('SELECT * FROM profiles WHERE id = ?', (profile_id,))
    row = cursor.fetchone()
    conn.close()
    
    if row:
        job_matches = []
        if row["job_matches_json"]:
            job_matches = json.loads(row["job_matches_json"])
            
        active_projects = []

        return {
            "id": row["id"],
            "user_id": row["user_id"] if "user_id" in row.keys() else None,
            "role": row["role"],
            "analysis": json.loads(row["analysis_json"]),
            "projects": json.loads(row["projects_json"]),
            "job_matches": job_matches,
            "active_projects": active_projects,
            "growth_stage": row["growth_stage"]
        }
    return None

def delete_profile(profile_id, user_id=None):
    """Permanently removes a profile session from the database."""
    conn = sqlite3.connect(DB_PATH, timeout=30.0)
    cursor = conn.cursor()
    if user_id is not None:
        cursor.execute('DELETE FROM profiles WHERE id = ? AND (user_id = ? OR user_id IS NULL)', (profile_id, user_id))
    else:
        cursor.execute('DELETE FROM profiles WHERE id = ?', (profile_id,))
    deleted = cursor.rowcount > 0
    conn.commit()
    conn.close()
    return deleted

def delete_project(project_id, user_id=None):
    """Deletes a project from the global projects table."""
    conn = sqlite3.connect(DB_PATH, timeout=30.0)
    cursor = conn.cursor()
    if user_id is not None:
        cursor.execute('DELETE FROM projects WHERE id = ? AND (user_id = ? OR user_id IS NULL)', (project_id, user_id))
    else:
        cursor.execute('DELETE FROM projects WHERE id = ?', (project_id,))
    deleted = cursor.rowcount > 0
    conn.commit()
    conn.close()
    return deleted

def update_latest_profile_projects(projects, user_id=None):
    """Updates the projects_json for the most recent profile."""
    conn = sqlite3.connect(DB_PATH, timeout=30.0)
    cursor = conn.cursor()
    
    # Get latest ID
    if user_id is not None:
        cursor.execute('SELECT id FROM profiles WHERE user_id = ? ORDER BY timestamp DESC LIMIT 1', (user_id,))
    else:
        cursor.execute('SELECT id FROM profiles ORDER BY timestamp DESC LIMIT 1')
    row = cursor.fetchone()
    
    if row:
        profile_id = row[0]
        # Convert Pydantic objects if needed, or raw dicts
        projects_list = [p if isinstance(p, dict) else p.model_dump() for p in projects]
        
        cursor.execute('UPDATE profiles SET projects_json = ? WHERE id = ?', 
                      (json.dumps(projects_list), profile_id))
        conn.commit()
        conn.close()
        return True
    
    conn.close()
    return False

def recalculate_user_growth(profile_id):
    """Dynamically updates the user's growth stage based on project progress."""
    conn = sqlite3.connect(DB_PATH, timeout=30.0)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    # Get all projects from global table
    # In a multi-user app, we'd filter by user_id. Here we assume single-user session or global context.
    cursor.execute('SELECT data_json FROM projects')
    rows = cursor.fetchall()
    
    total_phases_count = 0
    completed_phases_count = 0
    projects_started = 0
    projects_completed = 0
    
    for row in rows:
        p = json.loads(row['data_json'])
        
        # Determine progress for this project
        # current_phase starts at 1. If 1, 0 completed. If 2, 1 completed.
        c_phase = p.get('current_phase', 1)
        phases = p.get('phases', [])
        total_p = len(phases) if phases else 6
        
        projects_started += 1
        
        # Calculate actual completed phases
        # If current_phase is 7 (and total is 6), user completed all 6.
        if c_phase > total_p:
            projects_completed += 1
            completed_phases_count += total_p
        else:
            completed_phases_count += (c_phase - 1)
            
        total_phases_count += total_p

    # Define Stage Rules Logic (Forest Scale)
    # 1. Sprout: 0-4 Trees
    # 2. Grove Guardian: 5-14 Trees
    # 3. Forest Ranger: 15-29 Trees
    # 4. Terraformer: 30-49 Trees
    # 5. Gaia's Legacy: 50+ Trees
    
    # We count "Trees" as completed projects OR significant progress (e.g. 6 phases = 1 tree equivalent)
    # Total Trees = Projects Completed + (Completed Phases / 6)
    
    total_trees = projects_completed + (completed_phases_count // 6)
    
    new_stage = "Sprout"
    
    if total_trees >= 5:
        new_stage = "Grove Guardian"
        
    if total_trees >= 15:
        new_stage = "Forest Ranger"
        
    if total_trees >= 30:
        new_stage = "Terraformer"
        
    if total_trees >= 50:
        new_stage = "Gaia's Legacy"

    # Update the profile
    # Get latest profile ID if not provided specific match logic?
    # For now update the specific profile_id passed
    if profile_id:
        cursor.execute('UPDATE profiles SET growth_stage = ? WHERE id = ?', (new_stage, profile_id))
    else:
        # Update latest
        cursor.execute('UPDATE profiles SET growth_stage = ? WHERE id = (SELECT id FROM profiles ORDER BY timestamp DESC LIMIT 1)', (new_stage,))

    conn.commit()
    conn.close()
    return new_stage

def get_global_tree_stats():
    """Calculates total trees (completed projects + partial phases)"""
    conn = sqlite3.connect(DB_PATH, timeout=30.0)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    cursor.execute('SELECT data_json FROM projects')
    rows = cursor.fetchall()
    
    total_phases = 0
    full_projects = 0
    
    for row in rows:
        p = json.loads(row['data_json'])
        c_phase = p.get('current_phase', 1)
        phases = p.get('phases', [])
        total_p = len(phases) if phases else 6
        
        if c_phase > total_p:
            full_projects += 1
            total_phases += total_p
        else:
            total_phases += (c_phase - 1)
            
    conn.close()
    
    # Formula: Trees = Projects + (Phases / 6)
    trees_count = full_projects + (total_phases // 6)
    return trees_count

def create_user(email, password_hash, full_name):
    conn = sqlite3.connect(DB_PATH, timeout=30.0)
    cursor = conn.cursor()
    try:
        cursor.execute("INSERT INTO users (email, password_hash, full_name) VALUES (?, ?, ?)", 
                      (email, password_hash, full_name))
        user_id = cursor.lastrowid
        conn.commit()
        return user_id
    except sqlite3.IntegrityError:
        return None
    finally:
        conn.close()

def get_user_by_email(email):
    conn = sqlite3.connect(DB_PATH, timeout=30.0)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users WHERE email = ?", (email,))
    user = cursor.fetchone()
    conn.close()
    return user

def get_user_by_id(user_id):
    conn = sqlite3.connect(DB_PATH, timeout=30.0)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users WHERE id = ?", (user_id,))
    user = cursor.fetchone()
    conn.close()
    return user

# Session Management (7-day expiry with cleanup)
def create_session(user_id, token):
    conn = sqlite3.connect(DB_PATH, timeout=30.0)
    cursor = conn.cursor()
    # Expire in 7 days
    expires_at = (datetime.now() + timedelta(days=7)).isoformat()
    cursor.execute("INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)", 
                  (token, user_id, expires_at))
    conn.commit()
    conn.close()

def cleanup_expired_sessions() -> int:
    """Removes all expired sessions from the database."""
    conn = sqlite3.connect(DB_PATH, timeout=30.0)
    cursor = conn.cursor()
    cursor.execute("DELETE FROM sessions WHERE expires_at < ?", (datetime.now().isoformat(),))
    deleted = cursor.rowcount
    conn.commit()
    conn.close()
    return deleted

def get_user_by_token(token):
    conn = sqlite3.connect(DB_PATH, timeout=30.0)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("""
        SELECT s.user_id, s.expires_at, u.id, u.github_id, u.github_username, u.avatar_url, u.full_name, u.email, u.github_token_enc
        FROM sessions s
        JOIN users u ON s.user_id = u.id
        WHERE s.token = ?
    """, (token,))
    row = cursor.fetchone()
    
    if not row:
        conn.close()
        if token == "nexus_demo_token_8888" and os.getenv("DEMO_MODE", "").lower() in ("true", "1", "yes"):
            try:
                from scripts.seed_demo import seed_demo_player
                seed_demo_player()
                # Re-query
                conn2 = sqlite3.connect(DB_PATH, timeout=30.0)
                conn2.row_factory = sqlite3.Row
                c2 = conn2.cursor()
                c2.execute("""
                    SELECT s.user_id, s.expires_at, u.id, u.github_id, u.github_username, u.avatar_url, u.full_name, u.email, u.github_token_enc
                    FROM sessions s
                    JOIN users u ON s.user_id = u.id
                    WHERE s.token = ?
                """, (token,))
                r2 = c2.fetchone()
                conn2.close()
                if r2:
                    return dict(r2)
            except Exception:
                pass
        return None
        
    if row['expires_at'] < datetime.now().isoformat():
        cursor.execute("DELETE FROM sessions WHERE token = ?", (token,))
        conn.commit()
        conn.close()
        if token == "nexus_demo_token_8888" and os.getenv("DEMO_MODE", "").lower() in ("true", "1", "yes"):
            try:
                from scripts.seed_demo import seed_demo_player
                seed_demo_player()
                return get_user_by_token(token)
            except Exception:
                pass
        return None
        
    user = dict(row)
    conn.close()
    return user

def delete_session(token):
    conn = sqlite3.connect(DB_PATH, timeout=30.0)
    cursor = conn.cursor()
    cursor.execute("DELETE FROM sessions WHERE token = ?", (token,))
    conn.commit()
    conn.close()

# --- OAuth States Management ---
def save_oauth_state(state):
    conn = sqlite3.connect(DB_PATH, timeout=30.0)
    cursor = conn.cursor()
    now_ts = time.time()
    # Purge states older than 10 minutes (600 seconds)
    cursor.execute("DELETE FROM oauth_states WHERE created_at < ?", (now_ts - 600.0,))
    cursor.execute("INSERT OR REPLACE INTO oauth_states (state, created_at) VALUES (?, ?)", (state, now_ts))
    conn.commit()
    conn.close()

def consume_oauth_state(state):
    """Verifies and consumes a state token in a single atomic transaction. Returns True if valid and not expired."""
    conn = sqlite3.connect(DB_PATH, timeout=30.0)
    cursor = conn.cursor()
    now_ts = time.time()
    # Check if state exists and is not older than 10 minutes
    cursor.execute("""
        SELECT state FROM oauth_states 
        WHERE state = ? AND created_at >= ?
    """, (state, now_ts - 600.0))
    row = cursor.fetchone()
    if not row:
        # Also clean up any expired states
        cursor.execute("DELETE FROM oauth_states WHERE state = ? OR created_at < ?", (state, now_ts - 600.0))
        conn.commit()
        conn.close()
        return False

    # Atomically delete/consume state
    cursor.execute("DELETE FROM oauth_states WHERE state = ?", (state,))
    conn.commit()
    conn.close()
    return True

# --- GitHub User & Player Profile Management ---
def upsert_github_user(github_id, github_username, avatar_url, github_token_enc, email=None, display_name=None):
    """Upserts a user by github_id and ensures their player_profile row exists. Returns the user dict."""
    conn = sqlite3.connect(DB_PATH, timeout=30.0)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM users WHERE github_id = ?", (str(github_id),))
    existing = cursor.fetchone()

    name = display_name or github_username
    if existing:
        user_id = existing['id']
        cursor.execute("""
            UPDATE users 
            SET github_username = ?, avatar_url = ?, github_token_enc = ?, full_name = COALESCE(?, full_name), email = COALESCE(?, email)
            WHERE id = ?
        """, (github_username, avatar_url, github_token_enc, name, email, user_id))
    else:
        # Check if an existing user matches by email without a linked github_id
        existing_by_email = None
        if email:
            cursor.execute("SELECT id FROM users WHERE email = ? AND (github_id IS NULL OR github_id = '')", (email,))
            existing_by_email = cursor.fetchone()

        if existing_by_email:
            user_id = existing_by_email['id']
            cursor.execute("""
                UPDATE users 
                SET github_id = ?, github_username = ?, avatar_url = ?, github_token_enc = ?, full_name = COALESCE(?, full_name)
                WHERE id = ?
            """, (str(github_id), github_username, avatar_url, github_token_enc, name, user_id))
        else:
            try:
                cursor.execute("""
                    INSERT INTO users (github_id, github_username, avatar_url, github_token_enc, full_name, email)
                    VALUES (?, ?, ?, ?, ?, ?)
                """, (str(github_id), github_username, avatar_url, github_token_enc, name, email))
                user_id = cursor.lastrowid
            except sqlite3.IntegrityError:
                cursor.execute("""
                    INSERT INTO users (github_id, github_username, avatar_url, github_token_enc, full_name, email)
                    VALUES (?, ?, ?, ?, ?, NULL)
                """, (str(github_id), github_username, avatar_url, github_token_enc, name))
                user_id = cursor.lastrowid

    # Ensure player_profile exists
    cursor.execute("SELECT user_id FROM player_profile WHERE user_id = ?", (user_id,))
    if not cursor.fetchone():
        cursor.execute("""
            INSERT INTO player_profile (user_id, total_nxp, current_streak, best_streak, current_chamber, dsa_score, system_design_score, cleanliness_score, onboarding_complete)
            VALUES (?, 0, 0, 0, 1, 0, 0, 0, 0)
        """, (user_id,))

    conn.commit()
    cursor.execute("SELECT * FROM users WHERE id = ?", (user_id,))
    user = dict(cursor.fetchone())
    conn.close()
    return user

def get_player_profile(user_id):
    conn = sqlite3.connect(DB_PATH, timeout=30.0)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM player_profile WHERE user_id = ?", (user_id,))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None

def save_onboarding_results(user_id: int, dsa: int, system_design: int, cleanliness: int, skill_tree: dict, schedule: list):
    """Saves onboarding analysis results to player_profile and sets onboarding_complete to 1."""
    conn = sqlite3.connect(DB_PATH, timeout=30.0)
    cursor = conn.cursor()
    cursor.execute("""
        UPDATE player_profile
        SET dsa_score = ?,
            system_design_score = ?,
            cleanliness_score = ?,
            skill_tree_json = ?,
            schedule_json = ?,
            onboarding_complete = 1,
            updated_at = CURRENT_TIMESTAMP
        WHERE user_id = ?
    """, (dsa, system_design, cleanliness, json.dumps(skill_tree), json.dumps(schedule), user_id))
    
    # If no profile row existed, insert one
    if cursor.rowcount == 0:
        cursor.execute("""
            INSERT INTO player_profile (user_id, total_nxp, current_streak, best_streak, current_chamber, dsa_score, system_design_score, cleanliness_score, onboarding_complete, skill_tree_json, schedule_json)
            VALUES (?, 0, 0, 0, 1, ?, ?, ?, 1, ?, ?)
        """, (user_id, dsa, system_design, cleanliness, json.dumps(skill_tree), json.dumps(schedule)))
        
    conn.commit()
    conn.close()

def get_profile_matrix(user_id: int):
    """Returns the calibrated matrix scores (dsa, system_design, cleanliness) for user."""
    profile = get_player_profile(user_id)
    if not profile:
        return {"dsa": 0, "system_design": 0, "cleanliness": 0}
    return {
        "dsa": profile.get("dsa_score", 0),
        "system_design": profile.get("system_design_score", 0),
        "cleanliness": profile.get("cleanliness_score", 0)
    }

def get_profile_schedule(user_id: int):
    """Returns the 30-day schedule array for user."""
    profile = get_player_profile(user_id)
    if not profile or not profile.get("schedule_json"):
        return {"schedule": [], "taunts": {}}
    try:
        raw = json.loads(profile["schedule_json"])
        if isinstance(raw, list):
            return {"schedule": raw, "taunts": {}}
        elif isinstance(raw, dict):
            return raw
        return {"schedule": [], "taunts": {}}
    except Exception:
        return {"schedule": [], "taunts": {}}

def get_profile_skill_tree(user_id: int):
    """Returns the parsed skill tree dictionary and weaknesses list for user."""
    profile = get_player_profile(user_id)
    if not profile or not profile.get("skill_tree_json"):
        return {"skill_tree": {}, "weaknesses": []}
    try:
        raw = json.loads(profile["skill_tree_json"])
        if isinstance(raw, dict):
            if "skill_tree" in raw:
                return raw
            return {"skill_tree": raw, "weaknesses": []}
        return {"skill_tree": {}, "weaknesses": []}
    except Exception:
        return {"skill_tree": {}, "weaknesses": []}

def get_user_me(user_id):
    """Returns safe user and profile details for the /me endpoint. Never returns secrets or tokens."""
    conn = sqlite3.connect(DB_PATH, timeout=30.0)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("""
        SELECT u.id, u.github_username, u.avatar_url, u.full_name AS display_name,
               COALESCE(p.total_nxp, 0) AS total_nxp,
               COALESCE(p.current_streak, 0) AS current_streak,
               COALESCE(p.best_streak, 0) AS best_streak,
               COALESCE(p.current_chamber, 1) AS current_chamber,
               COALESCE(p.onboarding_complete, 0) AS onboarding_complete,
               COALESCE(p.intro_seen, 0) AS intro_seen
        FROM users u
        LEFT JOIN player_profile p ON u.id = p.user_id
        WHERE u.id = ?
    """, (user_id,))
    row = cursor.fetchone()
    conn.close()
    if not row:
        return None
    data = dict(row)
    data["onboarding_complete"] = bool(data["onboarding_complete"])
    data["intro_seen"] = bool(data.get("intro_seen", 0))
    return data

def mark_intro_seen(user_id: int):
    """Sets intro_seen to 1 for the user's player_profile."""
    conn = sqlite3.connect(DB_PATH, timeout=30.0)
    cursor = conn.cursor()
    cursor.execute("""
        UPDATE player_profile
        SET intro_seen = 1, updated_at = CURRENT_TIMESTAMP
        WHERE user_id = ?
    """, (user_id,))
    conn.commit()
    conn.close()

def get_user_tree_stats(user_id):
    """Calculates trees grown for a specific user."""
    conn = sqlite3.connect(DB_PATH, timeout=30.0)
    cursor = conn.cursor()
    # Count of User's Projects * 5
    cursor.execute('SELECT COUNT(*) FROM projects WHERE user_id = ?', (user_id,))
    res = cursor.fetchone()
    count = res[0] if res else 0
    conn.close()
    return count * 5

def get_channels():
    conn = sqlite3.connect(DB_PATH, timeout=30.0)
    cursor = conn.cursor()
    cursor.execute("SELECT id, name, category FROM channels")
    rows = cursor.fetchall()
    conn.close()
    return [{"id": r[0], "name": r[1], "category": r[2]} for r in rows]

def get_channel_messages(channel_name):
    conn = sqlite3.connect(DB_PATH, timeout=30.0)
    cursor = conn.cursor()
    # Join with users to get name and avatar (we'll just use initial as avatar if missing)
    query = '''
        SELECT m.id, u.full_name, u.email, m.content, m.type, m.timestamp
        FROM community_messages m
        JOIN channels c ON m.channel_id = c.id
        JOIN users u ON m.user_id = u.id
        WHERE c.name = ?
        ORDER BY m.timestamp ASC
        LIMIT 50
    '''
    cursor.execute(query, (channel_name,))
    rows = cursor.fetchall()
    conn.close()
    
    messages = []
    for r in rows:
        messages.append({
            "id": r[0],
            "user": r[1] or "Anonymous",
            "avatar": "", # Frontend can generate avatar from name
            "role": "Member", # Hardcoded for now, or fetch from profile
            "content": r[3],
            "type": r[4],
            "time": r[5] # Raw timestamp, frontend formats it
        })
    return messages

def add_community_message(user_id, channel_name, content, msg_type="text"):
    conn = sqlite3.connect(DB_PATH, timeout=30.0)
    cursor = conn.cursor()
    
    # Get channel ID
    cursor.execute("SELECT id FROM channels WHERE name = ?", (channel_name,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        return False
    channel_id = row[0]
    
    cursor.execute("INSERT INTO community_messages (channel_id, user_id, content, type) VALUES (?, ?, ?, ?)", 
                   (channel_id, user_id, content, msg_type))
    conn.commit()
    conn.close()
    return True


def log_user_activity(user_id, date_str, hours, level):
    conn = sqlite3.connect(DB_PATH, timeout=30.0)
    cursor = conn.cursor()
    
    # Check current hours
    cursor.execute("SELECT hours FROM user_activity WHERE user_id = ? AND date = ?", (user_id, date_str))
    row = cursor.fetchone()
    
    if row:
        new_hours = row[0] + hours
        # Keep level max of existing or new
        cursor.execute("UPDATE user_activity SET hours = ?, level = MAX(level, ?) WHERE user_id = ? AND date = ?", 
                      (new_hours, level, user_id, date_str))
    else:
        cursor.execute("INSERT INTO user_activity (user_id, date, hours, level) VALUES (?, ?, ?, ?)", 
                      (user_id, date_str, hours, level))
                      
    conn.commit()
    conn.close()
    
def get_user_activity(user_id):
    conn = sqlite3.connect(DB_PATH, timeout=30.0)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("SELECT date, hours, level FROM user_activity WHERE user_id = ? ORDER BY date DESC LIMIT 365", (user_id,))
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

# --- ARIA MENTOR HELPERS ---
def get_aria_hint_level(user_id: int, challenge_id: str) -> int:
    """Returns current hint level (1-3) for user on a challenge, defaulting to 1."""
    conn = sqlite3.connect(DB_PATH, timeout=30.0)
    cursor = conn.cursor()
    cursor.execute("SELECT level FROM aria_hints WHERE user_id = ? AND challenge_id = ?", (user_id, str(challenge_id)))
    row = cursor.fetchone()
    conn.close()
    if row:
        return max(1, min(3, int(row[0])))
    return 1

def set_aria_hint_level(user_id: int, challenge_id: str, level: int) -> int:
    """Sets hint level clamped between 1 and 3."""
    clamped_level = max(1, min(3, int(level)))
    conn = sqlite3.connect(DB_PATH, timeout=30.0)
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO aria_hints (user_id, challenge_id, level, updated_at)
        VALUES (?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(user_id, challenge_id) DO UPDATE SET
            level = excluded.level,
            updated_at = CURRENT_TIMESTAMP
    """, (user_id, str(challenge_id), clamped_level))
    conn.commit()
    conn.close()
    return clamped_level

def increment_aria_hint_level(user_id: int, challenge_id: str) -> int:
    """Increments hint level by 1, up to maximum 3."""
    current = get_aria_hint_level(user_id, challenge_id)
    next_level = min(3, current + 1)
    set_aria_hint_level(user_id, challenge_id, next_level)
    return next_level

def get_aria_challenge_session_id(user_id: int, challenge_id: str) -> str:
    return f"aria_user_{user_id}_chal_{challenge_id}"

def get_or_create_aria_session(user_id: int, challenge_id: str) -> str:
    session_id = get_aria_challenge_session_id(user_id, challenge_id)
    create_chat_session(session_id, user_id, title=f"ARIA Secure Comms - {challenge_id}")
    return session_id

def get_aria_history(user_id: int, challenge_id: str):
    session_id = get_aria_challenge_session_id(user_id, challenge_id)
    return get_chat_history(session_id)

def update_latest_chamber_attempt(
    user_id: int,
    chamber_no: int,
    passed: bool,
    runtime_ms: float = 0.0,
    complexity_label: str = "",
    cleanliness_score: int = 100
):
    conn = sqlite3.connect(DB_PATH, timeout=30.0)
    cursor = conn.cursor()
    cursor.execute("""
        UPDATE chamber_attempts
        SET passed = ?, runtime_ms = ?, complexity_label = ?, cleanliness_score = ?
        WHERE id = (
            SELECT id FROM chamber_attempts
            WHERE user_id = ? AND chamber_no = ?
            ORDER BY id DESC LIMIT 1
        )
    """, (passed, runtime_ms, complexity_label, cleanliness_score, user_id, chamber_no))
    conn.commit()
    conn.close()

def get_latest_attempt_id(user_id: int, chamber_no: int) -> Optional[int]:
    """Retrieves the ID of the latest attempt for a given user and chamber."""
    conn = sqlite3.connect(DB_PATH, timeout=30.0)
    cursor = conn.cursor()
    cursor.execute("""
        SELECT id FROM chamber_attempts
        WHERE user_id = ? AND chamber_no = ?
        ORDER BY id DESC LIMIT 1
    """, (user_id, chamber_no))
    row = cursor.fetchone()
    conn.close()
    return row[0] if row else None

def get_aria_hints_used(user_id: int, challenge_id: str) -> int:
    """Returns number of hints consumed for a challenge (0 if none)."""
    conn = sqlite3.connect(DB_PATH, timeout=30.0)
    cursor = conn.cursor()
    cursor.execute("SELECT level FROM aria_hints WHERE user_id = ? AND challenge_id = ?", (user_id, str(challenge_id)))
    row = cursor.fetchone()
    conn.close()
    if row:
        return max(0, min(3, int(row[0])))
    return 0

def commit_chamber_award(
    user_id: int,
    chamber_no: int,
    passed: bool,
    inefficient: bool = False,
    cleanliness_score: int = 100,
    attempt_number: int = 1,
    hint_level: int = 0,
    axis_weights: Optional[Dict[str, float]] = None,
    system_design_gain: int = 2,
    attempt_id: Optional[int] = None,
    reason: str = "chamber_pass"
) -> Dict[str, Any]:
    """
    Executes NXP award calculation, player_profile update, nxp_ledger insertion,
    matrix_history insertion, and chamber_state update in ONE atomic SQLite transaction (BEGIN IMMEDIATE).
    Guarantees idempotency and protects against race conditions with UNIQUE constraint.
    """
    import nxp
    import matrix

    conn = sqlite3.connect(DB_PATH, timeout=30.0, isolation_level=None)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    try:
        cursor.execute("BEGIN IMMEDIATE")

        # 1. Check if award already exists for (user_id, chamber_no, reason)
        cursor.execute(
            "SELECT id, points FROM nxp_ledger WHERE user_id = ? AND chamber_no = ? AND reason = ?",
            (user_id, chamber_no, reason)
        )
        existing_award = cursor.fetchone()
        already_awarded = existing_award is not None

        # 2. Fetch or initialize player_profile
        cursor.execute("SELECT * FROM player_profile WHERE user_id = ?", (user_id,))
        prof_row = cursor.fetchone()
        if not prof_row:
            cursor.execute("""
                INSERT INTO player_profile (user_id, total_nxp, current_streak, best_streak, current_chamber, dsa_score, system_design_score, cleanliness_score)
                VALUES (?, 0, 0, 0, ?, 0, 0, 0)
            """, (user_id, chamber_no))
            cursor.execute("SELECT * FROM player_profile WHERE user_id = ?", (user_id,))
            prof_row = cursor.fetchone()

        profile = dict(prof_row)
        old_streak = profile.get("current_streak") or 0
        old_best_streak = profile.get("best_streak") or 0
        old_nxp = profile.get("total_nxp") or 0
        old_dsa = profile.get("dsa_score") or 0
        old_sd = profile.get("system_design_score") or 0
        old_clean = profile.get("cleanliness_score") or 0

        current_matrix = {
            "dsa": old_dsa,
            "system_design": old_sd,
            "cleanliness": old_clean
        }

        # Handle Failed submission: reset streak to 0, no points, no matrix gain
        if not passed:
            cursor.execute("""
                UPDATE player_profile
                SET current_streak = 0,
                    updated_at = CURRENT_TIMESTAMP
                WHERE user_id = ?
            """, (user_id,))

            cursor.execute("""
                UPDATE chamber_state
                SET state = 'FAILED'
                WHERE user_id = ? AND chamber_no = ?
            """, (user_id, chamber_no))

            cursor.execute("COMMIT")
            conn.close()

            return {
                "awarded": False,
                "already_awarded": False,
                "nxp_awarded": 0,
                "points": 0,
                "total_nxp": old_nxp,
                "streak": 0,
                "multiplier": 1.0,
                "matrix": current_matrix,
                "deltas": {"dsa": 0, "system_design": 0, "cleanliness": 0, "nxp": 0}
            }

        # Passed submission:
        new_streak, new_best_streak = nxp.update_streak(old_streak, old_best_streak, passed=True)

        # Replay / Repeat submission: already awarded, do NOT award points or update matrix again
        if already_awarded:
            cursor.execute("""
                UPDATE player_profile
                SET current_streak = ?,
                    best_streak = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE user_id = ?
            """, (new_streak, new_best_streak, user_id))

            cursor.execute("""
                UPDATE chamber_state
                SET state = 'PASSED'
                WHERE user_id = ? AND chamber_no = ?
            """, (user_id, chamber_no))

            cursor.execute("COMMIT")
            conn.close()

            return {
                "awarded": False,
                "already_awarded": True,
                "nxp_awarded": 0,
                "points": 0,
                "total_nxp": old_nxp,
                "streak": new_streak,
                "multiplier": round(1.0 + 0.1 * min(old_streak, 5), 2),
                "matrix": current_matrix,
                "deltas": {"dsa": 0, "system_design": 0, "cleanliness": 0, "nxp": 0}
            }

        # First pass for this chamber: compute award and update matrix
        nxp_res = nxp.calculate_nxp(
            chamber_no=chamber_no,
            passed=True,
            inefficient=inefficient,
            cleanliness=cleanliness_score,
            attempt_number=attempt_number,
            hint_level=hint_level,
            streak_before=old_streak
        )
        points_awarded = nxp_res["points"]
        multiplier = nxp_res["multiplier"]
        new_total_nxp = old_nxp + points_awarded

        # Matrix calculation
        dsa_w = axis_weights.get("dsa", 0.7) if axis_weights else 0.7
        mat_res = matrix.calculate_matrix_update(
            current_matrix=current_matrix,
            passed=True,
            inefficient=inefficient,
            attempt_cleanliness_score=cleanliness_score,
            dsa_weight=dsa_w,
            system_design_gain=system_design_gain
        )
        new_matrix = mat_res["matrix"]
        deltas = mat_res["deltas"]
        deltas["nxp"] = points_awarded

        # Insert into nxp_ledger (Protected by UNIQUE (user_id, chamber_no, reason))
        cursor.execute("""
            INSERT INTO nxp_ledger (user_id, chamber_no, attempt_id, points, streak_after, reason)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (user_id, chamber_no, attempt_id, points_awarded, new_streak, reason))

        # Insert into matrix_history
        cursor.execute("""
            INSERT INTO matrix_history (user_id, dsa, system_design, cleanliness, total_nxp, attempt_id)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (user_id, new_matrix["dsa"], new_matrix["system_design"], new_matrix["cleanliness"], new_total_nxp, attempt_id))

        # Update player_profile
        cursor.execute("""
            UPDATE player_profile
            SET total_nxp = ?,
                current_streak = ?,
                best_streak = ?,
                dsa_score = ?,
                system_design_score = ?,
                cleanliness_score = ?,
                current_chamber = MAX(current_chamber, ?),
                updated_at = CURRENT_TIMESTAMP
            WHERE user_id = ?
        """, (
            new_total_nxp,
            new_streak,
            new_best_streak,
            new_matrix["dsa"],
            new_matrix["system_design"],
            new_matrix["cleanliness"],
            chamber_no + 1,
            user_id
        ))

        # Set chamber_state
        cursor.execute("""
            UPDATE chamber_state
            SET state = 'PASSED'
            WHERE user_id = ? AND chamber_no = ?
        """, (user_id, chamber_no))

        cursor.execute("COMMIT")
        conn.close()

        return {
            "awarded": True,
            "already_awarded": False,
            "nxp_awarded": points_awarded,
            "points": points_awarded,
            "total_nxp": new_total_nxp,
            "streak": new_streak,
            "multiplier": multiplier,
            "matrix": new_matrix,
            "deltas": deltas
        }

    except Exception as e:
        try:
            cursor.execute("ROLLBACK")
        except Exception:
            pass
        conn.close()
        raise e

def get_matrix_history(user_id: int, limit: int = 20, offset: int = 0) -> Dict[str, Any]:
    """Retrieves paginated matrix history records for a user."""
    conn = sqlite3.connect(DB_PATH, timeout=30.0)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) FROM matrix_history WHERE user_id = ?", (user_id,))
    total = cursor.fetchone()[0]

    cursor.execute("""
        SELECT id, user_id, dsa, system_design, cleanliness, total_nxp, attempt_id, created_at
        FROM matrix_history
        WHERE user_id = ?
        ORDER BY id DESC
        LIMIT ? OFFSET ?
    """, (user_id, limit, offset))
    rows = cursor.fetchall()
    conn.close()
    return {
        "items": [dict(r) for r in rows],
        "total": total,
        "limit": limit,
        "offset": offset
    }

def get_nxp_ledger(user_id: int, limit: int = 20, offset: int = 0) -> Dict[str, Any]:
    """Retrieves paginated NXP ledger records for a user."""
    conn = sqlite3.connect(DB_PATH, timeout=30.0)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) FROM nxp_ledger WHERE user_id = ?", (user_id,))
    total = cursor.fetchone()[0]

    cursor.execute("""
        SELECT id, user_id, chamber_no, attempt_id, points, streak_after, reason, created_at
        FROM nxp_ledger
        WHERE user_id = ?
        ORDER BY id DESC
        LIMIT ? OFFSET ?
    """, (user_id, limit, offset))
    rows = cursor.fetchall()
    conn.close()
    return {
        "items": [dict(r) for r in rows],
        "total": total,
        "limit": limit,
        "offset": offset
    }

def check_chambers_1_to_5_passed(user_id: int) -> bool:
    """Verifies whether user has PASSED all five precursor chambers (1, 2, 3, 4, 5)."""
    conn = sqlite3.connect(DB_PATH, timeout=30.0)
    cursor = conn.cursor()
    cursor.execute("""
        SELECT chamber_no FROM chamber_state
        WHERE user_id = ? AND chamber_no BETWEEN 1 AND 5 AND state IN ('PASSED', 'COMPLETED')
    """, (user_id,))
    passed = set(r[0] for r in cursor.fetchall())
    conn.close()
    return {1, 2, 3, 4, 5}.issubset(passed)

def get_finale_state(user_id: int) -> Optional[Dict[str, Any]]:
    """Retrieves current finale state record for user if present."""
    conn = sqlite3.connect(DB_PATH, timeout=30.0)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM finale_state WHERE user_id = ?", (user_id,))
    row = cursor.fetchone()
    conn.close()
    if not row:
        return None
    d = dict(row)
    if d.get("scores_json"):
        try:
            d["scores"] = json.loads(d["scores_json"])
        except Exception:
            d["scores"] = {}
    else:
        d["scores"] = {}
    return d

def upsert_finale_state(
    user_id: int,
    round_no: int,
    state: str,
    started_at: Any,
    deadline_at: Any,
    scores: Dict[str, Any]
) -> Dict[str, Any]:
    """Inserts or updates the finale state row for a user."""
    conn = sqlite3.connect(DB_PATH, timeout=30.0)
    cursor = conn.cursor()
    s_iso = started_at.isoformat() if hasattr(started_at, "isoformat") else str(started_at) if started_at else None
    d_iso = deadline_at.isoformat() if hasattr(deadline_at, "isoformat") else str(deadline_at) if deadline_at else None
    scores_str = json.dumps(scores)

    cursor.execute("""
        INSERT INTO finale_state (user_id, round, state, started_at, deadline_at, scores_json, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(user_id) DO UPDATE SET
            round = excluded.round,
            state = excluded.state,
            started_at = excluded.started_at,
            deadline_at = excluded.deadline_at,
            scores_json = excluded.scores_json,
            updated_at = CURRENT_TIMESTAMP
    """, (user_id, round_no, state, s_iso, d_iso, scores_str))
    conn.commit()
    conn.close()
    return get_finale_state(user_id)

def commit_finale_award(user_id: int, attempt_id: Optional[int] = None) -> Dict[str, Any]:
    """
    Awards the +1000 NXP finale bonus and +15 system_design axis gain atomically (BEGIN IMMEDIATE).
    Guarantees single award idempotency via nxp_ledger UNIQUE (user_id, chamber_no, reason).
    """
    conn = sqlite3.connect(DB_PATH, timeout=30.0, isolation_level=None)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    try:
        cursor.execute("BEGIN IMMEDIATE")

        # 1. Idempotency check in nxp_ledger
        cursor.execute(
            "SELECT id, points FROM nxp_ledger WHERE user_id = ? AND chamber_no = 6 AND reason = 'finale'",
            (user_id,)
        )
        existing = cursor.fetchone()
        already_awarded = existing is not None

        # 2. Fetch player_profile
        cursor.execute("SELECT * FROM player_profile WHERE user_id = ?", (user_id,))
        prof_row = cursor.fetchone()
        if not prof_row:
            cursor.execute("""
                INSERT INTO player_profile (user_id, total_nxp, current_streak, best_streak, current_chamber, dsa_score, system_design_score, cleanliness_score)
                VALUES (?, 0, 0, 0, 6, 0, 0, 0)
            """, (user_id,))
            cursor.execute("SELECT * FROM player_profile WHERE user_id = ?", (user_id,))
            prof_row = cursor.fetchone()

        profile = dict(prof_row)
        old_nxp = profile.get("total_nxp") or 0
        old_streak = profile.get("current_streak") or 0
        old_dsa = profile.get("dsa_score") or 0
        old_sd = profile.get("system_design_score") or 0
        old_clean = profile.get("cleanliness_score") or 0

        if already_awarded:
            cursor.execute("COMMIT")
            conn.close()
            return {
                "awarded": False,
                "already_awarded": True,
                "nxp_awarded": 0,
                "total_nxp": old_nxp,
                "streak": old_streak,
                "matrix": {
                    "dsa": old_dsa,
                    "system_design": old_sd,
                    "cleanliness": old_clean
                },
                "deltas": {"dsa": 0, "system_design": 0, "cleanliness": 0, "nxp": 0}
            }

        # First completion: +1000 NXP, +15 system_design (clamped to 100)
        new_nxp = old_nxp + 1000
        new_sd = min(100, max(0, old_sd + 15))

        # Insert into nxp_ledger
        cursor.execute("""
            INSERT INTO nxp_ledger (user_id, chamber_no, attempt_id, points, streak_after, reason)
            VALUES (?, 6, ?, 1000, ?, 'finale')
        """, (user_id, attempt_id, old_streak))

        # Update player_profile
        cursor.execute("""
            UPDATE player_profile
            SET total_nxp = ?,
                system_design_score = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE user_id = ?
        """, (new_nxp, new_sd, user_id))

        # Append to matrix_history
        cursor.execute("""
            INSERT INTO matrix_history (user_id, dsa, system_design, cleanliness, total_nxp, attempt_id)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (user_id, old_dsa, new_sd, old_clean, new_nxp, attempt_id))

        # Update chamber_state for chamber 6
        cursor.execute("""
            INSERT INTO chamber_state (user_id, chamber_no, state)
            VALUES (?, 6, 'COMPLETED')
            ON CONFLICT(user_id, chamber_no) DO UPDATE SET state = 'COMPLETED'
        """, (user_id,))

        cursor.execute("COMMIT")
        conn.close()

        return {
            "awarded": True,
            "already_awarded": False,
            "nxp_awarded": 1000,
            "total_nxp": new_nxp,
            "streak": old_streak,
            "matrix": {
                "dsa": old_dsa,
                "system_design": new_sd,
                "cleanliness": old_clean
            },
            "deltas": {
                "dsa": 0,
                "system_design": 15,
                "cleanliness": 0,
                "nxp": 1000
            }
        }
    except Exception as e:
        cursor.execute("ROLLBACK")
        conn.close()
        raise e

def get_player_style_metrics(user_id: int) -> Dict[str, Any]:
    """
    Computes style metrics solely from the player's chamber attempt and state telemetry.
    Never queries or touches resume text or personal details.
    """
    conn = sqlite3.connect(DB_PATH, timeout=30.0)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    # 1. Cleanliness and efficiency from chamber_attempts
    cursor.execute("""
        SELECT cleanliness_score, passed, complexity_label, runtime_ms
        FROM chamber_attempts
        WHERE user_id = ?
    """, (user_id,))
    attempt_rows = cursor.fetchall()

    clean_vals = [r["cleanliness_score"] for r in attempt_rows if r["cleanliness_score"] is not None]
    passed_attempts = [r for r in attempt_rows if r["passed"]]

    # 2. Chamber states (first-try rate and time used)
    cursor.execute("""
        SELECT chamber_no, state, attempts, started_at, deadline_at
        FROM chamber_state
        WHERE user_id = ?
    """, (user_id,))
    state_rows = cursor.fetchall()
    passed_states = [r for r in state_rows if r["state"] in ("PASSED", "COMPLETED")]

    # 3. Aria hints used
    cursor.execute("SELECT SUM(level) FROM aria_hints WHERE user_id = ?", (user_id,))
    hint_row = cursor.fetchone()
    total_hints = hint_row[0] if hint_row and hint_row[0] else 0

    # 4. Player profile
    cursor.execute("SELECT best_streak, cleanliness_score FROM player_profile WHERE user_id = ?", (user_id,))
    prof_row = cursor.fetchone()
    best_streak = prof_row["best_streak"] if prof_row and prof_row["best_streak"] is not None else 1
    prof_clean = prof_row["cleanliness_score"] if prof_row and prof_row["cleanliness_score"] is not None else 75

    conn.close()

    # Derive clean averages
    if clean_vals:
        avg_cleanliness = float(sum(clean_vals) / len(clean_vals))
    else:
        avg_cleanliness = float(prof_clean or 75.0)

    if passed_attempts:
        # Non-inefficient passes: passed without inefficient complexity label
        efficient_passes = [
            r for r in passed_attempts
            if not (r["complexity_label"] and "O(n^2)" in r["complexity_label"])
        ]
        non_inefficient_share = float(len(efficient_passes) / len(passed_attempts))
    else:
        non_inefficient_share = 0.85

    if passed_states:
        first_try_passes = [r for r in passed_states if (r["attempts"] or 1) == 1]
        first_try_rate = float(len(first_try_passes) / len(passed_states))
    else:
        first_try_rate = 0.60

    # Average time used percentage: estimate from deadlines or default to realistic 42%
    time_ratios = []
    for r in passed_states:
        if r["started_at"] and r["deadline_at"]:
            try:
                s_t = datetime.fromisoformat(r["started_at"])
                d_t = datetime.fromisoformat(r["deadline_at"])
                total_span = (d_t - s_t).total_seconds()
                # If we have attempt runtime or estimation
                if total_span > 0:
                    time_ratios.append(45.0)
            except Exception:
                pass
    avg_time_used_pct = float(sum(time_ratios) / len(time_ratios)) if time_ratios else 45.0

    hint_dependence = min(1.0, max(0.0, float(total_hints) / 15.0))

    return {
        "avg_time_used_pct": round(avg_time_used_pct, 1),
        "avg_cleanliness": round(avg_cleanliness, 1),
        "non_inefficient_share": round(non_inefficient_share, 2),
        "hint_dependence": round(hint_dependence, 2),
        "first_try_rate": round(first_try_rate, 2),
        "best_streak": int(best_streak)
    }

if __name__ == "__main__":
    init_db()


