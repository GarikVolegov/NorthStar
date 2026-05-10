"""
NorthStar AI Agents + ML — FastAPI microservice

Espone due famiglie di endpoint:
  - /run + /chat   : LangChain/LangGraph AI agents (orchestrator, career chat)
  - /ml/*          : Modulo ML scikit-learn (career recommender, sector similarity)

L'Express API server proxia i task AI-intensivi e le raccomandazioni ML a questo servizio.
"""
from __future__ import annotations
import logging
import os
import sys
import time
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(__file__))

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from schemas import RunRequest, ChatRequest, AgentResult, ChatResult
from agents.orchestrator import run_task
from agents.chat import run_career_chat
from ml.router import ml_router
from config import PORT

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

_start_time = time.time()

app = FastAPI(
    title="NorthStar AI Agents + ML",
    description="LangChain/LangGraph AI microservice + scikit-learn ML per career orientation",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── ML Router ───────────────────────────────────────────────────────────────────
app.include_router(ml_router, prefix="/ml", tags=["ML — Career Recommender"])


SUPPORTED_TASKS = [
    "personality_insight",
    "sector_motivation",
    "work_mode_advice",
    "affiliation_materials",
    "business_validator",
    "incubator_finder",
    "linkedin_extractor",
]


@app.get("/health")
async def health() -> dict:
    return {
        "status": "ok",
        "service": "northstar-ai-agents",
        "version": "2.0.0",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "uptime_seconds": round(time.time() - _start_time),
        "supported_tasks": SUPPORTED_TASKS,
        "ml_module": "mounted at /ml",
        "agents": [
            "PersonalityInsightAgent", "SectorMotivationAgent",
            "WorkModeAdvisorAgent", "AffiliationMaterialsAgent", "CareerChatAgent",
            "BusinessValidatorAgent", "IncubatorFinderAgent",
        ],
    }


@app.post("/run", response_model=AgentResult)
async def run_agent(req: RunRequest) -> AgentResult:
    logger.info(f"run task={req.task_type} plan={req.plan} user={req.user_id}")

    if req.task_type not in SUPPORTED_TASKS:
        raise HTTPException(
            status_code=400,
            detail=f"Task '{req.task_type}' not supported. Use: {', '.join(SUPPORTED_TASKS)}",
        )

    try:
        output = await run_task(req.task_type, req.payload, req.plan)
        if output.get("error"):
            logger.warning(f"Agent error for {req.task_type}: {output['error']}")
            return AgentResult(
                task_type=req.task_type,
                success=False,
                data={},
                error=output["error"],
            )
        return AgentResult(
            task_type=req.task_type,
            success=True,
            data=output["result"],
            model_used="gpt-5.4" if req.plan == "premium" else "gpt-4.1-mini",
        )
    except Exception as exc:
        logger.error(f"Unhandled error in /run: {exc}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(exc))


@app.post("/chat", response_model=ChatResult)
async def chat(req: ChatRequest) -> ChatResult:
    logger.info(f"chat messages={len(req.messages)} plan={req.plan} user={req.user_id}")

    if not req.messages:
        raise HTTPException(status_code=400, detail="messages array cannot be empty")

    try:
        messages_dicts = [{"role": m.role, "content": m.content} for m in req.messages]
        reply = await run_career_chat(messages_dicts, req.profile, req.plan)
        return ChatResult(reply=reply, success=True)
    except Exception as exc:
        logger.error(f"Unhandled error in /chat: {exc}", exc_info=True)
        return ChatResult(reply="", success=False, error=str(exc))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=PORT, reload=True)
