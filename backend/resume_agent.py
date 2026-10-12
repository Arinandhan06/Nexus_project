from openai import OpenAI
import json
import os

class ResumeAgent:
    def __init__(self, client=None):
        self.client = client
        
    def generate_resume_content(self, current_profile, completed_projects, target_job_description):
        """
        Generates tailored resume sections (Summary, Experience, Projects) 
        based on the user's Sentinel history and the target job.
        """
        
        # Format projects for the AI
        project_context = ""
        for p in completed_projects:
            project_context += f"- Project: {p.get('title')}\n  Skills: {p.get('tech_stack')}\n  Description: {p.get('description')}\n"

        system_prompt = f"""
        You are an elite Resume Strategist.
        Your goal is to build a perfect resume for the user targeting this job:
        "{target_job_description}"
        
        USER CONTEXT:
        - Name: {current_profile.get('analysis', {}).get('personal_details', {}).get('name', 'Candidate')}
        - Current Role: {current_profile.get('role', 'Student')}
        - Contact: {current_profile.get('analysis', {}).get('personal_details', {}).get('email', '')}
        - Skills: {current_profile.get('analysis', {}).get('current_skills', [])}
        
        HISTORY (From Resume):
        - Education: {current_profile.get('analysis', {}).get('education', [])}
        - Experience: {current_profile.get('analysis', {}).get('experience', [])}
        
        ACHIEVEMENTS (From Sentinel Lab):
        {project_context}
        
        TASK:
        1. Write a Professional Summary tailored to the target job.
        2. Create a "Projects" section using the STAR method based on the "ACHIEVEMENTS".
        3. Suggest a "Skills" section aligning user skills with Job Requirements.
        4. Include the user's Education and Experience as provided.
        
        Output JSON format:
        {{
            "personal_details": {{ "name": "...", "email": "...", "phone": "..." }},
            "summary": "...",
            "experience_section": [ {{ "role": "...", "company": "...", "duration": "...", "description": "..." }} ],
            "education_section": [ {{ "degree": "...", "university": "...", "year": "..." }} ],
            "projects_section": [
                {{ "title": "...", "bullets": ["...", "..."] }}
            ],
            "skills_section": ["...", "..."],
            "improvement_tips": "..."
        }}
        """
        
        try:
            response = self.client.chat.completions.create(
                 model="llama-3.3-70b-versatile",
                 messages=[
                     {"role": "system", "content": "You are a JSON-only resume generator."},
                     {"role": "user", "content": system_prompt}
                 ],
                 response_format={"type": "json_object"}
            )
            return json.loads(response.choices[0].message.content)
        except Exception as e:
            print(f"Resume Gen Error: {e}")
            return {"error": str(e)}
