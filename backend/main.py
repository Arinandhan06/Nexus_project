from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import os
import time
import uvicorn
import json # Essential for /market-match logic
from dotenv import load_dotenv
from pydantic import BaseModel
import database
from mirror_agent import MirrorAgent
from lab_agent import LabAgent
from foundry_agent import FoundryAgent
from market_agent import MarketAnalystAgent
from resume_agent import ResumeAgent
from datetime import datetime, timedelta

load_dotenv()
database.init_db()

app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# Initialize Agents
mirror = MirrorAgent()
lab = LabAgent(mirror.client)
market = MarketAnalystAgent(mirror.client)
foundry = FoundryAgent(mirror.client)
resume_bot = ResumeAgent(mirror.client)

# --- Auth Models & Logic ---
import secrets
import hashlib
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")

class SignupRequest(BaseModel):
    name: str
    email: str
    password: str

class LoginRequest(BaseModel):
    email: str
    password: str

def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return hash_password(plain_password) == hashed_password

@app.post("/auth/signup")
def signup(req: SignupRequest):
    # Check if user exists
    existing = database.get_user_by_email(req.email)
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    pwd_hash = hash_password(req.password)
    user_id = database.create_user(req.email, pwd_hash, req.name)
    
    if not user_id:
         raise HTTPException(status_code=500, detail="Failed to create user")
         
    return {"message": "User created successfully", "user_id": user_id}

@app.post("/login")
def login(req: LoginRequest):
    user = database.get_user_by_email(req.email)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
        
    if not verify_password(req.password, user['password_hash']):
        raise HTTPException(status_code=401, detail="Invalid credentials")
        
    # Generate Token
    token = secrets.token_hex(32)
    database.create_session(user['id'], token)
    
    return {"token": token, "name": user['full_name'], "email": user['email']}

def get_current_user(token: str = Depends(oauth2_scheme)):
    user = database.get_user_by_token(token)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user

# --- Foundry API Models & Endpoints ---
# --- Foundry API Models & Endpoints ---
class FoundryChatRequest(BaseModel):
    message: str
    code: str
    project_context: dict 
    language: str = "english"

class FoundryValidateRequest(BaseModel):
    code: str
    phase_objective: str

@app.post("/foundry/chat")
async def foundry_chat(req: FoundryChatRequest):
    response = foundry.chat_architect(req.message, req.code, req.project_context, req.language)
    return {"response": response}

@app.post("/foundry/validate")
async def foundry_validate(req: FoundryValidateRequest):
    result = foundry.validate_code(req.code, req.phase_objective)
    return result

import base64

@app.post("/foundry/verify")
async def verify_output(file: UploadFile = File(...), phase_objective: str = Form(...)):
    try:
        contents = await file.read()
        # Convert to base64 data url
        encoded_image = base64.b64encode(contents).decode("utf-8")
        image_url = f"data:image/jpeg;base64,{encoded_image}"
        
        result = foundry.verify_screenshot(image_url, phase_objective)
        return result
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e), "approved": False})

import io
from pypdf import PdfReader

@app.post("/analyze")
def process_career_cycle(file: UploadFile = File(...), target_role: str = Form(...), user: dict = Depends(get_current_user)):
    try:
        # Read the file content
        file_bytes = file.file.read()
        content = ""
        
        # Check for PDF signature or extension
        if file.filename.lower().endswith(".pdf") or file.content_type == "application/pdf":
            try:
                # Parse PDF
                pdf = PdfReader(io.BytesIO(file_bytes))
                for page in pdf.pages:
                    content += page.extract_text() + "\n"
                
                # Check for emptiness
                # Check for emptiness BUT PROCEED ANYWAY (Some PDFs are images)
                if not content.strip():
                    print("Text extraction empty. Attempting Vision Extraction (Image-based PDF)...")
                    try:
                        # Extract images from first page
                        page = pdf.pages[0]
                        if len(page.images) > 0:
                            # Convert first image to base64
                            import base64
                            img_obj = page.images[0]
                            img_bytes = img_obj.data
                            base64_img = base64.b64encode(img_bytes).decode('utf-8')
                            
                            # Call Vision Agent
                            profile_data = mirror.analyze_image_resume(base64_img, target_role)
                            
                            # Skip normal text flow
                            skill_gaps = profile_data.get("skill_gaps", [])
                            projects = lab.generate_projects(skill_gaps)
                            database.save_career_data(target_role, profile_data, projects, "Sprout", user['id'])
                            return {"profile": profile_data, "projects": projects}
                            
                        else:
                            content = "[WARNING: EMPTY PDF AND NO IMAGES FOUND]"
                    except Exception as vision_err:
                        print(f"Vision Extraction Failed: {vision_err}")
                        content = "[WARNING: FAILED TO EXTRACT IMAGES]"
                        
                else:
                    # Tag it so agent knows context
                    content = f"[RESUME PDF CONTENT START]\n{content}\n[RESUME PDF CONTENT END]"
            except Exception as pdf_err:
                print(f"PDF Parsing Failed: {pdf_err}")
                # Don't fail, just pass through (might be text file with pdf extension)
                content = file_bytes.decode('utf-8', errors='ignore')
        else:
            # Fallback to Text
            content = file_bytes.decode('utf-8', errors='ignore')
        
        # 1. Mirror Agent call (Returns profile dictionary)
        profile_data = mirror.analyze_resume(content, target_role)
        
        # 2. Use the result to trigger the Lab Agent
        skill_gaps = profile_data.get("skill_gaps", [])
        projects = lab.generate_projects(skill_gaps)
        
        # 3. Save to History (User specific)
        database.save_career_data(target_role, profile_data, projects, "Sprout", user['id'])
        
        return {"profile": profile_data, "projects": projects}
    except Exception as e:
        print(f"Analysis Error: {e}")
        return JSONResponse(status_code=500, content={"error": str(e)})

class UpdateProjectsRequest(BaseModel):
    projects: list

@app.post("/update-generated-projects")
async def update_generated_projects(req: UpdateProjectsRequest):
    try:
        success = database.update_latest_profile_projects(req.projects)
        if success:
            return {"status": "updated"}
        return {"status": "no_profile_found"}
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})

@app.get("/market-match")
def get_market_matching(user: dict = Depends(get_current_user)):
    # Frontend calls this on refresh to restore the dashboard
    history = database.get_profile_by_user_id(user['id'])
    if not history:
        return {"error": "No profile found"}
    
    return {
        "profile": history['analysis'], 
        "projects": history['projects'], 
        "role": history['role'],
        "stage": history['growth_stage']
    }

# --- Persistent Chat API ---

class ChatRequest(BaseModel):
    message: str
    session_id: str

@app.get("/chat/sessions")
def get_chat_sessions(user: dict = Depends(get_current_user)):
    return database.get_all_chat_sessions(user['id'])

@app.post("/chat/new")
def create_new_chat(user: dict = Depends(get_current_user)):
    session_id = f"chat_{int(time.time())}"
    database.create_chat_session(session_id, user['id'], "New Chat")
    return {"session_id": session_id, "title": "New Chat"}

@app.get("/chat/history/{session_id}")
def get_history_by_session(session_id: str, user: dict = Depends(get_current_user)):
    # Optional: Verify user owns session? For now just fetch messages.
    history = database.get_chat_history(session_id)
    return {"messages": history}

@app.delete("/chat/sessions/{session_id}")
async def delete_chat_session(session_id: str, user: dict = Depends(get_current_user)):
    try:
        database.delete_chat_session(session_id)
        return {"status": "deleted"}
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})

@app.post("/chat")
def career_chat(req: ChatRequest, user: dict = Depends(get_current_user)):
    history = database.get_profile_by_user_id(user['id'])
    if not history:
        return {"response": "Please upload a resume first."}
        
    # Check if session exists, if not create (auto-recovery)
    # Note: get_chat_history returns messages, not session meta. 
    # But create_chat_session is safe (INSERT OR IGNORE)
    database.create_chat_session(req.session_id, user['id'], f"Chat about {req.message[:20]}...")

    # Load Past Context
    past_msgs = database.get_chat_history(req.session_id)
    chat_context = [{"role": m["role"], "content": m["content"]} for m in past_msgs]
    
    # Save User Msg
    database.save_chat_message(req.session_id, "user", req.message)
    
    context_system = (
        f"User is a {history['role']} with skills: {history['analysis'].get('current_skills', 'N/A')}. "
        "INSTRUCTIONS: Respond in max 3 short paragraphs. Use bullet points. Keep it neat. \n\n"
        "IMPORTANT PROJECT GENERATION RULES:\n"
        "1. DEFAULT BEHAVIOR: Output ONLY text. Do NOT generate new projects unless the user explicitly asks to 'create', 'generate', 'give', 'change', or 'update' projects.\n"
        "2. If the user just says 'hello' or asks a question, ANSWER ONLY IN TEXT. Do not append JSON.\n"
        "3. ONLY if the user explicitly asks for new projects: Append a single JSON block at the end: ```json { \"projects\": [ { \"id\": \"unique-id\", \"title\": \"Title\", \"description\": \"Desc\", \"tech\": [\"Tag\"], \"difficulty\": \"Easy/Medium/Hard\", \"icon\": \"code\", \"color\": \"from-blue-500 to-cyan-500\" } ] } ```.\n"
        "4. If the user asks for specific difficulty levels (e.g., 'give me medium projects'), ONLY generate projects for that level.\n"
        "5. If the user asks for projects by TOPIC but DOES NOT specify a level (e.g., 'give me python projects'), generate valid projects for ALL THREE LEVELS (3 Easy, 3 Medium, 3 Hard) to complete the set."
    )
    
    try:
        # Build Messages
        messages = [{"role": "system", "content": context_system}] + chat_context + [{"role": "user", "content": req.message}]

        response = mirror.client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=messages
        )
        reply = response.choices[0].message.content
        
        # Save Bot Msg
        database.save_chat_message(req.session_id, "assistant", reply)
        
        # Auto-Rename if first message
        if len(past_msgs) == 0:
             # Simple rename logic (could use AI)
             new_title = req.message.split('\n')[0][:30]
             database.rename_chat_session(req.session_id, new_title)

        return {"response": reply}
    except Exception as e:
        return {"response": f"I'm having trouble thinking right now. ({str(e)})"}

@app.get("/history")
async def get_history():
    return database.get_all_profiles()

@app.get("/history/{profile_id}")
async def load_history_item(profile_id: int):
    data = database.get_profile_by_id(profile_id)
    if not data:
        return JSONResponse(status_code=404, content={"error": "Not found"})
    return data

@app.delete("/history/{profile_id}")
async def delete_history_item(profile_id: int):
    try:
        database.delete_profile(profile_id)
        return {"message": "Deleted successfully"}
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})
    

# --- Resume Builder API ---

class ResumeBuildRequest(BaseModel):
    job_description: str

@app.post("/resume/build")
async def build_resume(req: ResumeBuildRequest):
    try:
        # Gather Context
        profile = database.get_latest_profile() or {}
        # Get projects user actually WORKED on (from 'My Lab')
        active_projects = database.get_all_active_projects() 
        
        result = resume_bot.generate_resume_content(profile, active_projects, req.job_description)
        return result
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})

# --- New Endpoints for Frontend Alignment ---

@app.get("/live-feeds")
def get_live_feeds(user: dict = Depends(get_current_user)):
    profile = database.get_profile_by_user_id(user['id'])
    if profile:
        skills = profile['analysis'].get('current_skills', [])
        return market.get_live_feeds(profile['role'], skills)
        
    # Fallback if no profile
    return market.get_live_feeds(None, None)

@app.get("/market/ticker")
def get_market_ticker():
    return market.get_stock_ticker()

@app.get("/job-matches")
def get_job_matches(user: dict = Depends(get_current_user)):
    profile = database.get_profile_by_user_id(user['id'])
    if not profile:
        return {"jobs": []}
    
    # Check Staleness (24h)
    should_refresh = True
    last_updated = profile.get('job_matches_updated_at')
    
    if last_updated:
        try:
            # Handle potential format variations
            if isinstance(last_updated, str):
                # SQLite often returns "YYYY-MM-DD HH:MM:SS"
                last_dt = datetime.fromisoformat(last_updated) if 'T' in last_updated else datetime.strptime(last_updated, "%Y-%m-%d %H:%M:%S")
            else:
                last_dt = last_updated # Already datetime object
                
            if datetime.now() - last_dt < timedelta(hours=24):
                should_refresh = False
        except Exception as e:
            print(f"Date parse error: {e}, forcing refresh")
            should_refresh = True
            
    # Return cached matches if valid and exist
    if not should_refresh and profile.get('job_matches') and len(profile['job_matches']) > 0:
        return {"jobs": profile['job_matches']}
        
    # Otherwise generate new ones (Daily Scrape)
    skills = profile['analysis'].get('current_skills', [])
    jobs = market.find_job_matches(profile['role'], skills)
    
    # Save to DB (updates timestamp)
    database.update_job_matches(profile['id'], jobs)
    
    return {"jobs": jobs}

# --- Active Projects API ---


class StartProjectRequest(BaseModel):
    title: str
    tech_stack: str
    description: str

class UpdatePhaseRequest(BaseModel):
    project_id: str
    phase_id: int # The phase just completed

@app.post("/project/start")
def start_project(req: StartProjectRequest, user: dict = Depends(get_current_user)):
    # Check if already active
    # CHECK USER PROJECTS ONLY
    active_projects = database.get_all_active_projects(user['id'])
    for p in active_projects:
        if p['title'] == req.title:
            return {"project": p, "status": "job_already_started"}
            
    # Generate Phases
    phases = mirror.generate_project_phases(req.title, req.tech_stack)
    
    new_project = {
        "id": f"proj_{int(time.time())}",
        "title": req.title,
        "tech_stack": req.tech_stack,
        "description": req.description,
        "current_phase": 1, 
        "total_phases": 6,
        "phases": phases, 
        "started_at": datetime.now().isoformat()
    }
    
    database.save_project_globally(new_project, user['id'])
    
    return {"project": new_project, "status": "started"}

@app.get("/workspace")
async def get_workspace(user: dict = Depends(get_current_user)):
    projects = database.get_all_active_projects(user['id'])
    return {"projects": projects}

@app.get("/project/{project_id}")
async def get_project(project_id: str):
    p = database.get_project_by_id(project_id)
    if p:
        return p
    
    raise HTTPException(status_code=404, detail="Project not found")

@app.post("/project/unlock-phase")
async def unlock_phase(req: UpdatePhaseRequest):
    # Simpler global update
    try:
        # Check current phase first to ensure we are incrementing correctly
        p = database.get_project_by_id(req.project_id)
        if not p:
            raise HTTPException(status_code=404)
            
        if p['current_phase'] == req.phase_id:
             database.update_phase_progress(req.project_id, req.phase_id + 1)
             
             # Dynamic Growth Update
             new_stage = database.recalculate_user_growth(None)
             print(f"User Growth Updated: {new_stage}")
             
             return {"status": "updated", "new_stage": new_stage}
             
        return {"status": "no_change"}
    except Exception as e:
        print(f"Unlock Error: {e}")
        return {"status": "error"}

@app.delete("/project/{project_id}")
async def delete_project(project_id: str):
    try:
        database.delete_project(project_id)
        return {"status": "deleted"}
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})

# --- SESSION & COLLABORATION API ---
import random
import string

# In-memory session store (Code -> ProjectID)
# In production, use Redis or DB
SESSION_CODES = {}

class SessionRequest(BaseModel):
    project_id: str

class JoinSessionRequest(BaseModel):
    code: str

class SyncCodeRequest(BaseModel):
    project_id: str
    code: str

@app.post("/session/create")
async def create_session(req: SessionRequest):
    # Generate 6-digit code
    code = ''.join(random.choices(string.digits, k=6))
    SESSION_CODES[code] = req.project_id
    return {"code": code}

@app.post("/session/join")
async def join_session(req: JoinSessionRequest):
    project_id = SESSION_CODES.get(req.code)
    if not project_id:
        raise HTTPException(status_code=404, detail="Invalid Session Code")
    return {"project_id": project_id}

@app.post("/project/sync")
async def sync_code(req: SyncCodeRequest):
    database.update_project_code(req.project_id, req.code)
    return {"status": "synced"}

@app.get("/project/{project_id}/sync")
async def get_latest_code(project_id: str):
    p = database.get_project_by_id(project_id)
    if not p: return {"code": ""}
    return {"code": p.get('code', "")}




@app.get("/growth-status")
def get_growth_status(user: dict = Depends(get_current_user)):
    profile = database.get_profile_by_user_id(user['id'])
    
    # Calculate Tree Count on the fly for UI (User Specific)
    trees_count = database.get_user_tree_stats(user['id'])

    if not profile:
         return {"stage": "Seed", "trees": trees_count, "progress": 0, "next_stage": "Sprout"}
    
    # Define Tiers
    tiers = [
        {"name": "Sprout", "min": 0, "max": 4},
        {"name": "Grove Guardian", "min": 5, "max": 14},
        {"name": "Forest Ranger", "min": 15, "max": 29},
        {"name": "Terraformer", "min": 30, "max": 49},
        {"name": "Gaia's Legacy", "min": 50, "max": 999}
    ]
    
    current_tier = next((t for t in tiers if t['name'] == profile['growth_stage']), tiers[0])
    next_tier = next((t for t in tiers if t['min'] > current_tier['max']), None)
    
    progress = 0
    if next_tier:
        total_needed = next_tier['min']
        progress = int((trees_count / total_needed) * 100)
    else:
        progress = 100
        
    return {
        "stage": profile['growth_stage'],
        "trees": trees_count,
        "progress": progress,
        "next_stage": next_tier['name'] if next_tier else "Max Level"
    }

# --- PROFILE API ---
class ProfileUpdateRequest(BaseModel):
    full_name: str
    bio: str
    location: str
    email: str
    avatar: str | None = None

class GoalRequest(BaseModel):
    text: str
    tag: str
    color: str
    is_done: bool = False

class GoalStatusRequest(BaseModel):
    is_done: bool

class ActivityRequest(BaseModel):
    date: str # YYYY-MM-DD
    hours: float
    level: int

@app.get("/profile")
def get_profile_full(user: dict = Depends(get_current_user)):
    p = database.get_profile_by_user_id(user['id'])
    if not p:
        # If no specific profile, try latest global? No, return empty or new behavior
        # But for transition, maybe return empty with user info
        return {
            "id": 0, 
            "role": "New User", 
            "full_name": user['full_name'], 
            "email": user['email'],
            "avatar": None, 
            "analysis": {"current_skills": []},
            "projects": [],
            "growth_stage": "Seed",
            "goals": [],
            "activity": [],
            "stats": [{"label": "Active Projects", "value": 0}, {"label": "Trees Grown", "value": 0}]
        }
    
    # Enrich with Goals and Activity
    goals = database.get_user_goals(p['id'])
    activity = database.get_user_activity(p['id'])

    # Real-time stats
    active_projects = database.get_all_active_projects(user['id'])
    
    # Calculate trees
    trees_planted = database.get_user_tree_stats(user['id'])
    
    # Add stats
    return {
        **p,
        "full_name": user['full_name'], # Use Account Name
        "email": user['email'],         # Use Account Email
        "goals": goals,
        "activity": activity,
        "active_projects_count": len(active_projects),
        "trees_planted": trees_planted
    }

@app.post("/profile/update")
async def update_profile(req: ProfileUpdateRequest):
    p = database.get_latest_profile()
    if not p: raise HTTPException(status_code=404)
    
    database.update_profile_details(p['id'], req.dict())
    return {"status": "updated"}

@app.post("/profile/goals")
async def add_goal(req: GoalRequest):
    p = database.get_latest_profile()
    if not p: raise HTTPException(status_code=404)
    
    database.add_user_goal(p['id'], req.dict())
    return {"status": "added"}

@app.delete("/profile/goals/{goal_id}")
async def delete_goal(goal_id: int):
    database.delete_goal(goal_id)
    return {"status": "deleted"}

@app.put("/profile/goals/{goal_id}")
async def update_goal(goal_id: int, req: GoalStatusRequest):
    database.update_goal_status(goal_id, req.is_done)
    return {"status": "updated"}

@app.post("/profile/activity")
async def log_activity(req: ActivityRequest):
    p = database.get_latest_profile()
    if not p: raise HTTPException(status_code=404)
    
    database.log_user_activity(p['id'], req.date, req.hours, req.level)
    return {"status": "logged"}

# --- Community Chat Endpoints ---

class ChatMessageRequest(BaseModel):
    channel: str
    content: str
    type: str = "text" # text, code, file

@app.get("/community/channels")
def list_channels(auth_user=Depends(get_current_user)):
    return database.get_channels()

@app.get("/community/messages/{channel_name}")
def get_messages(channel_name: str, auth_user=Depends(get_current_user)):
    return database.get_channel_messages(channel_name)

@app.post("/community/messages")
def post_message(req: ChatMessageRequest, auth_user=Depends(get_current_user)):
    success = database.add_community_message(auth_user['id'], req.channel, req.content, req.type)
    if not success:
        raise HTTPException(status_code=400, detail="Invalid channel")
    return {"status": "sent"}

# --- End Community Chat Endpoints ---

@app.on_event("shutdown")
def shutdown_event():
    import os
    print("Forcefully shutting down...")
    os._exit(0)

if __name__ == "__main__":
    import signal
    import sys

    def signal_handler(sig, frame):
        print("\nCtrl+C detected! Exiting immediately...")
        import os
        os._exit(0)

    signal.signal(signal.SIGINT, signal_handler)
    
    # Force asyncio loop for better Windows compatibility and reduce keep-alive timeout
    uvicorn.run(app, host="0.0.0.0", port=8000, loop="asyncio", timeout_keep_alive=2)