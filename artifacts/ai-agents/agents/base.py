from langchain_openai import ChatOpenAI
from config import AI_BASE_URL, AI_API_KEY, FAST_MODEL, SMART_MODEL


def get_llm(smart: bool = False) -> ChatOpenAI:
    model = SMART_MODEL if smart else FAST_MODEL
    kwargs: dict = dict(
        model=model,
        openai_api_key=AI_API_KEY,
    )
    if AI_BASE_URL:
        kwargs["openai_api_base"] = AI_BASE_URL
    return ChatOpenAI(**kwargs)
