"""
LangGraph orchestrator — routes AI tasks to the appropriate LangChain agent.
Uses StateGraph for conditional routing and parallel execution where possible.
"""
from __future__ import annotations
from typing import Any, Literal
from typing_extensions import TypedDict
from langgraph.graph import StateGraph, END
from agents.personality import run_personality_insight
from agents.sector import run_sector_motivation
from agents.work_mode import run_work_mode_advice
from agents.affiliation import run_affiliation_materials
from agents.business_validator import run_business_validator
from agents.incubator_finder import run_incubator_finder
from agents.linkedin_extractor import run_linkedin_extractor


class AgentState(TypedDict):
    task_type: str
    payload: dict[str, Any]
    plan: str
    result: dict[str, Any]
    error: str | None


TASK_HANDLERS = {
    "personality_insight": run_personality_insight,
    "sector_motivation": run_sector_motivation,
    "work_mode_advice": run_work_mode_advice,
    "affiliation_materials": run_affiliation_materials,
    "business_validator": run_business_validator,
    "incubator_finder": run_incubator_finder,
    "linkedin_extractor": run_linkedin_extractor,
}


async def _route(state: AgentState) -> Literal["run_agent", "unknown_task"]:
    if state["task_type"] in TASK_HANDLERS:
        return "run_agent"
    return "unknown_task"


async def _run_agent(state: AgentState) -> AgentState:
    handler = TASK_HANDLERS[state["task_type"]]
    try:
        result = await handler(state["payload"], state["plan"])
        return {**state, "result": result, "error": None}
    except Exception as exc:
        return {**state, "result": {}, "error": str(exc)}


async def _unknown_task(state: AgentState) -> AgentState:
    return {
        **state,
        "result": {},
        "error": f"Unknown task type: {state['task_type']}. "
                 f"Supported: {', '.join(TASK_HANDLERS.keys())}",
    }


def build_graph() -> Any:
    graph = StateGraph(AgentState)
    graph.add_node("run_agent", _run_agent)
    graph.add_node("unknown_task", _unknown_task)

    graph.set_conditional_entry_point(
        _route,
        {"run_agent": "run_agent", "unknown_task": "unknown_task"},
    )
    graph.add_edge("run_agent", END)
    graph.add_edge("unknown_task", END)

    return graph.compile()


_GRAPH = None


def get_graph() -> Any:
    global _GRAPH
    if _GRAPH is None:
        _GRAPH = build_graph()
    return _GRAPH


async def run_task(task_type: str, payload: dict[str, Any], plan: str) -> dict[str, Any]:
    graph = get_graph()
    state: AgentState = {
        "task_type": task_type,
        "payload": payload,
        "plan": plan,
        "result": {},
        "error": None,
    }
    final = await graph.ainvoke(state)
    return {
        "result": final["result"],
        "error": final["error"],
    }
