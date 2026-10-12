import sqlite3
import json
import os
from datetime import datetime, timedelta

DB_PATH = 'career_sapling.db'

def init_db():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
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
        
    # NEW: Users Table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            full_name TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # NEW: Sessions Table for Auth
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS sessions (
            token TEXT PRIMARY KEY,
            user_id INTEGER,
            expires_at DATETIME,
            FOREIGN KEY(user_id) REFERENCES users(id)
        )
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
            cursor.execute("INSERT INTO channels (name, category) VALUES (?, ?)", (name, cat))
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

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS user_goals (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            profile_id INTEGER,
            text TEXT,
            tag TEXT,
            color TEXT,
            is_done BOOLEAN DEFAULT 0,
            FOREIGN KEY(profile_id) REFERENCES profiles(id)
        )
    ''')

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS user_activity (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            profile_id INTEGER,
            date TEXT, -- YYYY-MM-DD
            hours REAL,
            level INTEGER,
            FOREIGN KEY(profile_id) REFERENCES profiles(id)
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

# --- GOALS API ---
def get_user_goals(profile_id):
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM user_goals WHERE profile_id = ?', (profile_id,))
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

def add_user_goal(profile_id, goal_data):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute('INSERT INTO user_goals (profile_id, text, tag, color, is_done) VALUES (?, ?, ?, ?, ?)',
                  (profile_id, goal_data['text'], goal_data['tag'], goal_data['color'], goal_data.get('is_done', False)))
    conn.commit()
    conn.close()

def update_goal_status(goal_id, is_done):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute('UPDATE user_goals SET is_done = ? WHERE id = ?', (is_done, goal_id))
    conn.commit()
    conn.close()
    
def delete_goal(goal_id):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute('DELETE FROM user_goals WHERE id = ?', (goal_id,))
    conn.commit()
    conn.close()

# --- ACTIVITY API ---
def get_user_activity(profile_id):
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    # Get last 365 days
    cursor.execute('SELECT * FROM user_activity WHERE profile_id = ? ORDER BY date DESC LIMIT 365', (profile_id,))
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

def log_user_activity(profile_id, date, hours, level):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    # Upsert logic (replace if same day exists)
    cursor.execute('DELETE FROM user_activity WHERE profile_id = ? AND date = ?', (profile_id, date))
    cursor.execute('INSERT INTO user_activity (profile_id, date, hours, level) VALUES (?, ?, ?, ?)',
                  (profile_id, date, hours, level))
    conn.commit()
    conn.close()

# --- PROFILE UPDATE ---
def update_profile_details(profile_id, updates):
    conn = sqlite3.connect(DB_PATH)
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
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute('INSERT OR IGNORE INTO chat_sessions (id, user_id, title) VALUES (?, ?, ?)', (session_id, user_id, title))
    conn.commit()
    conn.close()

def save_chat_message(session_id, role, content):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute('INSERT INTO chat_messages (session_id, role, content) VALUES (?, ?, ?)', (session_id, role, content))
    conn.commit()
    conn.close()

def get_chat_history(session_id):
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute('SELECT role, content FROM chat_messages WHERE session_id = ? ORDER BY id ASC', (session_id,))
    rows = cursor.fetchall()
    conn.close()
    return [{"role": r["role"], "content": r["content"]} for r in rows]

def get_all_chat_sessions(user_id):
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM chat_sessions WHERE user_id = ? ORDER BY created_at DESC', (user_id,))
    rows = cursor.fetchall()
    conn.close()
    return [{"id": r["id"], "title": r["title"], "created_at": r["created_at"]} for r in rows]

def rename_chat_session(session_id, new_title):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute('UPDATE chat_sessions SET title = ? WHERE id = ?', (new_title, session_id))
    conn.commit()
    conn.close()

def delete_chat_session(session_id):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    # Delete messages first (if no cascade)
    cursor.execute('DELETE FROM chat_messages WHERE session_id = ?', (session_id,))
    # Delete session
    cursor.execute('DELETE FROM chat_sessions WHERE id = ?', (session_id,))
    conn.commit()
    conn.close()

def update_phase_progress(project_id, phase_index):
    """Updates progress for a specific project in the global table."""
    conn = sqlite3.connect(DB_PATH)
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
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute('UPDATE projects SET code_content = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', (code, project_id))
    conn.commit()
    conn.close()

def update_job_matches(profile_id, job_matches):
    conn = sqlite3.connect(DB_PATH)
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
    conn = sqlite3.connect(DB_PATH)
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
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    if user_id:
        cursor.execute('SELECT data_json FROM projects WHERE user_id = ? ORDER BY updated_at DESC', (user_id,))
    else:
        cursor.execute('SELECT data_json FROM projects ORDER BY updated_at DESC')
    rows = cursor.fetchall()
    conn.close()
    
    return [json.loads(row['data_json']) for row in rows]

def get_project_by_id(project_id):
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    cursor.execute('SELECT data_json, code_content FROM projects WHERE id = ?', (project_id,))
    row = cursor.fetchone()
    conn.close()
    
    if row:
        data = json.loads(row['data_json'])
        # Inject code_content if exists and not in json
        if 'code_content' in row.keys() and row['code_content']:
             data['code'] = row['code_content']
        return data
    return None

def save_career_data(role, analysis, projects, stage, user_id=None):
    conn = sqlite3.connect(DB_PATH)
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
    conn = sqlite3.connect(DB_PATH)
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
    conn = sqlite3.connect(DB_PATH)
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

def get_all_profiles():
    """Retrieves all past uploads for the history sidebar."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    # Fetch all records, newest first
    cursor.execute('SELECT id, role, timestamp FROM profiles ORDER BY timestamp DESC')
    rows = cursor.fetchall()
    conn.close()
    
    return [{"id": r["id"], "role": r["role"], "date": r["timestamp"]} for r in rows]

def get_profile_by_id(profile_id):
    """Retrieves a specific profile when clicked in the sidebar."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM profiles WHERE id = ?', (profile_id,))
    row = cursor.fetchone()
    conn.close()
    
    if row:
        job_matches = []
        if row["job_matches_json"]:
            job_matches = json.loads(row["job_matches_json"])
            
        active_projects = []

        return {
            "role": row["role"],
            "analysis": json.loads(row["analysis_json"]),
            "projects": json.loads(row["projects_json"]),
            "job_matches": job_matches,
            "active_projects": active_projects,
            "growth_stage": row["growth_stage"]
        }
    return None

def delete_profile(profile_id):
    """Permanently removes a profile session from the database."""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute('DELETE FROM profiles WHERE id = ?', (profile_id,))
    conn.commit() # Save the deletion to disk
    conn.close()
    return True

def delete_project(project_id):
    """Deletes a project from the global projects table."""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute('DELETE FROM projects WHERE id = ?', (project_id,))
    conn.commit()
    conn.close()
    return True

def update_latest_profile_projects(projects):
    """Updates the projects_json for the most recent profile."""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Get latest ID
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
    conn = sqlite3.connect(DB_PATH)
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
    conn = sqlite3.connect(DB_PATH)
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
    conn = sqlite3.connect(DB_PATH)
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
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users WHERE email = ?", (email,))
    user = cursor.fetchone()
    conn.close()
    return user

def get_user_by_id(user_id):
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users WHERE id = ?", (user_id,))
    user = cursor.fetchone()
    conn.close()
    return user

# NEW: Session Management
def create_session(user_id, token):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    # Expire in 30 days
    expires_at = (datetime.now() + timedelta(days=30)).isoformat()
    cursor.execute("INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)", 
                  (token, user_id, expires_at))
    conn.commit()
    conn.close()

def get_user_by_token(token):
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("SELECT user_id, expires_at FROM sessions WHERE token = ?", (token,))
    session = cursor.fetchone()
    
    if not session:
        conn.close()
        return None
        
    if session['expires_at'] < datetime.now().isoformat():
        conn.close()
        return None
        
    user = get_user_by_id(session['user_id'])
    conn.close()
    return user

def get_user_tree_stats(user_id):
    """Calculates trees grown for a specific user."""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    # Count of User's Projects * 5
    cursor.execute('SELECT COUNT(*) FROM projects WHERE user_id = ?', (user_id,))
    res = cursor.fetchone()
    count = res[0] if res else 0
    conn.close()
    return count * 5
        
    user = get_user_by_id(session['user_id'])
    conn.close()
    return user

def get_channels():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT id, name, category FROM channels")
    rows = cursor.fetchall()
    conn.close()
    return [{"id": r[0], "name": r[1], "category": r[2]} for r in rows]

def get_channel_messages(channel_name):
    conn = sqlite3.connect(DB_PATH)
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
    conn = sqlite3.connect(DB_PATH)
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

def update_project_code(project_id, code):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute('UPDATE projects SET code_content = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', (code, project_id))
    conn.commit()
    conn.close()

def log_user_activity(user_id, date_str, hours, level):
    conn = sqlite3.connect(DB_PATH)
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
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("SELECT date, hours, level FROM user_activity WHERE user_id = ? ORDER BY date DESC LIMIT 365", (user_id,))
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

# Initialize DB
init_db()
