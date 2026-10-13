import os
import json
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()

# Read LLM configurations strictly from environment variables
MODEL = os.getenv("LLM_MODEL", "gpt-4o")

def is_mock_externals() -> bool:
    return os.getenv("MOCK_EXTERNALS", "").lower() in ("true", "1", "yes")

class MockMessage:
    def __init__(self, content: str):
        self.content = content

class MockChoice:
    def __init__(self, content: str):
        self.message = MockMessage(content)

class MockCompletion:
    def __init__(self, content: str):
        self.choices = [MockChoice(content)]

class MockCompletions:
    def create(self, model=None, messages=None, **kwargs):
        prompt_text = ""
        for m in (messages or []):
            content = m.get("content", "")
            if isinstance(content, list):
                content = str(content)
            prompt_text += f"{m.get('role', '')}: {content}\n"
        
        prompt_lower = prompt_text.lower()
        
        # 1. Resume Intelligence Analysis (JSON)
        if "analyze" in prompt_lower and ("skill_tree" in prompt_lower or "weaknesses" in prompt_lower or "matrix" in prompt_lower or "candidate profile" in prompt_lower):
            canned_data = {
                "target_role": "Software Engineer",
                "matrix": {"dsa": 60, "system_design": 55, "cleanliness": 60},
                "skill_tree": [
                    {"category": "Algorithms", "skills": [{"name": "Two Pointers", "level": "proficient"}, {"name": "Binary Search", "level": "familiar"}]},
                    {"category": "Systems", "skills": [{"name": "REST APIs", "level": "proficient"}, {"name": "Database Design", "level": "familiar"}]}
                ],
                "weaknesses": [
                    {"name": "Dynamic Programming", "reason": "Requires algorithmic reinforcement."},
                    {"name": "Distributed Caching", "reason": "Limited high-concurrency systems exposure."}
                ]
            }
            return MockCompletion(json.dumps(canned_data))

        # 2. Finale System Design Evaluation (JSON)
        if "rubric" in prompt_lower or "system design" in prompt_lower or "criteria" in prompt_lower:
            canned_eval = {
                "criteria": [
                    {"name": "Requirements Clarification", "score": 18, "comment": "Clear scope definition and constraints."},
                    {"name": "Data Modeling & Architecture", "score": 18, "comment": "Sensible schema and clear service boundaries."},
                    {"name": "Scalability & Bottlenecks", "score": 17, "comment": "Good caching strategy and horizontal scaling."},
                    {"name": "Trade-offs & Alternatives", "score": 17, "comment": "Balanced analysis of latency vs consistency."},
                    {"name": "Failure Modes & Monitoring", "score": 18, "comment": "Solid circuit breakers and health monitoring."}
                ],
                "feedback": "Outstanding architectural architecture and clear consideration of trade-offs."
            }
            return MockCompletion(json.dumps(canned_eval))

        # 3. Schedule generation
        if "schedule" in prompt_lower and "30" in prompt_lower:
            canned_schedule = [
                {"day": i, "topic": f"Sector Trial {i}", "taunt": f"Prepare for trial {i}."}
                for i in range(1, 31)
            ]
            return MockCompletion(json.dumps({"schedule": canned_schedule}))

        # 4. ARIA Mentor Chat
        if "aria" in prompt_lower or "mentor" in prompt_lower or "hint" in prompt_lower:
            return MockCompletion("Focus on loop invariants and pointer boundaries. The optimal approach runs in linear time with minimal auxiliary memory.")

        # 5. NEXUS Taunt
        if "taunt" in prompt_lower or "nexus" in prompt_lower:
            return MockCompletion("Your code stumbles through the memory banks. Try harder, cadet.")

        # 6. Default fallback
        return MockCompletion("Analysis complete. Protocol parameters verified.")

class MockChat:
    def __init__(self):
        self.completions = MockCompletions()

class MockOpenAIClient:
    def __init__(self):
        self.chat = MockChat()

def get_client() -> OpenAI:
    if is_mock_externals():
        return MockOpenAIClient()
    api_key = os.getenv("LLM_API_KEY", "dummy_key")
    base_url = os.getenv("LLM_BASE_URL", "https://api.openai.com/v1")
    return OpenAI(
        api_key=api_key,
        base_url=base_url
    )
