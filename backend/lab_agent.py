from typing import List
import json
from models import ProjectList 

class LabAgent:
    def __init__(self, openai_client):
        self.client = openai_client
        self.model_id = "llama-3.3-70b-versatile"

    def generate_projects(self, skill_gaps: List[str]):
        prompt = f"""
        Act as a Tech Lead and Mentor. 
        The user has the following technical skill gaps: {skill_gaps}.
        
        Generate exactly 9 professional, portfolio-ready projects that 
        will help the user bridge these specific gaps.
        
        Group them into 3 distinct difficulty levels: "Easy", "Medium", and "Hard/Tough".
        Provide exactly 3 projects for EACH category.

        For each project, provide:
        - A unique 'id' (kebab-case string)
        - 'title': Project Name
        - 'description': Brief description
        - 'tech' list (e.g. ["React", "Python"])
        - 'icon' (Choose from: "globe", "code", "database", "smartphone", "cpu", "lightbulb")
        - 'color' (Tailwind gradient classes, e.g., "from-blue-500 to-cyan-600")
        - 'difficulty': "Easy", "Medium", or "Hard"
        
        Return the result as ONLY a JSON object with this EXACT structure:
        {{
            "easy": [ ... 3 projects ... ],
            "medium": [ ... 3 projects ... ],
            "hard": [ ... 3 projects ... ]
        }}
        """

        try:
            response = self.client.chat.completions.create(
                model=self.model_id,
                messages=[
                    {"role": "system", "content": "You are a helpful coding mentor. Return JSON only."},
                    {"role": "user", "content": prompt}
                ]
            )
            
            content = response.choices[0].message.content
            # Scrub markdown
            raw_data = content.strip().replace("```json", "").replace("```", "")
            data = json.loads(raw_data)
            
            # Normalize to flat list but keep difficulty metadata if needed, 
            # OR return the specific structure. 
            # The user wants them categorized. Let's return the structured dict.
            # But main.py might expect a list. Let's check main.py usage.
            # If main.py just passes "projects" to database.save_career_data, we need to handle that.
            # Let's flatten for DB but keep difficulty, OR update DB/Frontend handle it.
            # Ideally, return the full dict.
            
            all_projects = []
            if "projects" in data: # Fallback for old prompt style
                 return data["projects"]
            
            # If new structure
            for cat in ["easy", "medium", "hard"]:
                if cat in data:
                    all_projects.extend(data[cat])
                    
            return all_projects
            
        except Exception as e:
            print(f"❌ Lab Agent Error: {e}")
            return []