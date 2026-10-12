import os
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()

# Read LLM configurations strictly from environment variables
MODEL = os.getenv("LLM_MODEL", "gpt-4o")

def get_client() -> OpenAI:
    api_key = os.getenv("LLM_API_KEY", "dummy_key")
    base_url = os.getenv("LLM_BASE_URL", "https://api.openai.com/v1")
    return OpenAI(
        api_key=api_key,
        base_url=base_url
    )
