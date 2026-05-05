"""
AffiliationMaterialsAgent — LLM generates custom partnership & marketing materials
for schools, universities, and training centers that partner with NorthStar.
"""
from __future__ import annotations
from typing import Any
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import JsonOutputParser
from pydantic import BaseModel, Field
from agents.base import get_llm


class AffiliationMaterials(BaseModel):
    email_subject: str = Field(description="Oggetto email per proposta di partnership (max 80 char)")
    email_body: str = Field(description="Corpo email di presentazione partnership (200-300 parole, tono professionale)")
    pitch_headline: str = Field(description="Headline per presentazione commerciale (max 15 parole)")
    pitch_bullet_points: list[str] = Field(description="5 punti chiave del valore NorthStar per l'istituzione")
    social_post: str = Field(description="Post LinkedIn annuncio partnership (150-200 parole, tono entusiasta)")
    faq_answers: dict[str, str] = Field(description="3 FAQ principali con risposte (chiave: domanda, valore: risposta)")


PROMPT = ChatPromptTemplate.from_messages([
    ("system", (
        "Sei un esperto di business development e marketing B2B per il settore education italiano. "
        "Crei materiali di partnership professionali, persuasivi e adattati al contesto italiano. "
        "NON usare anglicismi inutili. Rispondi con JSON valido secondo lo schema richiesto."
    )),
    ("human", (
        "Tipo di istituzione partner: {institution_type}\n"
        "Nome istituzione: {institution_name}\n"
        "Città/Regione: {location}\n"
        "Profilo utenti target: {user_profile}\n"
        "Piano NorthStar: {northstar_plan}\n\n"
        "Crea materiali di partnership personalizzati per questa istituzione.\n"
        "Schema JSON richiesto:\n{format_instructions}"
    )),
])

INSTITUTION_TYPES = {
    "university": "Università",
    "high_school": "Liceo / Istituto Superiore",
    "training_center": "Centro di Formazione Professionale",
    "business_school": "Business School",
    "its": "ITS (Istituto Tecnico Superiore)",
}


async def run_affiliation_materials(payload: dict[str, Any], plan: str) -> dict[str, Any]:
    institution_type = payload.get("institutionType", "university")
    institution_name = payload.get("institutionName", "l'istituzione")
    location = payload.get("location", "Italia")
    user_profile = payload.get("userProfile", "studenti e neolaureati")

    llm = get_llm(smart=False)
    parser = JsonOutputParser(pydantic_object=AffiliationMaterials)

    chain = PROMPT | llm | parser
    result = await chain.ainvoke({
        "institution_type": INSTITUTION_TYPES.get(institution_type, institution_type),
        "institution_name": institution_name,
        "location": location,
        "user_profile": user_profile,
        "northstar_plan": "Premium" if plan == "premium" else "Base",
        "format_instructions": parser.get_format_instructions(),
    })
    return result
