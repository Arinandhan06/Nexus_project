import os
import json
from llm import get_client, MODEL

class MirrorAgent:
    def __init__(self):
        self.client = get_client()
        self.model_id = MODEL

    def analyze_resume(self, text, target_role):
        # If content starts with Vision Tag, handle differently? 
        # Actually logic is handled by caller.
        prompt = f"""
        Analyze this resume for a {target_role} role. 
        Return a JSON object with: 
        1. 'personal_details': {{ "name": "...", "email": "...", "phone": "..." }}
        2. 'education': [ {{ "degree": "...", "university": "...", "year": "..." }} ]
        3. 'experience': [ {{ "role": "...", "company": "...", "duration": "...", "description": "..." }} ]
        4. 'current_skills' (list)
        5. 'skill_gaps' (list)
        6. 'growth_stage' (string: Seed, Sprout, or Sapling)
        
        Resume: {text}
        
        Return ONLY valid JSON.
        """
        
        try:
            response = self.client.chat.completions.create(
                model=self.model_id,
                messages=[
                    {"role": "system", "content": "You are an expert career coach and resume analyzer. Return JSON only."},
                    {"role": "user", "content": prompt}
                ]
            )
            
            # Scrubbing and parsing
            content = response.choices[0].message.content
            raw_data = content.strip().replace("```json", "").replace("```", "")
            return json.loads(raw_data)
        except Exception as e:
            print(f"Error analyzing resume: {e}")
            # Fallback Profile
            return {
                "personal_details": {"name": "Cadet X", "email": "cadet@nexus.ai"},
                "education": [],
                "experience": [],
                "current_skills": ["Python", "JavaScript", "Problem Solving"],
                "skill_gaps": ["Cloud Architecture", "System Design"],
                "growth_stage": "Sprout"
            }

    def analyze_image_resume(self, base64_image, target_role):
        """Uses Vision to analyze an image-based resume"""
        print("Using Vision Model for Resume Analysis...")
        prompt = f"""
        Analyze this RESUME IMAGE for a {target_role} role. 
        Extract details and Return a JSON object with: 
        1. 'personal_details': {{ "name": "...", "email": "...", "phone": "..." }}
        2. 'education': [ {{ "degree": "...", "university": "...", "year": "..." }} ]
        3. 'experience': [ {{ "role": "...", "company": "...", "duration": "...", "description": "..." }} ]
        4. 'current_skills' (list)
        5. 'skill_gaps' (list)
        6. 'growth_stage' (string: Seed, Sprout, or Sapling)
        
        Return ONLY valid JSON.
        """
        
        try:
            response = self.client.chat.completions.create(
                model=self.model_id,
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": prompt},
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": f"data:image/jpeg;base64,{base64_image}"
                                }
                            }
                        ]
                    }
                ],
                response_format={"type": "json_object"}
            )
            
            content = response.choices[0].message.content
            # Vision models can be chatty, ensure JSON
            return json.loads(content)
        except Exception as e:
            print(f"Vision Analysis Error: {e}")
            return self.analyze_resume("FALLBACK TEXT", target_role) # Fallback to text mock
    
    def generate_project_phases(self, project_title, tech_stack):
        prompt = f"""
        Project: "{project_title}" using {tech_stack}.
        Break this project down into exactly 6 distinct, progressive phases.
        For each phase, provide:
        1. "id": phase index (1-6)
        2. "title": A clear, professional phase name (e.g. "Backend Setup", "Core Features").
        3. "description": A brief 1-sentence overview.
        4. "tasks": A list of 3-5 specific, actionable bullet points (strings) to complete this phase.
        5. "resources": A list of 2-3 objects {{ "label": "Specific Doc Name", "url": "Valid URL" }}.
            - URLs must be REAL and SPECIFIC to the tech stack (e.g. "https://react.dev", "https://fastapi.tiangolo.com").
            - Do NOT use generic "Official Docs". Use specific names like "Tailwind Flexbox Guide".
        
        Return a JSON list of objects.
        """
        
        try:
            response = self.client.chat.completions.create(
                model=self.model_id,
                messages=[
                    {"role": "system", "content": "You are a technical project manager. Return JSON only."},
                    {"role": "user", "content": prompt}
                ]
            )
            # Scrubbing and parsing
            content = response.choices[0].message.content
            text = content.strip().replace("```json", "").replace("```", "")
            return json.loads(text)
        except Exception as e:
            print(f"Error generating phases: {e}")
            # Fallback
            return [
                {"id": 1, "title": "Setup & Init", "description": "Initialize project structure", "tasks": ["Install dependencies", "Setup Git", "Hello World"]},
                {"id": 2, "title": "Core Logic", "description": "Implement main features", "tasks": ["Build API", "Create Components", "Connect DB"]},
                {"id": 3, "title": "UI/UX Polish", "description": "Style the application", "tasks": ["Add animations", "Responsive design", "Theme setup"]},
                {"id": 4, "title": "Integration", "description": "Connect fontend and backend", "tasks": ["Fetch API", "State Management", "Error Handling"]},
                {"id": 5, "title": "Testing", "description": "Ensure quality", "tasks": ["Unit Tests", "Integration Tests", "Bug Fixes"]},
                {"id": 6, "title": "Deployment", "description": "Ship to production", "tasks": ["Build optimization", "Deploy to Vercel/Render", "Documentation"]}
            ]