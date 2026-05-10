"""
Unit tests for the /run endpoint with mocked LLM responses.
Tests the contract: given a known payload, the response shape must match AgentResult.
"""
from unittest.mock import AsyncMock, patch
from httpx import AsyncClient
import pytest

from main import app

MOCK_RESULT = {
    "result": {
        "insight": "Strong investigative profile with analytical tendencies.",
        "strengths": ["Problem solving", "Research", "Precision"],
        "suggested_sectors": ["Tech", "Science"],
    },
    "error": None,
}


@pytest.mark.anyio
async def test_run_personality_insight_contract():
    """AgentResult shape must always match the Pydantic schema regardless of LLM output."""
    with patch("agents.orchestrator.run_task", new_callable=AsyncMock) as mock_run:
        mock_run.return_value = MOCK_RESULT
        async with AsyncClient(app=app, base_url="http://test") as client:
            r = await client.post("/run", json={
                "task_type": "personality_insight",
                "payload": {"riasec_scores": {"R": 3, "I": 5, "A": 2, "S": 1, "E": 4, "C": 3}},
                "plan": "free",
                "user_id": "42",
            })

    assert r.status_code == 200
    body = r.json()
    # Contract assertions — these are the fields the Express proxy depends on
    assert body["success"] is True
    assert isinstance(body["data"], dict)
    assert body["task_type"] == "personality_insight"
    assert body["error"] is None


@pytest.mark.anyio
async def test_run_returns_error_shape_on_agent_failure():
    """When the agent returns an error key, the response must be success=False, not a 500."""
    with patch("agents.orchestrator.run_task", new_callable=AsyncMock) as mock_run:
        mock_run.return_value = {"error": "LLM timeout", "result": {}}
        async with AsyncClient(app=app, base_url="http://test") as client:
            r = await client.post("/run", json={
                "task_type": "personality_insight",
                "payload": {},
                "plan": "free",
            })

    assert r.status_code == 200
    body = r.json()
    assert body["success"] is False
    assert body["error"] == "LLM timeout"


@pytest.mark.anyio
async def test_run_premium_uses_premium_model():
    """Premium plan must set model_used to the premium model name."""
    with patch("agents.orchestrator.run_task", new_callable=AsyncMock) as mock_run:
        mock_run.return_value = MOCK_RESULT
        async with AsyncClient(app=app, base_url="http://test") as client:
            r = await client.post("/run", json={
                "task_type": "personality_insight",
                "payload": {},
                "plan": "premium",
            })

    body = r.json()
    assert body["model_used"] is not None
    assert "mini" not in body["model_used"]  # premium must not use the mini model
