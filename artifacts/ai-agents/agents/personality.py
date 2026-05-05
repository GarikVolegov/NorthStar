"""
PersonalityInsightAgent — Generates a rich Italian narrative from RIASEC + Cinque Spiriti scores.
Rule-based agents compute the raw scores; this agent adds the LLM layer for deep insight.
"""
from __future__ import annotations
from typing import Any
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import JsonOutputParser
from pydantic import BaseModel, Field
from agents.base import get_llm

RIASEC_LABELS = {
    "R": "Realistico", "I": "Investigativo", "A": "Artistico",
    "S": "Sociale", "E": "Imprenditoriale", "C": "Convenzionale",
}

SPIRIT_LABELS = {
    "guerriero": "Guerriero", "saggio": "Saggio", "custode": "Custode",
    "creativo": "Creativo", "connettore": "Connettore",
}


class PersonalityInsight(BaseModel):
    narrative: str = Field(description="Narrativa profonda 3 paragrafi in italiano (200-300 parole)")
    headline: str = Field(description="Titolo accattivante del profilo (max 12 parole)")
    unique_value: str = Field(description="Proposta di valore unica della persona (1 frase)")
    shadow_side: str = Field(description="L'ombra del profilo — sfida autentica da affrontare (1-2 frasi)")
    growth_path: str = Field(description="Il percorso di crescita consigliato (1-2 frasi)")


PROMPT = ChatPromptTemplate.from_messages([
    ("system", (
        "Sei un esperto psicologo vocazionale e coach di carriera per il mercato italiano. "
        "Il tuo stile è caldo, diretto, scientificamente fondato. "
        "NON usare frasi generiche — ogni insight deve riflettere esattamente i punteggi forniti. "
        "Rispondi SEMPRE con JSON valido secondo lo schema richiesto."
    )),
    ("human", (
        "Profilo RIASEC del candidato:\n{riasec_summary}\n\n"
        "Spirito dominante: {dominant_spirit}\n"
        "Spirito secondario: {secondary_spirit}\n\n"
        "Tipi primari: {primary_types}\n"
        "Piano abbonamento: {plan}\n\n"
        "Genera un'analisi della personalità professionale profonda e personalizzata.\n"
        "Schema JSON richiesto:\n{format_instructions}"
    )),
])


def _build_riasec_summary(scores: dict[str, float], primary_types: list[str]) -> str:
    lines = []
    for code, label in RIASEC_LABELS.items():
        score = scores.get(code, 0)
        primary = "★ PRIMARIO" if code in primary_types else ""
        lines.append(f"  {label} ({code}): {score:.0f}/100 {primary}".strip())
    return "\n".join(lines)


async def run_personality_insight(payload: dict[str, Any], plan: str) -> dict[str, Any]:
    riasec_scores: dict[str, float] = payload.get("riasecScores", {})
    spirit_scores: dict[str, float] = payload.get("spiritScores", {})
    primary_types: list[str] = payload.get("primaryTypes", [])

    dominant_spirit = max(spirit_scores, key=spirit_scores.get) if spirit_scores else "non specificato"
    secondary_spirit = sorted(spirit_scores, key=spirit_scores.get, reverse=True)[1] if len(spirit_scores) > 1 else "non specificato"

    riasec_summary = _build_riasec_summary(riasec_scores, primary_types)
    primary_labels = [f"{RIASEC_LABELS.get(t, t)} ({t})" for t in primary_types]

    llm = get_llm(smart=(plan == "premium"))
    parser = JsonOutputParser(pydantic_object=PersonalityInsight)

    chain = PROMPT | llm | parser
    result = await chain.ainvoke({
        "riasec_summary": riasec_summary,
        "dominant_spirit": SPIRIT_LABELS.get(dominant_spirit, dominant_spirit),
        "secondary_spirit": SPIRIT_LABELS.get(secondary_spirit, secondary_spirit),
        "primary_types": ", ".join(primary_labels) if primary_labels else "non determinati",
        "plan": "Premium (analisi completa)" if plan == "premium" else "Base",
        "format_instructions": parser.get_format_instructions(),
    })
    return result
