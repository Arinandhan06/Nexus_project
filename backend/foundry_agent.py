from openai import OpenAI
import json

class FoundryAgent:
    def __init__(self, openai_client):
        self.client = openai_client
        self.model_id = "llama-3.3-70b-versatile" # Using the fast Groq model

    def chat_architect(self, user_message, current_code, project_context, language="english"):
        """
        The Architect: A helpful Senior Mentor.
        """
        base_prompt = f"""
        You are "The Architect", a helpful and encouraging Senior Tech Lead. 
        The student is working on:
        Project: {project_context.get('title')}
        Phase: {project_context.get('phase_title')}
        Objective: {project_context.get('phase_description')}
        
        Current Code:
        ```
        {current_code}
        ```

        GUIDELINES:
        1. Be a helpful mentor. If they are stuck, PROVIDE THE CODE SOLUTION.
        2. Explain *why* the code works, but don't be afraid to give snippets or full functions to help them move forward.
        3. Use clear, neat formatting.
        4. Keep responses concise (max 2-3 paragraphs) but informative.
        5. Your goal is to help them learn by DOING, even if that means showing them the path.
        """

        if language == "tamil":
            base_prompt += """
            CRITICAL INSTRUCTION - PERSONA CHANGE:
            You are a friendly mentor from Tamil Nadu instructing a rural student.
            1. SPEAK IN TAMIL SCRIPT (தமிழ்) mixed with English technical terms.
            2. DO NOT use Tanglish (Romanized Tamil). Use the Tamil alphabet.
            3. DO NOT translate technical keywords (keep 'function', 'variable', 'loop', 'API', 'print' in English).
            
            Example Tone:
            "வணக்கம் தம்பி! இந்த code-ல ஒரு சின்ன mistake இருக்கு. 'function' define பண்ணும்போது 'def' use பண்ணனும்."
            
            Be helpful, encouraging, and clear.
            """

        try:
            response = self.client.chat.completions.create(
                model=self.model_id,
                messages=[
                    {"role": "system", "content": base_prompt},
                    {"role": "user", "content": user_message}
                ]
            )
            return response.choices[0].message.content
        except Exception as e:
            return f"The Architect is offline temporarily. ({str(e)})"

    def validate_code(self, user_code, phase_objective):
        """
        The Interpreter: Simulates code execution and provides feedback.
        Returns JSON: { 'output': '...', 'review': '...' }
        """
        system_prompt = f"""
        Act as a Python Interpreter ("The Interpreter").
        Phase Objective: {phase_objective}
        
        CODE TO ANALYZE:
        ```python
        {user_code}
        ```
        
        MISSION:
        1. SIMULATE the execution of this code. What would the terminal output be?
        2. If there are syntax errors, output the error message.
        3. Provide a very short (1 sentence) technical review.
        
        CRITICAL: Return ONLY a JSON object:
        {{
            "output": "The exact terminal output (or error)...",
            "review": "Short critique..."
        }}
        """

        try:
            response = self.client.chat.completions.create(
                model=self.model_id,
                messages=[
                    {"role": "system", "content": "You are a code simulator. Return JSON only."},
                    {"role": "user", "content": system_prompt}
                ],
                response_format={"type": "json_object"} 
            )
            content = response.choices[0].message.content
            return json.loads(content)
        except Exception as e:
            print(f"Interpreter Error: {e}")
            return {
                "output": "Execution Error: Simulation failed.",
                "review": "Could not verify code at this time."
            }

    def verify_screenshot(self, image_url, phase_objective):
        """
        The Auditor: Verifies visual proof of work using Vision model.
        Returns JSON: { 'approved': bool, 'feedback': 'string' }
        """
        try:
            print("Auditing Screenshot with Vision Model...")
            response = self.client.chat.completions.create(
                # Use Llama 4 Maverick (Multimodal)
                model="meta-llama/llama-4-maverick-17b-128e-instruct", 
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": f"""
                            You are a STRICT Technical Auditor.
                            Your job is to verify if this screenshot proves the user completed the objective: '{phase_objective}'.

                            STRICT RULES:
                            1. The image MUST contain CODE, TERMINAL OUTPUT, or a UI that matches the objective.
                            2. If the image is unrelated (e.g. a selfie, desktop wallpaper, random meme, or blank screen), REJECT it immediately.
                            3. If the image is a screenshot of the 'Sentinel' or 'The Architect' chat interface itself (re-uploading the instructions), REJECT it. The proof must be from an EXTERNAL platform (VS Code, Terminal, Browser, etc.).
                            4. If the image is blurry or unreadable, REJECT it.
                            5. If the proof is weak or ambiguous, REJECT it.
                            
                            Return JSON:
                            {{
                                "approved": true/false,
                                "feedback": "Short, strict reason for approval or rejection."
                            }}
                            """},
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": image_url,
                                },
                            },
                        ],
                    }
                ],
                response_format={"type": "json_object"}
            )
            return json.loads(response.choices[0].message.content)
        except Exception as e:
            print(f"Auditor Verification Failed: {e}")
            # STRICT Fallback: Deny if we can't verify
            return {"approved": False, "feedback": "Verification Check Failed. Please upload a clear screenshot of your code or output."}
