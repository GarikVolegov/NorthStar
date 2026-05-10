"""
SectorMotivationAgent — Generates personalized Italian motivations for each matched sector.
The TypeScript SectorAgent computes match scores; this layer adds LLM-powered storytelling.
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


class SectorMotivationItem(BaseModel):
    sector_id: int
    motivation: str = Field(description="Motivazione personalizzata (2-3 frasi vivide in italiano)")
    why_fits: str = Field(description="Spiegazione scientifica del match (1 frase)")
    career_vision: str = Field(description="Visione di carriera nel settore (1 frase)")


class SectorMotivationOutput(BaseModel):
    sectors: list[SectorMotivationItem]


PROMPT = ChatPromptTemplate.from_messages([
    ("system", (
        "Sei un career coach esperto nel mercato del lavoro italiano. "
        "Devi generare motivazioni personalizzate per ogni settore professionale, "
        "basandoti esattamente sul profilo RIASEC della persona. "
        "Usa un tono coinvolgente e diretto. NON essere generico. "
        "Rispondi con JSON valido secondo lo schema richiesto."
    )),
    ("human", (
        "Profilo RIASEC: {riasec_profile}\n"
        "Tipi primari: {primary_types}\n\n"
        "Settori da analizzare:\n{sectors_list}\n\n"
        "Per ciascun settore genera una motivazione personalizzata che collega "
        "il profilo RIASEC del candidato alle opportunità specifiche del settore.\n"
        "Schema JSON richiesto:\n{format_instructions}"
    )),
])


def _build_riasec_profile(scores: dict[str, float]) -> str:
    parts = [f"{RIASEC_LABELS.get(k, k)}={v:.0f}" for k, v in sorted(scores.items(), key=lambda x: -x[1])]
    return ", ".join(parts)


def _build_sectors_list(sectors: list[dict[str, Any]]) -> str:
    lines = []
    for s in sectors:
        lines.append(
            f"- ID {s.get('sectorId', 0)}: {s.get('sectorName', '?')} "
            f"(match: {s.get('matchScore', 0):.0f}%, trend: {s.get('trend', '?')})"
        )
    return "\n".join(lines)


async def run_sector_motivation(payload: dict[str, Any], plan: str) -> dict[str, Any]:
    riasec_scores: dict[str, float] = payload.get("riasecScores", {})
    primary_types: list[str] = payload.get("primaryTypes", [])
    sectors: list[dict[str, Any]] = payload.get("sectors", [])

    if not sectors:
        return {"sectors": []}

    limit = 5 if plan == "premium" else 3
    sectors = sectors[:limit]

    llm = get_llm(smart=False)
    parser = JsonOutputParser(pydantic_object=SectorMotivationOutput)

    chain = PROMPT | llm | parser
    result = await chain.ainvoke({
        "riasec_profile": _build_riasec_profile(riasec_scores),
        "primary_types": ", ".join([RIASEC_LABELS.get(t, t) for t in primary_types]),
        "sectors_list": _build_sectors_list(sectors),
        "format_instructions": parser.get_format_instructions(),
    })
    return result
