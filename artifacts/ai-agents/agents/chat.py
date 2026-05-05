"""
CareerChatAgent — Conversational Q&A grounded in the user's career profile.
Maintains conversation history and uses profile context for personalized answers.
"""
from __future__ import annotations
from typing import Any
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage
from langchain_core.output_parsers import StrOutputParser
from agents.base import get_llm

RIASEC_LABELS = {
    "R": "Realistico", "I": "Investigativo", "A": "Artistico",
    "S": "Sociale", "E": "Imprenditoriale", "C": "Convenzionale",
}

SYSTEM_TEMPLATE = """Sei NorthStar, un assistente di orientamento professionale specializzato nel mercato del lavoro italiano.
Hai accesso al profilo completo dell'utente e rispondi in modo personalizzato, caldo e diretto.

PROFILO UTENTE:
{profile_context}

REGOLE:
- Rispondi sempre in italiano
- Basa ogni risposta sul profilo specifico dell'utente (non dare risposte generiche)
- Sii conciso ma completo (max 250 parole per risposta)
- Usa esempi concreti del mercato italiano
- Se non hai informazioni sufficienti, chiedi chiarimenti specifici
- NON inventare dati o statistiche
"""


def _build_profile_context(profile: dict[str, Any]) -> str:
    if not profile:
        return "Profilo non ancora disponibile — rispondi in modo generale sull'orientamento professionale italiano."

    lines = []

    riasec = profile.get("riasecScores", {})
    if riasec:
        top = sorted(riasec.items(), key=lambda x: -x[1])[:3]
        lines.append(f"RIASEC primari: {', '.join([f'{RIASEC_LABELS.get(k,k)}({v:.0f})' for k,v in top])}")

    primary = profile.get("primaryTypes", [])
    if primary:
        lines.append(f"Tipi dominanti: {', '.join(primary)}")

    sectors = profile.get("sectors", [])
    if sectors:
        sector_names = [s.get("sectorName", "") for s in sectors[:3] if s.get("sectorName")]
        if sector_names:
            lines.append(f"Settori consigliati: {', '.join(sector_names)}")

    professions = profile.get("professions", [])
    if professions:
        prof_names = [p.get("title", p.get("name", "")) for p in professions[:3] if p.get("title") or p.get("name")]
        if prof_names:
            lines.append(f"Professioni suggerite: {', '.join(prof_names)}")

    spirit = profile.get("dominantSpirit", "")
    if spirit:
        lines.append(f"Spirito professionale dominante: {spirit}")

    work_mode = profile.get("workMode", "")
    if work_mode:
        mode_labels = {"remote": "Remoto", "hybrid": "Ibrido", "office": "In presenza"}
        lines.append(f"Modalità lavorativa ideale: {mode_labels.get(work_mode, work_mode)}")

    return "\n".join(lines) if lines else "Profilo parziale — dati limitati disponibili."


async def run_career_chat(
    messages: list[dict[str, str]],
    profile: dict[str, Any],
    plan: str,
) -> str:
    profile_context = _build_profile_context(profile)

    lc_messages: list[Any] = []
    for msg in messages[:-1]:
        role = msg.get("role", "user")
        content = msg.get("content", "")
        if role == "user":
            lc_messages.append(HumanMessage(content=content))
        elif role == "assistant":
            lc_messages.append(AIMessage(content=content))

    last_user = next(
        (m["content"] for m in reversed(messages) if m.get("role") == "user"),
        ""
    )

    prompt = ChatPromptTemplate.from_messages([
        SystemMessage(content=SYSTEM_TEMPLATE.format(profile_context=profile_context)),
        MessagesPlaceholder(variable_name="history"),
        ("human", "{question}"),
    ])

    llm = get_llm(smart=(plan == "premium"))
    chain = prompt | llm | StrOutputParser()

    reply = await chain.ainvoke({
        "history": lc_messages,
        "question": last_user,
    })
    return reply
