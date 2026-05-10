import os

AI_BASE_URL = os.getenv("AI_INTEGRATIONS_OPENAI_BASE_URL", "")
AI_API_KEY = os.getenv("AI_INTEGRATIONS_OPENAI_API_KEY", "dummy")

FAST_MODEL = "gpt-4.1-mini"
SMART_MODEL = "gpt-5.4"

PORT = int(os.getenv("AI_AGENTS_PORT", "8000"))
