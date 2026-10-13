from pydantic import BaseModel, Field
from typing import List

class Milestone(BaseModel):
    task: str
    status: str = "todo"

class Project(BaseModel):
    id: str
    title: str
    description: str
    milestones: List[Milestone]
    difficulty: str
    tech: List[str]
    icon: str # e.g. "globe", "code", "database"
    color: str # e.g. "from-blue-500 to-cyan-600"

class ProjectList(BaseModel):
    projects: List[Project]

class HotItem(BaseModel):
    items: List[str]

class MarketSignal(BaseModel):
    title: str
    company: str
    top_requirements: List[str]
    match_score: int
    gap_summary: str
    link: str

class MarketReport(BaseModel):
    job_title: str
    market_summary: str
    overall_market_match: int
    top_signals: List[MarketSignal]
    trending_skills: List[str]

# --- Chamber Models (Phase 5) ---
from typing import Optional, Any

class ChamberSummary(BaseModel):
    chamber_no: int
    theme: str
    story_title: str
    description: str
    state: str
    attempts: int
    challenge_id: Optional[str] = None

class ChallengePublic(BaseModel):
    id: str
    chamber_no: int
    title: str
    story: str
    statement: str
    constraints: List[str]
    starter_code: str
    time_limit_seconds: int
    public_examples: List[Any]

class EnterChamberResponse(BaseModel):
    chamber_no: int
    state: str
    challenge_id: str
    deadline_at: str
    seconds_remaining: int
    attempts: int
    challenge: ChallengePublic

class CurrentChamberResponse(BaseModel):
    chamber_no: int
    state: str
    attempts: int
    deadline_at: Optional[str] = None
    seconds_remaining: int
    challenge: Optional[ChallengePublic] = None

class ChamberSubmitRequest(BaseModel):
    code: str
    language: str = "python"

class ChamberSubmitResponse(BaseModel):
    status: str
    state: str
    chamber_no: int

class TicketResponse(BaseModel):
    ticket: str
    expires_in: int