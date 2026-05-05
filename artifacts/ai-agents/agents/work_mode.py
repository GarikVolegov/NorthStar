"""
WorkModeAdvisorAgent — LLM-powered contextual work mode advice for premium users.
Rule-based scoring still determines the recommended mode; this adds deep narrative advice.
"""
from __future__ import annotations
from typing import Any
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import JsonOutputParser
from pydantic import BaseModel, Field
from agents.base import get_llm


class WorkModeAdvice(BaseModel):
    mode_narrative: str = Field(description="Narrazione del perché questa modalità lavorativa è ideale (2 paragrafi)")
    daily_rituals: list[str] = Field(description="3-4 rituali quotidiani concreti per massimizzare le performance")
    environment_tips: list[str] = Field(description="3-4 consigli pratici sull'ambiente di lavoro ideale")
    red_flags: list[str] = Field(description="2-3 situazioni lavorative da evitare assolutamente")
    negotiation_script: str = Field(description="Frase concreta da usare in colloquio per negoziare la modalità lavorativa")


PROMPT = ChatPromptTemplate.from_messages([
    ("system", (
        "Sei un esperto di workplace design e benessere professionale per il mercato italiano. "
        "Il tuo consiglio è sempre pratico, specifico e immediatamente applicabile. "
        "Rispondi SEMPRE con JSON valido secondo lo schema richiesto."
    )),
    ("human", (
        "Profilo lavorativo del candidato:\n"
        "- Modalità raccomandata: {recommended_mode}\n"
        "- Punteggio remoto: {remote_score}/100\n"
        "- Punteggio ibrido: {hybrid_score}/100\n"
        "- Punteggio in presenza: {office_score}/100\n"
        "- Profilo RIASEC primario: {primary_types}\n"
        "- Spirito dominante: {dominant_spirit}\n\n"
        "Genera consigli profondi e pratici per ottimizzare la modalità lavorativa di questa persona.\n"
        "Schema JSON richiesto:\n{format_instructions}"
    )),
])


async def run_work_mode_advice(payload: dict[str, Any], plan: str) -> dict[str, Any]:
    recommended = payload.get("recommended", "hybrid")
    scores = payload.get("scores", {})
    primary_types: list[str] = payload.get("primaryTypes", [])
    dominant_spirit: str = payload.get("dominantSpirit", "non specificato")

    llm = get_llm(smart=(plan == "premium"))
    parser = JsonOutputParser(pydantic_object=WorkModeAdvice)

    chain = PROMPT | llm | parser
    result = await chain.ainvoke({
        "recommended_mode": {"remote": "Remoto", "hybrid": "Ibrido", "office": "In presenza"}.get(recommended, recommended),
        "remote_score": scores.get("remote", 0),
        "hybrid_score": scores.get("hybrid", 0),
        "office_score": scores.get("office", 0),
        "primary_types": ", ".join(primary_types) if primary_types else "non specificati",
        "dominant_spirit": dominant_spirit,
        "format_instructions": parser.get_format_instructions(),
    })
    return result
