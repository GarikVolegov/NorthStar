"""
Integration tests for the AI microservice health and contract endpoints.
These tests mock the LLM so no real API keys are needed in CI.
"""
from httpx import AsyncClient
import pytest
import pytest_asyncio

from main import app


@pytest.fixture(scope="module")
def anyio_backend():
    return "asyncio"


@pytest.mark.anyio
async def test_health_returns_ok():
    async with AsyncClient(app=app, base_url="http://test") as client:
        r = await client.get("/health")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ok"
    assert "supported_tasks" in body


@pytest.mark.anyio
async def test_run_rejects_unknown_task():
    async with AsyncClient(app=app, base_url="http://test") as client:
        r = await client.post("/run", json={
            "task_type": "non_existing_task",
            "payload": {},
            "plan": "free",
        })
    assert r.status_code == 400
    assert "not supported" in r.json()["detail"]


@pytest.mark.anyio
async def test_chat_rejects_empty_messages():
    async with AsyncClient(app=app, base_url="http://test") as client:
        r = await client.post("/chat", json={
            "messages": [],
            "profile": {},
            "plan": "free",
        })
    assert r.status_code == 400
