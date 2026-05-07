"""
LinkedInExtractorAgent — analizza testo grezzo di un profilo LinkedIn e restituisce
dati strutturati: riepilogo, esperienze lavorative, formazione, skill e certificazioni.
Input: testo incollato dall'utente dalla sua pagina LinkedIn.
Output: JSON strutturato compatibile con il profilo NorthStar.
"""
from __future__ import annotations
from typing import Any
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import JsonOutputParser
from pydantic import BaseModel, Field
from agents.base import get_llm


class WorkExperience(BaseModel):
    company: str = Field(description="Nome azienda")
    role: str = Field(description="Titolo del ruolo/posizione")
    start_date: str = Field(description="Data inizio (es. Gen 2021 o 2021). Stringa libera, '' se non trovato")
    end_date: str = Field(description="Data fine (es. Dic 2023, 'Presente' se corrente, '' se non trovato)")
    description: str = Field(description="Descrizione responsabilità e risultati. Max 3 frasi. '' se non disponibile")
    location: str = Field(description="Città / paese. '' se non trovato")
    is_current: bool = Field(description="True se è la posizione attuale")


class Education(BaseModel):
    institution: str = Field(description="Nome istituto/università")
    degree: str = Field(description="Titolo di studio (es. Laurea Triennale, Master, Diploma). '' se non trovato")
    field: str = Field(description="Campo di studio (es. Informatica, Marketing). '' se non trovato")
    start_year: str = Field(description="Anno inizio. '' se non trovato")
    end_year: str = Field(description="Anno fine. '' se non trovato")


class LinkedInCertification(BaseModel):
    name: str = Field(description="Nome della certificazione o corso")
    issuer: str = Field(description="Ente emittente (es. Google, Coursera, Udemy)")
    issued_date: str = Field(description="Data conseguimento. '' se non trovato")
    credential_url: str = Field(description="URL credenziale. '' se non trovato")


class LinkedInProfile(BaseModel):
    full_name: str = Field(description="Nome completo dell'utente. '' se non trovato")
    headline: str = Field(description="Titolo professionale/headline. '' se non trovato")
    location: str = Field(description="Posizione geografica. '' se non trovato")
    summary: str = Field(description="Riepilogo professionale estratto. Max 4 frasi. '' se non presente")
    skills: list[str] = Field(description="Lista di skill tecniche e trasversali. Max 20. [] se non trovate")
    work_experiences: list[WorkExperience] = Field(description="Lista esperienze lavorative ordinate dalla più recente")
    education: list[Education] = Field(description="Lista percorsi formativi ordinate dal più recente")
    certifications: list[LinkedInCertification] = Field(description="Lista certificazioni e corsi completati")
    languages: list[str] = Field(description="Lingue conosciute (es. Italiano, English). [] se non trovate")
    sector_suggestion: str = Field(description="Settore professionale principale suggerito in base al profilo (es. 'Marketing Digitale', 'Ingegneria del Software', 'Consulenza Aziendale')")
    career_level: str = Field(description="Livello di carriera stimato: Junior / Mid / Senior / Manager / Executive")
    years_of_experience: int = Field(description="Anni totali stimati di esperienza lavorativa. 0 se non determinabile")
    north_star_notes: str = Field(description="Nota AI per NorthStar: insight chiave su questo profilo, punti di forza e aree di crescita. Max 3 frasi")


PROMPT = ChatPromptTemplate.from_messages([
    ("system", (
        "Sei un HR analyst esperto che analizza profili LinkedIn per il mercato italiano ed europeo. "
        "Il tuo compito è estrarre informazioni strutturate da testo grezzo di un profilo LinkedIn. "
        "Il testo può essere incompleto, non formattato o in lingue diverse (italiano, inglese, ecc). "
        "Estrai SOLO ciò che è esplicitamente presente nel testo — non inventare nulla. "
        "Se un campo non è trovabile nel testo, usa il valore vuoto (stringa vuota o lista vuota). "
        "Per work_experiences, education e certifications estrai TUTTI gli elementi presenti nel testo. "
        "Rispondi SEMPRE con JSON valido secondo lo schema richiesto."
    )),
    ("human", (
        "Analizza il seguente testo di profilo LinkedIn e estrai i dati strutturati.\n\n"
        "TESTO PROFILO:\n{profile_text}\n\n"
        "Schema JSON richiesto:\n{format_instructions}\n\n"
        "Importante: non inventare dati non presenti nel testo."
    )),
])


async def run_linkedin_extractor(payload: dict[str, Any], plan: str) -> dict[str, Any]:
    profile_text: str = payload.get("profileText", "")

    if not profile_text.strip():
        return {"error": "Testo del profilo mancante"}

    if len(profile_text) > 15000:
        profile_text = profile_text[:15000]

    llm = get_llm(smart=True)
    parser = JsonOutputParser(pydantic_object=LinkedInProfile)
    chain = PROMPT | llm | parser

    result = await chain.ainvoke({
        "profile_text": profile_text,
        "format_instructions": parser.get_format_instructions(),
    })
    return result
