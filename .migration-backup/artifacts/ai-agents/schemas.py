from typing import Any
from pydantic import BaseModel, Field


class RunRequest(BaseModel):
    task_type: str
    payload: dict[str, Any]
    plan: str = "free"
    user_id: str | None = None


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    messages: list[ChatMessage]
    profile: dict[str, Any] = Field(default_factory=dict)
    plan: str = "free"
    user_id: str | None = None


class AgentResult(BaseModel):
    task_type: str
    success: bool
    data: dict[str, Any]
    error: str | None = None
    model_used: str | None = None


class ChatResult(BaseModel):
    reply: str
    success: bool
    error: str | None = None
