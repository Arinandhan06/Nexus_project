from fastapi import FastAPI, UploadFile, File, Form, Depends, BackgroundTasks, status, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import os
import time
import re
import uvicorn
import json # Essential for /market-match logic
from dotenv import load_dotenv
from pydantic import BaseModel
from collections import defaultdict
from typing import Dict, Any, List, Optional
import database
import evaluator
import harness
import judge0
import nexus_ai
import finale
import bids
import github_trophy
from mirror_agent import MirrorAgent
from lab_agent import LabAgent
from foundry_agent import FoundryAgent
from market_agent import MarketAnalystAgent
from resume_agent import ResumeAgent
from datetime import datetime, timedelta
from llm import MODEL

load_dotenv()
database.init_db()

frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173")
origins = list({
    frontend_url,
    frontend_url.rstrip("/"),
    f"{frontend_url.rstrip('/')}/",
    "http://localhost:5173",
    "http://localhost:5173/",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:5173/",
})

app = FastAPI(title="NEXUS: CODE AWAKENING")
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=r"https://.*\.onrender\.com|http://(localhost|127\.0\.0\.1):\d+",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Security Headers Middleware
@app.middleware("http")
async def add_security_headers(request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    return response

# Global in-memory rate limiting dictionary
_rate_limits = defaultdict(lambda: defaultdict(list))

def check_endpoint_rate_limit(category: str, key: Any, limit: int, window: float = 60.0):
    now = time.time()
    t_start = now - window
    records = [t for t in _rate_limits[category][key] if t > t_start]
    if len(records) >= limit:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Rate limit exceeded for {category}. Maximum {limit} requests per minute."
        )
    records.append(now)
    _rate_limits[category][key] = records

DEMO_MODE = os.getenv("DEMO_MODE", "").lower() in ("true", "1", "yes")
MAX_UPLOAD_SIZE = 5 * 1024 * 1024
MAX_CODE_SIZE = 20 * 1024

# Initialize Agents
mirror = MirrorAgent()
lab = LabAgent(mirror.client)
market = MarketAnalystAgent(mirror.client)
foundry = FoundryAgent(mirror.client)
resume_bot = ResumeAgent(mirror.client)

# --- Auth Dependency & Router ---
from auth_github import router as auth_router, oauth2_scheme, get_current_user

app.include_router(auth_router)
# Remove router's /me to provide complete player profile with intro_seen
app.router.routes[:] = [r for r in app.router.routes if getattr(r, "path", None) != "/me"]

@app.get("/me")
def get_me_profile(current_user: dict = Depends(get_current_user)):
    user_me = database.get_user_me(current_user["id"])
    if not user_me:
        raise HTTPException(status_code=404, detail="Cadet profile not found")
    return user_me


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
async def foundry_chat(req: FoundryChatRequest, current_user: dict = Depends(get_current_user)):
    check_endpoint_rate_limit("foundry_chat", current_user["id"], limit=20)
    if len(req.message) > 2000:
        raise HTTPException(status_code=400, detail="Message exceeds 2,000 character maximum.")
    if req.code and len(req.code.encode("utf-8")) > MAX_CODE_SIZE:
        raise HTTPException(status_code=400, detail="Code exceeds 20 KB limit.")
    response = foundry.chat_architect(req.message, req.code, req.project_context, req.language)
    return {"response": response}

@app.post("/foundry/validate")
async def foundry_validate(req: FoundryValidateRequest, current_user: dict = Depends(get_current_user)):
    check_endpoint_rate_limit("foundry_validate", current_user["id"], limit=20)
    if req.code and len(req.code.encode("utf-8")) > MAX_CODE_SIZE:
        raise HTTPException(status_code=400, detail="Code exceeds 20 KB limit.")
    result = foundry.validate_code(req.code, req.phase_objective)
    return result

import base64

@app.post("/foundry/verify")
async def verify_output(
    file: UploadFile = File(...),
    phase_objective: str = Form(...),
    current_user: dict = Depends(get_current_user)
):
    check_endpoint_rate_limit("foundry_verify", current_user["id"], limit=20)
    try:
        contents = await file.read()
        if len(contents) > MAX_UPLOAD_SIZE:
            raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="File exceeds 5MB limit.")
        # Convert to base64 data url
        encoded_image = base64.b64encode(contents).decode("utf-8")
        image_url = f"data:image/jpeg;base64,{encoded_image}"
        
        result = foundry.verify_screenshot(image_url, phase_objective)
        return result
    except HTTPException:
        raise
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e), "approved": False})

import io
import docx
from pypdf import PdfReader
from typing import Optional
from fastapi import HTTPException, status
import resume_intel
import schedule as schedule_mod

MAX_RESUME_SIZE = 5 * 1024 * 1024  # 5 MB limit

@app.post("/resume/analyze")
async def analyze_resume_endpoint(
    file: UploadFile = File(...),
    target_role: Optional[str] = Form("Software Engineer"),
    current_user: dict = Depends(get_current_user)
):
    # 1. Read file bytes and enforce 5MB size limit
    file_bytes = await file.read()
    if len(file_bytes) > MAX_RESUME_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="File size exceeds the 5MB maximum limit."
        )

    filename = (file.filename or "").lower()
    is_pdf = filename.endswith(".pdf")
    is_docx = filename.endswith(".docx")

    if not is_pdf and not is_docx:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Unsupported media type. Only .pdf and .docx files are accepted."
        )

    # 2. Validate magic bytes (PDF: %PDF, DOCX: PK\x03\x04 zip header)
    if is_pdf:
        if not file_bytes.startswith(b"%PDF"):
            raise HTTPException(
                status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                detail="Invalid file signature. File is not a valid PDF document."
            )
    elif is_docx:
        if not file_bytes.startswith(b"PK\x03\x04"):
            raise HTTPException(
                status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                detail="Invalid file signature. File is not a valid DOCX document."
            )

    # 3. Extract text
    extracted_text = ""
    if is_pdf:
        try:
            pdf = PdfReader(io.BytesIO(file_bytes))
            for page in pdf.pages:
                page_text = page.extract_text()
                if page_text:
                    extracted_text += page_text + "\n"

            # Scanned PDF vision fallback
            if not extracted_text.strip():
                try:
                    for page in pdf.pages:
                        if hasattr(page, "images") and len(page.images) > 0:
                            import base64
                            img_obj = page.images[0]
                            base64_img = base64.b64encode(img_obj.data).decode('utf-8')
                            profile_data = mirror.analyze_image_resume(base64_img, target_role)
                            skills_str = ", ".join(profile_data.get("current_skills", []))
                            exp_str = json.dumps(profile_data.get("experience", []))
                            extracted_text = f"Candidate Profile:\nSkills: {skills_str}\nExperience: {exp_str}"
                            break
                except Exception as vision_err:
                    print(f"Vision fallback failed: {vision_err}")
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                detail=f"Corrupted or unreadable PDF document: {str(e)}"
            )
    elif is_docx:
        try:
            doc = docx.Document(io.BytesIO(file_bytes))
            parts = [p.text for p in doc.paragraphs if p.text.strip()]
            for table in doc.tables:
                for row in table.rows:
                    row_text = " | ".join([cell.text.strip() for cell in row.cells if cell.text.strip()])
                    if row_text:
                        parts.append(row_text)
            extracted_text = "\n".join(parts)
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                detail=f"Corrupted or unreadable DOCX document: {str(e)}"
            )

    # Truncate extracted text to 20,000 characters
    extracted_text = extracted_text[:20000]

    # 4. Intelligence analysis (strict JSON, capped at 60, prompt injection safe, deterministic fallback)
    intel_result = resume_intel.analyze_resume_intelligence(extracted_text, target_role=target_role or "Software Engineer")
    skill_tree = intel_result["skill_tree"]
    weaknesses = intel_result["weaknesses"]
    matrix = intel_result["matrix"]
    resolved_target_role = intel_result.get("target_role", target_role)

    # 5. 30-Day Chamber Schedule generation
    schedule_data = schedule_mod.generate_schedule(weaknesses, matrix)

    # 6. Save results to player_profile (never store file or log resume text)
    database.save_onboarding_results(
        user_id=current_user["id"],
        dsa=matrix["dsa"],
        system_design=matrix["system_design"],
        cleanliness=matrix["cleanliness"],
        skill_tree={"skill_tree": skill_tree, "weaknesses": weaknesses},
        schedule=schedule_data
    )

    return {
        "matrix": matrix,
        "skill_tree": skill_tree,
        "weaknesses": weaknesses,
        "target_role": resolved_target_role,
        "schedule": schedule_data["schedule"],
        "taunts": schedule_data["taunts"]
    }

@app.post("/analyze")
async def process_career_cycle(
    file: UploadFile = File(...),
    target_role: Optional[str] = Form("Software Engineer"),
    current_user: dict = Depends(get_current_user)
):
    """Backwards-compatible alias for /resume/analyze"""
    return await analyze_resume_endpoint(file=file, target_role=target_role, current_user=current_user)

@app.get("/profile/matrix")
def get_matrix_endpoint(current_user: dict = Depends(get_current_user)):
    return database.get_profile_matrix(current_user["id"])

@app.get("/profile/matrix/history")
def get_matrix_history_endpoint(
    limit: int = 20,
    offset: int = 0,
    current_user: dict = Depends(get_current_user)
):
    return database.get_matrix_history(current_user["id"], limit=limit, offset=offset)

@app.get("/profile/nxp-ledger")
def get_nxp_ledger_endpoint(
    limit: int = 20,
    offset: int = 0,
    current_user: dict = Depends(get_current_user)
):
    return database.get_nxp_ledger(current_user["id"], limit=limit, offset=offset)

@app.get("/profile/schedule")
def get_schedule_endpoint(current_user: dict = Depends(get_current_user)):
    return database.get_profile_schedule(current_user["id"])

@app.get("/profile/skill-tree")
def get_skill_tree_endpoint(current_user: dict = Depends(get_current_user)):
    return database.get_profile_skill_tree(current_user["id"])

@app.post("/profile/intro-seen")
def mark_intro_seen_endpoint(current_user: dict = Depends(get_current_user)):
    database.mark_intro_seen(current_user["id"])
    return {"status": "ok", "intro_seen": True}

# --- ARIA MENTOR ENDPOINTS ---
import aria as aria_mod
from collections import defaultdict

_user_aria_timestamps = defaultdict(list)

def check_aria_rate_limit(user_id: int):
    now = time.time()
    window_start = now - 60.0
    timestamps = [ts for ts in _user_aria_timestamps[user_id] if ts > window_start]
    if len(timestamps) >= 20:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Rate limit exceeded. Maximum 20 ARIA requests per minute."
        )
    timestamps.append(now)
    _user_aria_timestamps[user_id] = timestamps

class AriaChatRequest(BaseModel):
    message: str
    code: Optional[str] = ""
    challenge_id: str
    language: Optional[str] = "python"
    is_stuck: Optional[bool] = False

@app.post("/aria/chat")
def aria_chat_endpoint(
    payload: AriaChatRequest,
    current_user: dict = Depends(get_current_user)
):
    user_id = current_user["id"]
    check_aria_rate_limit(user_id)

    # Input length validation
    if len(payload.message) > 1000:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Message exceeds 1,000 character limit."
        )
    if payload.code and len(payload.code.encode("utf-8")) > 20 * 1024:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Code exceeds 20 KB limit."
        )

    challenge_id = payload.challenge_id.strip()
    if not challenge_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Challenge ID is required."
        )

    # Hint level handling
    if payload.is_stuck or ("stuck" in payload.message.lower() and "hint" in payload.message.lower()):
        hint_level = database.increment_aria_hint_level(user_id, challenge_id)
    else:
        hint_level = database.get_aria_hint_level(user_id, challenge_id)

    # Get or create challenge chat session and save user message
    session_id = database.get_or_create_aria_session(user_id, challenge_id)
    database.save_chat_message(session_id, "user", payload.message)

    # Generate ARIA response
    reply = aria_mod.ask_aria(
        user_message=payload.message,
        code=payload.code or "",
        challenge_context={"title": challenge_id, "statement": ""},
        hint_level=hint_level
    )

    # Save ARIA response in chat history
    database.save_chat_message(session_id, "assistant", reply)

    return {
        "reply": reply,
        "hint_level": hint_level
    }

@app.get("/aria/history")
def aria_history_endpoint(
    challenge_id: str,
    current_user: dict = Depends(get_current_user)
):
    user_id = current_user["id"]
    history = database.get_aria_history(user_id, challenge_id)
    hint_level = database.get_aria_hint_level(user_id, challenge_id)
    return {
        "history": history,
        "hint_level": hint_level
    }

# --- CHAMBER ENGINE & WEBSOCKET ENDPOINTS (Phase 5) ---
import chamber_engine
import ws
from typing import List, Optional
from fastapi import WebSocket, WebSocketDisconnect
from models import (
    ChamberSummary,
    EnterChamberResponse,
    CurrentChamberResponse,
    ChamberSubmitRequest,
    ChamberSubmitResponse,
    TicketResponse
)

@app.get("/chambers", response_model=List[ChamberSummary])
def get_chambers_endpoint(current_user: dict = Depends(get_current_user)):
    return chamber_engine.get_all_user_chambers(current_user["id"])

@app.post("/chambers/{chamber_no}/prepare")
async def prepare_chamber_endpoint(
    chamber_no: int,
    current_user: dict = Depends(get_current_user)
):
    if chamber_no < 1 or chamber_no > 6:
        raise HTTPException(status_code=400, detail="Chamber number must be between 1 and 6.")
    try:
        st = chamber_engine.get_or_init_user_chamber_state(current_user["id"], chamber_no)
        if st["state"] == chamber_engine.ChamberState.UNLOCKED:
            updated = chamber_engine.set_chamber_state(
                user_id=current_user["id"],
                chamber_no=chamber_no,
                target_state=chamber_engine.ChamberState.PREPARING
            )
            await ws.ws_manager.broadcast_to_user(current_user["id"], {
                "type": "state",
                "payload": {"chamber_no": chamber_no, "state": updated["state"]}
            })
            return updated
        return st
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/chambers/{chamber_no}/enter", response_model=EnterChamberResponse)
async def enter_chamber_endpoint(
    chamber_no: int,
    current_user: dict = Depends(get_current_user)
):
    if chamber_no < 1 or chamber_no > 6:
        raise HTTPException(status_code=400, detail="Chamber number must be between 1 and 6.")
    try:
        res = chamber_engine.enter_chamber(current_user["id"], chamber_no)
        await ws.ws_manager.broadcast_to_user(current_user["id"], {
            "type": "state",
            "payload": {"chamber_no": chamber_no, "state": res["state"]}
        })
        return res
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/chambers/{chamber_no}/current", response_model=CurrentChamberResponse)
def get_current_chamber_endpoint(
    chamber_no: int,
    current_user: dict = Depends(get_current_user)
):
    if chamber_no < 1 or chamber_no > 6:
        raise HTTPException(status_code=400, detail="Chamber number must be between 1 and 6.")
    return chamber_engine.get_current_chamber_info(current_user["id"], chamber_no)

@app.post("/chambers/{chamber_no}/submit", response_model=ChamberSubmitResponse, status_code=status.HTTP_202_ACCEPTED)
async def submit_chamber_endpoint(
    chamber_no: int,
    payload: ChamberSubmitRequest,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user)
):
    if chamber_no < 1 or chamber_no > 6:
        raise HTTPException(status_code=400, detail="Chamber number must be between 1 and 6.")
    try:
        # Pre-validates code size, deadline (+5s grace), ACTIVE state, moves to EVALUATING
        result = chamber_engine.record_chamber_submission(
            user_id=current_user["id"],
            chamber_no=chamber_no,
            code=payload.code,
            language=payload.language
        )
        await ws.ws_manager.broadcast_to_user(current_user["id"], {
            "type": "state",
            "payload": {"chamber_no": chamber_no, "state": result["state"]}
        })

        # Launch background grading & evaluation pipeline
        background_tasks.add_task(
            chamber_engine.process_chamber_submission_pipeline,
            user_id=current_user["id"],
            chamber_no=chamber_no,
            code=payload.code,
            language=payload.language
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

class ChamberRunTestRequest(BaseModel):
    code: str
    language: str = "python"

@app.post("/chambers/{chamber_no}/run")
async def run_chamber_public_tests_endpoint(
    chamber_no: int,
    payload: ChamberRunTestRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Executes player code against public examples only.
    Does not increment attempts, does not update chamber state or streaks.
    """
    if chamber_no < 1 or chamber_no > 6:
        raise HTTPException(status_code=400, detail="Chamber number must be between 1 and 6.")

    code = payload.code
    if not code or not code.strip():
        raise HTTPException(status_code=400, detail="Code cannot be empty.")

    if len(code.encode("utf-8")) > 20 * 1024:
        raise HTTPException(status_code=400, detail="Code exceeds 20 KB limit.")

    # 1. Static pre-check
    pre = evaluator.pre_check_code(code)
    if not pre["passed"]:
        return {
            "success": False,
            "error": pre["message"],
            "reason": pre["reason"],
            "results": [],
            "stdout": pre["message"]
        }

    # 2. Get active or default challenge
    ch_info = chamber_engine.get_current_chamber_info(current_user["id"], chamber_no)
    challenge = ch_info.get("challenge")
    if not challenge:
        ch_def = chamber_engine.get_chamber_definition(chamber_no) or {}
        if ch_def.get("challenges"):
            challenge = ch_def["challenges"][0]

    if not challenge:
        raise HTTPException(status_code=404, detail=f"Challenge for Chamber {chamber_no} not found.")

    entry_point = challenge.get("entry_point", "solution")
    examples = challenge.get("public_examples", [])
    if not examples:
        examples = challenge.get("hidden_tests", [])

    program_code = harness.build_program(code, entry_point)

    submissions = []
    for ex in examples:
        stdin_json = harness.prepare_test_stdin(ex.get("input"))
        submissions.append({
            "source_code": program_code,
            "stdin": stdin_json,
            "cpu_time_limit": 2.0,
            "memory_limit": 128000
        })

    judge_results = await judge0.execute_batch(submissions)

    results = []
    user_stdouts = []
    all_passed = True if len(examples) > 0 else False

    for idx, ex in enumerate(examples):
        j_res = judge_results[idx] if idx < len(judge_results) else {
            "status": "internal_error", "time_ms": 0, "stdout": "", "error_message": ""
        }

        parsed = harness.parse_harness_output(j_res.get("stdout", ""))
        if parsed.get("stdout"):
            user_stdouts.append(parsed["stdout"])

        if j_res.get("status") == "passed":
            if parsed.get("found") and not parsed.get("error"):
                is_correct = harness.compare_results(parsed.get("result"), ex.get("output"))
                test_status = "passed" if is_correct else "wrong_answer"
            elif parsed.get("error"):
                test_status = "runtime_error"
            else:
                test_status = "wrong_answer"
        else:
            test_status = j_res.get("status", "internal_error")

        passed = (test_status == "passed")
        if not passed:
            all_passed = False

        results.append({
            "example_no": idx + 1,
            "input": ex.get("input"),
            "expected": ex.get("output"),
            "actual": str(parsed.get("result")) if parsed.get("found") and not parsed.get("error") else None,
            "passed": passed,
            "status": test_status,
            "time_ms": j_res.get("time_ms", 0),
            "error": parsed.get("error") or j_res.get("error_message") or None
        })

    return {
        "success": True,
        "all_passed": all_passed,
        "results": results,
        "stdout": "\n".join(user_stdouts)
    }

class NexusTauntRequest(BaseModel):
    event_type: str = "failed"
    chamber_no: int = 1
    challenge_title: str = "Sector Trial"
    complexity_estimate: str = "O(n)"
    top_findings: list[str] = []
    attempts: int = 1
    streak: int = 0
    time_used_pct: int = 50

@app.post("/nexus/taunt")
async def generate_nexus_taunt_endpoint(
    payload: NexusTauntRequest,
    current_user: dict = Depends(get_current_user)
):
    check_endpoint_rate_limit("nexus_taunt", current_user["id"], limit=30)
    taunt_data = payload.model_dump() if hasattr(payload, "model_dump") else payload.dict()
    text = await nexus_ai.generate_taunt(taunt_data)
    return {"text": text}


# --- DEMO MODE BACKDOOR ENDPOINT ---
@app.post("/dev/unlock-chamber/{chamber_no}")
async def dev_unlock_chamber(
    chamber_no: int,
    current_user: dict = Depends(get_current_user)
):
    """
    Backdoor chamber unlock endpoint active ONLY when DEMO_MODE=true.
    Returns 404 whenever DEMO_MODE is false or unset.
    """
    if not DEMO_MODE:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dev backdoor is disabled. DEMO_MODE is not active."
        )
    if chamber_no < 1 or chamber_no > 6:
        raise HTTPException(status_code=400, detail="Chamber number must be between 1 and 6.")

    import sqlite3
    conn = sqlite3.connect(database.DB_PATH)
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO chamber_state (user_id, chamber_no, state, attempts)
        VALUES (?, ?, 'UNLOCKED', 0)
        ON CONFLICT(user_id, chamber_no) DO UPDATE SET state = 'UNLOCKED'
    """, (current_user["id"], chamber_no))
    cursor.execute("""
        UPDATE player_profile 
        SET current_chamber = MAX(current_chamber, ?) 
        WHERE user_id = ?
    """, (chamber_no, current_user["id"]))
    conn.commit()
    conn.close()

    await ws.ws_manager.broadcast_to_user(current_user["id"], {
        "type": "state",
        "payload": {"chamber_no": chamber_no, "state": "UNLOCKED"}
    })
    return {"status": "unlocked", "chamber_no": chamber_no, "state": "UNLOCKED"}


# --- CHAMBER 6 FINALE INTERVIEW ENDPOINTS (SCRUM-28) ---
class FinaleQuizSubmitRequest(BaseModel):
    answers: Dict[str, str]

class FinaleDesignSubmitRequest(BaseModel):
    answer: str

_finale_rate_limit_timestamps = defaultdict(list)

def check_finale_rate_limit(user_id: int):
    now = time.time()
    window_start = now - 60.0
    timestamps = [ts for ts in _finale_rate_limit_timestamps[user_id] if ts > window_start]
    if len(timestamps) >= 30:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Rate limit exceeded for finale interview. Please slow down."
        )
    timestamps.append(now)
    _finale_rate_limit_timestamps[user_id] = timestamps


@app.post("/finale/start")
async def start_finale_endpoint(current_user: dict = Depends(get_current_user)):
    check_finale_rate_limit(current_user["id"])
    if not database.check_chambers_1_to_5_passed(current_user["id"]):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Chambers 1-5 must all be PASSED before entering the Finale."
        )

    st = database.get_finale_state(current_user["id"])
    if st and st.get("state") == "ACTIVE":
        return st

    now = datetime.utcnow()
    deadline = now + timedelta(seconds=1200)
    initial_scores = {
        "coding": {"passed": False, "score": 0},
        "quiz": {"score": 0},
        "design": {"score": 0}
    }
    st = database.upsert_finale_state(
        user_id=current_user["id"],
        round_no=1,
        state="ACTIVE",
        started_at=now,
        deadline_at=deadline,
        scores=initial_scores
    )
    chamber_engine.set_chamber_state(current_user["id"], 6, chamber_engine.ChamberState.ACTIVE)
    await ws.ws_manager.broadcast_to_user(current_user["id"], {
        "type": "nexus",
        "payload": {"text": finale.INTERVIEWER_LINES["round_1_start"]}
    })
    return st


@app.get("/finale/state")
def get_finale_state_endpoint(current_user: dict = Depends(get_current_user)):
    check_finale_rate_limit(current_user["id"])
    if not database.check_chambers_1_to_5_passed(current_user["id"]):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Chambers 1-5 must all be PASSED before entering the Finale."
        )

    st = database.get_finale_state(current_user["id"])
    if not st:
        return {"state": "NOT_STARTED", "unlocked": True}

    seconds_remaining = 0
    if st.get("deadline_at"):
        try:
            dl = datetime.fromisoformat(st["deadline_at"])
            delta = (dl - datetime.utcnow()).total_seconds()
            seconds_remaining = max(0, int(delta))
        except Exception:
            seconds_remaining = 0

    content = {}
    r = st.get("round", 1)
    if r == 1:
        ch6_info = chamber_engine.get_current_chamber_info(current_user["id"], 6)
        content = {"challenge": ch6_info.get("challenge")}
    elif r == 2:
        content = {"questions": finale.load_quiz_questions(strip_answers=True)}
    elif r == 3:
        content = {"prompt": finale.SYSTEM_DESIGN_PROMPT}
    elif r >= 4 or st.get("state") in ("COMPLETED", "FAILED"):
        content = {"results": st.get("scores", {})}

    res = dict(st)
    res["seconds_remaining"] = seconds_remaining
    res["content"] = content
    return res


@app.post("/finale/coding/submit")
async def submit_finale_coding_endpoint(
    payload: ChamberSubmitRequest,
    current_user: dict = Depends(get_current_user)
):
    check_finale_rate_limit(current_user["id"])
    st = database.get_finale_state(current_user["id"])
    if not st or st.get("round") != 1 or st.get("state") != "ACTIVE":
        raise HTTPException(status_code=400, detail="Not in coding round.")

    if st.get("deadline_at"):
        try:
            dl = datetime.fromisoformat(st["deadline_at"])
            if datetime.utcnow() > dl + timedelta(seconds=5):
                raise HTTPException(status_code=400, detail="Coding round deadline expired.")
        except HTTPException:
            raise
        except Exception:
            pass

    code_bytes = len(payload.code.encode("utf-8"))
    if code_bytes > 20 * 1024:
        raise HTTPException(status_code=400, detail="Code exceeds 20 KB limit.")

    ch_def = chamber_engine.get_chamber_definition(6) or {}
    challenges = ch_def.get("challenges", [])
    if not challenges:
        raise HTTPException(status_code=500, detail="Chamber 6 coding challenge definition missing.")
    challenge = challenges[0]

    eval_res = await chamber_engine.evaluate_code(challenge, payload.code)
    all_passed = eval_res.get("all_passed", False)

    scores = st.get("scores", {})
    scores["coding"] = {
        "passed": all_passed,
        "score": 100 if all_passed else 0,
        "complexity": eval_res.get("complexity", "O(n)"),
        "cleanliness": eval_res.get("cleanliness", 100),
        "inefficient": eval_res.get("inefficient", False),
        "tests": eval_res.get("tests", [])
    }

    if all_passed:
        now = datetime.utcnow()
        quiz_deadline = now + timedelta(seconds=300)
        st = database.upsert_finale_state(
            user_id=current_user["id"],
            round_no=2,
            state="ACTIVE",
            started_at=now,
            deadline_at=quiz_deadline,
            scores=scores
        )
        await ws.ws_manager.broadcast_to_user(current_user["id"], {
            "type": "nexus",
            "payload": {"text": finale.INTERVIEWER_LINES["round_1_pass"]}
        })
    else:
        st = database.upsert_finale_state(
            user_id=current_user["id"],
            round_no=1,
            state="ACTIVE",
            started_at=st["started_at"],
            deadline_at=st["deadline_at"],
            scores=scores
        )

    return {
        "passed": all_passed,
        "evaluation": eval_res,
        "scores": scores,
        "round": st.get("round", 1)
    }


@app.post("/finale/quiz/submit")
async def submit_finale_quiz_endpoint(
    payload: FinaleQuizSubmitRequest,
    current_user: dict = Depends(get_current_user)
):
    check_finale_rate_limit(current_user["id"])
    if len(payload.answers) > 20:
        raise HTTPException(status_code=400, detail="Quiz answers payload exceeds maximum size.")
    st = database.get_finale_state(current_user["id"])
    if not st or st.get("round") != 2 or st.get("state") != "ACTIVE":
        raise HTTPException(status_code=400, detail="Not in quiz round.")

    if st.get("deadline_at"):
        try:
            dl = datetime.fromisoformat(st["deadline_at"])
            if datetime.utcnow() > dl + timedelta(seconds=5):
                raise HTTPException(status_code=400, detail="Quiz round deadline expired.")
        except HTTPException:
            raise
        except Exception:
            pass

    quiz_eval = finale.score_quiz(payload.answers)
    scores = st.get("scores", {})
    scores["quiz"] = quiz_eval

    now = datetime.utcnow()
    design_deadline = now + timedelta(seconds=600)
    st = database.upsert_finale_state(
        user_id=current_user["id"],
        round_no=3,
        state="ACTIVE",
        started_at=now,
        deadline_at=design_deadline,
        scores=scores
    )
    await ws.ws_manager.broadcast_to_user(current_user["id"], {
        "type": "nexus",
        "payload": {"text": finale.INTERVIEWER_LINES["round_2_complete"]}
    })
    return {
        "quiz": quiz_eval,
        "scores": scores,
        "round": 3
    }


@app.post("/finale/design/submit")
async def submit_finale_design_endpoint(
    payload: FinaleDesignSubmitRequest,
    current_user: dict = Depends(get_current_user)
):
    check_finale_rate_limit(current_user["id"])
    st = database.get_finale_state(current_user["id"])
    if not st or st.get("round") != 3 or st.get("state") != "ACTIVE":
        raise HTTPException(status_code=400, detail="Not in system design round.")

    if st.get("deadline_at"):
        try:
            dl = datetime.fromisoformat(st["deadline_at"])
            if datetime.utcnow() > dl + timedelta(seconds=5):
                raise HTTPException(status_code=400, detail="System design deadline expired.")
        except HTTPException:
            raise
        except Exception:
            pass

    if len(payload.answer) > 2000:
        raise HTTPException(status_code=400, detail="Design response exceeds 2,000 character maximum.")

    design_eval = finale.evaluate_system_design(payload.answer)
    scores = st.get("scores", {})
    scores["design"] = design_eval

    coding_passed = scores.get("coding", {}).get("passed", False)
    quiz_score = scores.get("quiz", {}).get("score", 0)
    design_score = design_eval.get("total", 50)

    overall = finale.calculate_overall_finale_score(coding_passed, quiz_score, design_score)
    scores["overall"] = overall

    final_state = "COMPLETED" if overall["passed"] else "FAILED"
    award_data = None

    if overall["passed"]:
        award_data = database.commit_finale_award(current_user["id"])
        scores["award"] = award_data
        await ws.ws_manager.broadcast_to_user(current_user["id"], {
            "type": "progress",
            "payload": {
                "nxp_awarded": award_data.get("nxp_awarded", 0),
                "total_nxp": award_data.get("total_nxp", 0),
                "streak": award_data.get("streak", 0),
                "multiplier": 1.0,
                "matrix": award_data.get("matrix", {}),
                "deltas": award_data.get("deltas", {})
            }
        })
        await ws.ws_manager.broadcast_to_user(current_user["id"], {
            "type": "nexus",
            "payload": {"text": finale.INTERVIEWER_LINES["finale_pass"]}
        })
    else:
        await ws.ws_manager.broadcast_to_user(current_user["id"], {
            "type": "nexus",
            "payload": {"text": finale.INTERVIEWER_LINES["finale_fail"]}
        })

    database.upsert_finale_state(
        user_id=current_user["id"],
        round_no=4,
        state=final_state,
        started_at=st["started_at"],
        deadline_at=None,
        scores=scores
    )

    return {
        "design": design_eval,
        "overall": overall,
        "award": award_data,
        "state": final_state
    }


@app.get("/finale/results")
def get_finale_results_endpoint(current_user: dict = Depends(get_current_user)):
    check_finale_rate_limit(current_user["id"])
    st = database.get_finale_state(current_user["id"])
    if not st:
        raise HTTPException(status_code=404, detail="No finale interview record found.")
    return {
        "state": st.get("state"),
        "scores": st.get("scores", {}),
        "round": st.get("round", 1)
    }


# --- PHASE 9B: COMPANY BIDS & GITHUB TROPHY (SCRUM-29, SCRUM-30) ---
class TrophyClaimRequest(BaseModel):
    confirm: bool = False
    create_repo_if_missing: bool = False


@app.get("/finale/bids")
def get_finale_bids_endpoint(current_user: dict = Depends(get_current_user)):
    check_finale_rate_limit(current_user["id"])
    st = database.get_finale_state(current_user["id"])
    if not st or st.get("state") != "COMPLETED":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Company bids unlock only after the Finale is COMPLETED."
        )

    metrics = database.get_player_style_metrics(current_user["id"])
    result = bids.generate_bids_and_analysis(metrics)
    return result


@app.post("/trophy/preview")
async def get_trophy_preview_endpoint(current_user: dict = Depends(get_current_user)):
    user_dict = dict(current_user)
    check_finale_rate_limit(user_dict["id"])
    enc_token = user_dict.get("github_token_enc")
    if not enc_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="GitHub token missing. Please log in with GitHub."
        )

    import auth_github
    try:
        token = auth_github.decrypt_token(enc_token)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Unable to decrypt GitHub token. Please log in again."
        )

    login = user_dict.get("github_username")
    if not login:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No GitHub username associated with this cadet account."
        )

    prof = database.get_player_profile(user_dict["id"]) or {}
    total_nxp = prof.get("total_nxp", 0)

    client = github_trophy.GitHubTrophyClient(token, login)
    readme_info = await client.get_profile_readme()

    trophy_block = github_trophy.generate_trophy_block(
        total_nxp=total_nxp,
        chambers_completed=6
    )

    original_content = readme_info.get("content", "")
    updated_content, already_claimed = github_trophy.update_readme_trophy(
        original_content,
        trophy_block
    )

    diff_str = github_trophy.compute_readme_diff(original_content, updated_content)

    return {
        "repo_name": f"{login}/{login}",
        "repo_exists": readme_info["repo_exists"],
        "readme_exists": readme_info["readme_exists"],
        "already_claimed": already_claimed,
        "preview_diff": diff_str,
        "trophy_markdown": trophy_block,
        "updated_content": updated_content
    }


@app.post("/trophy/claim")
async def claim_trophy_endpoint(
    payload: TrophyClaimRequest,
    current_user: dict = Depends(get_current_user)
):
    user_dict = dict(current_user)
    check_finale_rate_limit(user_dict["id"])
    if not payload.confirm:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Confirmation is required to claim and commit your trophy badge."
        )

    enc_token = user_dict.get("github_token_enc")
    if not enc_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="GitHub token missing. Please log in with GitHub."
        )

    import auth_github
    try:
        token = auth_github.decrypt_token(enc_token)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Unable to decrypt GitHub token. Please log in again."
        )

    login = user_dict.get("github_username")
    if not login:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No GitHub username associated with this cadet account."
        )

    prof = database.get_player_profile(user_dict["id"]) or {}
    total_nxp = prof.get("total_nxp", 0)

    client = github_trophy.GitHubTrophyClient(token, login)
    readme_info = await client.get_profile_readme()

    if not readme_info["repo_exists"]:
        if payload.create_repo_if_missing:
            await client.create_profile_repo()
            readme_info = await client.get_profile_readme()
        else:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Profile repository {login}/{login} does not exist. Please confirm repository creation."
            )

    trophy_block = github_trophy.generate_trophy_block(
        total_nxp=total_nxp,
        chambers_completed=6
    )

    original_content = readme_info.get("content", "")
    updated_content, already_claimed = github_trophy.update_readme_trophy(
        original_content,
        trophy_block
    )

    if already_claimed:
        return {
            "status": "already claimed",
            "already_claimed": True,
            "verified": False,
            "verification_reason": "already_present",
            "message": "Trophy is already present in your profile README."
        }

    commit_res = await client.commit_readme_trophy(
        new_content=updated_content,
        sha=readme_info["sha"]
    )
    return commit_res


# --- CONSTRUCT SANDBOX EXECUTION (PHASE 6) ---
class ConstructRunRequest(BaseModel):
    prompt_id: str
    code: str

_construct_run_timestamps = defaultdict(list)

def check_construct_rate_limit(user_id: int):
    now = time.time()
    window_start = now - 60.0
    timestamps = [ts for ts in _construct_run_timestamps[user_id] if ts > window_start]
    if len(timestamps) >= 10:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Rate limit exceeded. Maximum 10 Construct executions per minute."
        )
    timestamps.append(now)
    _construct_run_timestamps[user_id] = timestamps

CONSTRUCT_PROMPTS_PATH = os.path.join(
    os.path.dirname(__file__), "..", "frontend", "src", "data", "construct_prompts.json"
)

def get_construct_prompt_data(prompt_id: str) -> Optional[dict]:
    try:
        with open(CONSTRUCT_PROMPTS_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
            for p in data:
                if p.get("id") == prompt_id:
                    return p
    except Exception as e:
        print(f"Error loading construct prompts: {e}")
    return None

@app.post("/construct/run")
async def run_construct_sandbox_endpoint(
    payload: ConstructRunRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Executes player code in the Construct sandbox against public examples only.
    Rate-limited to 10 requests per minute per user.
    """
    check_construct_rate_limit(current_user["id"])

    prompt = get_construct_prompt_data(payload.prompt_id)
    if not prompt:
        raise HTTPException(status_code=404, detail=f"Prompt '{payload.prompt_id}' not found.")

    code = payload.code
    if not code or not code.strip():
        raise HTTPException(status_code=400, detail="Code cannot be empty.")

    # 1. Static pre-check
    pre = evaluator.pre_check_code(code)
    if not pre["passed"]:
        return {
            "success": False,
            "error": pre["message"],
            "reason": pre["reason"],
            "results": [],
            "stdout": pre["message"]
        }

    # 2. Resolve entry point from prompt or starter code
    entry_point = prompt.get("entry_point")
    if not entry_point:
        m = re.search(r"def\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(", prompt.get("starter_code", ""))
        entry_point = m.group(1) if m else "solution"

    examples = prompt.get("examples", [])
    program_code = harness.build_program(code, entry_point)

    submissions = []
    for ex in examples:
        stdin_json = harness.prepare_test_stdin(ex.get("input"))
        submissions.append({
            "source_code": program_code,
            "stdin": stdin_json,
            "cpu_time_limit": 2.0,
            "memory_limit": 128000
        })

    judge_results = await judge0.execute_batch(submissions)

    results = []
    user_stdouts = []
    all_passed = True if len(examples) > 0 else False

    for idx, ex in enumerate(examples):
        j_res = judge_results[idx] if idx < len(judge_results) else {
            "status": "internal_error", "time_ms": 0, "stdout": "", "error_message": ""
        }

        parsed = harness.parse_harness_output(j_res.get("stdout", ""))
        if parsed.get("stdout"):
            user_stdouts.append(parsed["stdout"])

        if j_res.get("status") == "passed":
            if parsed.get("found") and not parsed.get("error"):
                is_correct = harness.compare_results(parsed.get("result"), ex.get("output"))
                test_status = "passed" if is_correct else "wrong_answer"
            elif parsed.get("error"):
                test_status = "runtime_error"
            else:
                test_status = "wrong_answer"
        else:
            test_status = j_res.get("status", "internal_error")

        passed = (test_status == "passed")
        if not passed:
            all_passed = False

        results.append({
            "example_no": idx + 1,
            "input": ex.get("input"),
            "expected": ex.get("output"),
            "actual": str(parsed.get("result")) if parsed.get("found") and not parsed.get("error") else None,
            "passed": passed,
            "status": test_status,
            "time_ms": j_res.get("time_ms", 0),
            "error": parsed.get("error") or j_res.get("error_message") or None,
            "stdout": parsed.get("stdout", "")
        })

    return {
        "success": all_passed,
        "results": results,
        "stdout": "\n".join(user_stdouts)
    }

@app.post("/ws/ticket", response_model=TicketResponse)
def get_ws_ticket_endpoint(current_user: dict = Depends(get_current_user)):
    ticket = ws.create_ws_ticket(current_user["id"], ttl_seconds=30)
    return {"ticket": ticket, "expires_in": 30}

@app.websocket("/ws/chamber")
async def websocket_chamber_endpoint(
    websocket: WebSocket,
    ticket: Optional[str] = None
):
    param_ticket = ticket or websocket.query_params.get("ticket")
    user_id = ws.validate_and_consume_ticket(param_ticket)
    if user_id is None:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    await ws.ws_manager.connect(user_id, websocket)
    try:
        chambers_overview = chamber_engine.get_all_user_chambers(user_id)
        await websocket.send_json({
            "type": "state",
            "payload": {"chambers": chambers_overview}
        })
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        ws.ws_manager.disconnect(user_id, websocket)
    except Exception:
        ws.ws_manager.disconnect(user_id, websocket)

class UpdateProjectsRequest(BaseModel):
    projects: list

@app.post("/update-generated-projects")
async def update_generated_projects(req: UpdateProjectsRequest, current_user: dict = Depends(get_current_user)):
    try:
        success = database.update_latest_profile_projects(req.projects, user_id=current_user["id"])
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
    sess = database.get_chat_session(session_id)
    if sess and sess.get("user_id") != user["id"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden: You do not own this chat session.")
    history = database.get_chat_history(session_id)
    return {"messages": history}

@app.delete("/chat/sessions/{session_id}")
async def delete_chat_session(session_id: str, user: dict = Depends(get_current_user)):
    sess = database.get_chat_session(session_id)
    if sess and sess.get("user_id") != user["id"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden: You do not own this chat session.")
    try:
        database.delete_chat_session(session_id)
        return {"status": "deleted"}
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})

@app.post("/chat")
def career_chat(req: ChatRequest, user: dict = Depends(get_current_user)):
    check_endpoint_rate_limit("career_chat", user["id"], limit=20)
    if len(req.message) > 2000:
        raise HTTPException(status_code=400, detail="Message exceeds 2,000 character maximum.")
    
    sess = database.get_chat_session(req.session_id)
    if sess and sess.get("user_id") != user["id"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden: You do not own this chat session.")

    history = database.get_profile_by_user_id(user['id'])
    if not history:
        return {"response": "Please upload a resume first."}
        
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
            model=MODEL,
            messages=messages
        )
        reply = response.choices[0].message.content
        
        # Save Bot Msg
        database.save_chat_message(req.session_id, "assistant", reply)
        
        # Auto-Rename if first message
        if len(past_msgs) == 0:
             new_title = req.message.split('\n')[0][:30]
             database.rename_chat_session(req.session_id, new_title)

        return {"response": reply}
    except Exception as e:
        return {"response": f"I'm having trouble thinking right now. ({str(e)})"}

@app.get("/history")
async def get_history(user: dict = Depends(get_current_user)):
    return database.get_all_profiles(user_id=user["id"])

@app.get("/history/{profile_id}")
async def load_history_item(profile_id: int, user: dict = Depends(get_current_user)):
    data = database.get_profile_by_id(profile_id, user_id=user["id"])
    if not data:
        raise HTTPException(status_code=404, detail="Profile record not found")
    return data

@app.delete("/history/{profile_id}")
async def delete_history_item(profile_id: int, user: dict = Depends(get_current_user)):
    deleted = database.delete_profile(profile_id, user_id=user["id"])
    if not deleted:
        raise HTTPException(status_code=404, detail="Profile record not found")
    return {"message": "Deleted successfully"}
    

# --- Resume Builder API ---

class ResumeBuildRequest(BaseModel):
    job_description: str

@app.post("/resume/build")
async def build_resume(req: ResumeBuildRequest, user: dict = Depends(get_current_user)):
    check_endpoint_rate_limit("resume_build", user["id"], limit=10)
    if len(req.job_description) > 5000:
        raise HTTPException(status_code=400, detail="Job description exceeds 5,000 character maximum.")
    try:
        profile = database.get_profile_by_user_id(user['id']) or {}
        active_projects = database.get_all_active_projects(user['id']) 
        
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
async def get_project(project_id: str, user: dict = Depends(get_current_user)):
    p = database.get_project_by_id(project_id, user_id=user["id"])
    if p:
        return p
    raise HTTPException(status_code=404, detail="Project not found")

@app.post("/project/unlock-phase")
async def unlock_phase(req: UpdatePhaseRequest, user: dict = Depends(get_current_user)):
    try:
        p = database.get_project_by_id(req.project_id, user_id=user["id"])
        if not p:
            raise HTTPException(status_code=404, detail="Project not found")
            
        if p['current_phase'] == req.phase_id:
             database.update_phase_progress(req.project_id, req.phase_id + 1)
             new_stage = database.recalculate_user_growth(None)
             return {"status": "updated", "new_stage": new_stage}
             
        return {"status": "no_change"}
    except HTTPException:
        raise
    except Exception as e:
        print(f"Unlock Error: {e}")
        return {"status": "error"}

@app.delete("/project/{project_id}")
async def delete_project(project_id: str, user: dict = Depends(get_current_user)):
    p = database.get_project_by_id(project_id, user_id=user["id"])
    if not p:
        raise HTTPException(status_code=404, detail="Project not found")
    try:
        database.delete_project(project_id, user_id=user["id"])
        return {"status": "deleted"}
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})

# --- SESSION & COLLABORATION API ---
import random
import string

SESSION_CODES = {}

class SessionRequest(BaseModel):
    project_id: str

class JoinSessionRequest(BaseModel):
    code: str

class SyncCodeRequest(BaseModel):
    project_id: str
    code: str

@app.post("/session/create")
async def create_session(req: SessionRequest, user: dict = Depends(get_current_user)):
    p = database.get_project_by_id(req.project_id, user_id=user["id"])
    if not p:
        raise HTTPException(status_code=404, detail="Project not found")
    code = ''.join(random.choices(string.digits, k=6))
    SESSION_CODES[code] = req.project_id
    return {"code": code}

@app.post("/session/join")
async def join_session(req: JoinSessionRequest, user: dict = Depends(get_current_user)):
    project_id = SESSION_CODES.get(req.code)
    if not project_id:
        raise HTTPException(status_code=404, detail="Invalid Session Code")
    return {"project_id": project_id}

@app.post("/project/sync")
async def sync_code(req: SyncCodeRequest, user: dict = Depends(get_current_user)):
    if len(req.code.encode("utf-8")) > MAX_CODE_SIZE:
        raise HTTPException(status_code=400, detail="Code exceeds 20 KB limit.")
    database.update_project_code(req.project_id, req.code)
    return {"status": "synced"}

@app.get("/project/{project_id}/sync")
async def get_latest_code(project_id: str, user: dict = Depends(get_current_user)):
    p = database.get_project_by_id(project_id, user_id=user["id"])
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
async def update_profile(req: ProfileUpdateRequest, user: dict = Depends(get_current_user)):
    p = database.get_profile_by_user_id(user['id'])
    if not p: raise HTTPException(status_code=404, detail="Profile not found")
    data = req.dict() if hasattr(req, "dict") else req.model_dump()
    database.update_profile_details(p['id'], data)
    return {"status": "updated"}

@app.post("/profile/goals")
async def add_goal(req: GoalRequest, user: dict = Depends(get_current_user)):
    p = database.get_profile_by_user_id(user['id'])
    if not p: raise HTTPException(status_code=404, detail="Profile not found")
    data = req.dict() if hasattr(req, "dict") else req.model_dump()
    database.add_user_goal(p['id'], data)
    return {"status": "added"}

@app.delete("/profile/goals/{goal_id}")
async def delete_goal(goal_id: int, user: dict = Depends(get_current_user)):
    database.delete_goal(goal_id)
    return {"status": "deleted"}

@app.put("/profile/goals/{goal_id}")
async def update_goal(goal_id: int, req: GoalStatusRequest, user: dict = Depends(get_current_user)):
    database.update_goal_status(goal_id, req.is_done)
    return {"status": "updated"}

@app.post("/profile/activity")
async def log_activity(req: ActivityRequest, user: dict = Depends(get_current_user)):
    database.log_user_activity(user['id'], req.date, req.hours, req.level)
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