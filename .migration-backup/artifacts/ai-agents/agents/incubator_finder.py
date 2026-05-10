"""
IncubatorFinderAgent — trova incubatori, acceleratori, grant e programmi di funding
adatti all'idea di business validata. Produce anche un application pack sintetico.
"""
from __future__ import annotations
from typing import Any
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import JsonOutputParser
from pydantic import BaseModel, Field
from agents.base import get_llm


class FundingOpportunity(BaseModel):
    name: str = Field(description="Nome del programma/fondo/incubatore")
    type: str = Field(description="Tipo: Incubatore / Acceleratore / Grant / Fondo VC / Programma pubblico")
    description: str = Field(description="Descrizione breve e requisiti principali")
    fit_reason: str = Field(description="Perché è adatto a questa specifica idea")
    application_url: str = Field(description="URL o dove trovare info (usa link reali se li conosci)")
    deadline_note: str = Field(description="Note sulle scadenze tipiche o cicli di selezione")


class IncubatorReport(BaseModel):
    opportunities: list[FundingOpportunity] = Field(description="5-7 opportunità di funding/incubazione più rilevanti")
    pitch_summary: str = Field(description="Pitch di 5 righe investor-ready basato sull'idea validata")
    business_canvas_summary: str = Field(description="Business Model Canvas in formato testo sintetico (9 blocchi)")
    use_of_funds: str = Field(description="Come usare i primi 50k EUR in modo convincente per investitori")
    next_steps: list[str] = Field(description="5 passi concreti e ordinati per candidarsi alle opportunità trovate")
    italian_ecosystem_note: str = Field(description="Note sull'ecosistema startup italiano rilevanti per questa idea")


PROMPT = ChatPromptTemplate.from_messages([
    ("system", (
        "Sei un esperto dell'ecosistema startup italiano ed europeo: conosci CDP Venture Capital, "
        "Invitalia Smart&Start, Horizon Europe, incubatori universitari, acceleratori verticali, "
        "fondi MISE, Startup Geeks, H-Farm, Plug and Play Italy, e centinaia di altri programmi. "
        "Il tuo compito è trovare opportunità reali e actionable per una startup italiana. "
        "Sii specifico: usa nomi reali di programmi, non generici. "
        "Rispondi SEMPRE con JSON valido secondo lo schema richiesto."
    )),
    ("human", (
        "Idea di business da supportare:\n\n"
        "TITOLO: {title}\n"
        "DESCRIZIONE: {idea_text}\n"
        "SETTORE: {sector}\n"
        "PUNTEGGIO VALIDAZIONE: {validation_score}/10\n"
        "PROPOSTA DI VALORE: {value_proposition}\n"
        "MODELLO DI RICAVO: {revenue_model}\n\n"
        "Trova le migliori opportunità di incubazione e funding per questa idea nel mercato italiano/europeo.\n"
        "Schema JSON richiesto:\n{format_instructions}"
    )),
])


async def run_incubator_finder(payload: dict[str, Any], plan: str) -> dict[str, Any]:
    llm = get_llm(smart=True)
    parser = JsonOutputParser(pydantic_object=IncubatorReport)
    chain = PROMPT | llm | parser

    result = await chain.ainvoke({
        "title": payload.get("title", "Idea di business"),
        "idea_text": payload.get("ideaText", ""),
        "sector": payload.get("sector", "non specificato"),
        "validation_score": payload.get("validationScore", 0),
        "value_proposition": payload.get("valueProp", ""),
        "revenue_model": payload.get("revenueModel", ""),
        "format_instructions": parser.get_format_instructions(),
    })
    return result
