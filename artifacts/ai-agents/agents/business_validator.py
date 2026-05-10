"""
BusinessValidatorAgent — valida un'idea di business con analisi strutturata.
Produce: problema, target, proposta di valore, modello di ricavo, rischi,
esperimenti iniziali, punteggio di fattibilità e livello di confidenza.
"""
from __future__ import annotations
from typing import Any
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import JsonOutputParser
from pydantic import BaseModel, Field
from agents.base import get_llm


class BusinessValidation(BaseModel):
    title: str = Field(description="Titolo sintetico dell'idea (max 8 parole)")
    problem: str = Field(description="Problema reale risolto (2-3 frasi concrete)")
    target: str = Field(description="Target preciso: chi, età, contesto, bisogno")
    value_proposition: str = Field(description="Proposta di valore unica in 1 frase potente")
    differentiation: str = Field(description="Come si differenzia dai competitor esistenti")
    revenue_model: str = Field(description="Modello di ricavo: come genera denaro concretamente")
    technical_complexity: str = Field(description="Complessità tecnica: Bassa / Media / Alta con spiegazione")
    main_risks: list[str] = Field(description="3 rischi principali con impatto stimato")
    first_experiments: list[str] = Field(description="3 esperimenti concreti da fare nei primi 30 giorni per validare")
    market_size: str = Field(description="Stima del mercato in Italia/Europa (TAM/SAM/SOM semplificato)")
    investor_pitch: str = Field(description="Pitch di 3 righe investor-ready")
    validation_score: float = Field(description="Punteggio da 0 a 10 di fattibilità e potenziale")
    confidence_level: str = Field(description="Livello di confidenza: Basso / Medio / Alto")
    improvement_tips: list[str] = Field(description="3 suggerimenti concreti per rafforzare l'idea")


PROMPT = ChatPromptTemplate.from_messages([
    ("system", (
        "Sei un esperto di startup validation e business strategy per il mercato italiano ed europeo. "
        "Hai lavorato con centinaia di startup e conosci fondi, acceleratori e grant italiani. "
        "Sei critico ma costruttivo: non dici mai 'bella idea', ma analizzi concretamente cosa funziona e cosa no. "
        "Il tuo obiettivo è rendere l'idea presentabile a investitori o incubatori. "
        "Rispondi SEMPRE con JSON valido secondo lo schema richiesto."
    )),
    ("human", (
        "Analizza questa idea di business:\n\n"
        "DESCRIZIONE: {idea_text}\n"
        "SETTORE: {sector}\n"
        "TIPO DI LAVORO: {work_type}\n\n"
        "Produci una validazione completa e actionable. Sii specifico per il mercato italiano.\n"
        "Schema JSON richiesto:\n{format_instructions}"
    )),
])


async def run_business_validator(payload: dict[str, Any], plan: str) -> dict[str, Any]:
    idea_text: str = payload.get("ideaText", "")
    sector: str = payload.get("sector", "non specificato")
    work_type: str = payload.get("workType", "autonomo")

    work_type_label = "Lavoro autonomo / Freelance / Startup" if work_type == "autonomous" else "Lavoro dipendente / Corporate"

    llm = get_llm(smart=True)
    parser = JsonOutputParser(pydantic_object=BusinessValidation)
    chain = PROMPT | llm | parser

    result = await chain.ainvoke({
        "idea_text": idea_text,
        "sector": sector,
        "work_type": work_type_label,
        "format_instructions": parser.get_format_instructions(),
    })
    return result
