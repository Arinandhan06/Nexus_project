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