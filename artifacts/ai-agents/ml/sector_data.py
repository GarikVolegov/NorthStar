"""
Settori RIASEC per NorthStar — 28 settori europei.

Ogni settore ha un vettore RIASEC medio basato su dati O*NET + letteratura
europea (CEDEFOP). I valori sono normalizzati [0,1].

Questo modulo è il "ground truth" per il modello di raccomandazione:
più il profilo RIASEC dell'utente è simile al vettore del settore,
più alta la probabilità di soddisfazione professionale.
"""
from __future__ import annotations
import numpy as np

# Ordine dimensioni: [R, I, A, S, E, C]
# R=Realistic, I=Investigative, A=Artistic, S=Social, E=Enterprising, C=Conventional

SECTORS: list[dict] = [
    # Tech & Engineering
    {"id": "software_development",   "name": "Sviluppo Software",           "riasec": [0.4, 0.9, 0.5, 0.3, 0.5, 0.7]},
    {"id": "data_science",           "name": "Data Science & AI",           "riasec": [0.3, 0.95, 0.4, 0.3, 0.5, 0.8]},
    {"id": "cybersecurity",          "name": "Cybersecurity",               "riasec": [0.5, 0.9, 0.3, 0.2, 0.5, 0.8]},
    {"id": "hardware_engineering",   "name": "Ingegneria Hardware",         "riasec": [0.9, 0.8, 0.4, 0.2, 0.4, 0.7]},
    {"id": "robotics_automation",    "name": "Robotica & Automazione",      "riasec": [0.85, 0.85, 0.5, 0.2, 0.4, 0.6]},
    {"id": "cloud_devops",           "name": "Cloud & DevOps",              "riasec": [0.5, 0.85, 0.3, 0.3, 0.5, 0.8]},
    # Creative
    {"id": "ux_design",             "name": "UX/UI Design",               "riasec": [0.3, 0.5, 0.9, 0.6, 0.5, 0.4]},
    {"id": "digital_marketing",     "name": "Digital Marketing",           "riasec": [0.2, 0.4, 0.7, 0.7, 0.8, 0.5]},
    {"id": "content_creation",      "name": "Content Creation & Media",    "riasec": [0.2, 0.3, 0.95, 0.6, 0.6, 0.3]},
    {"id": "architecture",          "name": "Architettura & Design",       "riasec": [0.7, 0.6, 0.9, 0.4, 0.5, 0.5]},
    # Business & Finance
    {"id": "entrepreneurship",      "name": "Imprenditoria & Startup",     "riasec": [0.4, 0.6, 0.6, 0.5, 0.95, 0.4]},
    {"id": "finance_banking",       "name": "Finanza & Banking",           "riasec": [0.2, 0.7, 0.2, 0.3, 0.7, 0.9]},
    {"id": "consulting",            "name": "Consulenza Strategica",       "riasec": [0.2, 0.7, 0.4, 0.6, 0.85, 0.6]},
    {"id": "project_management",    "name": "Project Management",          "riasec": [0.4, 0.6, 0.3, 0.6, 0.8, 0.7]},
    {"id": "sales",                 "name": "Vendite & Business Dev",      "riasec": [0.3, 0.3, 0.5, 0.7, 0.95, 0.4]},
    # Social & Education
    {"id": "education_training",    "name": "Formazione & Istruzione",     "riasec": [0.2, 0.6, 0.6, 0.9, 0.5, 0.5]},
    {"id": "social_work",           "name": "Lavoro Sociale & NGO",        "riasec": [0.2, 0.3, 0.5, 0.95, 0.5, 0.3]},
    {"id": "healthcare_clinical",   "name": "Healthcare & Clinica",        "riasec": [0.5, 0.7, 0.3, 0.9, 0.4, 0.6]},
    {"id": "hr_people_ops",         "name": "HR & People Operations",      "riasec": [0.2, 0.4, 0.4, 0.85, 0.6, 0.6]},
    # Science & Research
    {"id": "biotech_pharma",        "name": "Biotech & Farmaceutica",      "riasec": [0.6, 0.95, 0.4, 0.5, 0.4, 0.7]},
    {"id": "environmental_science", "name": "Scienze Ambientali",          "riasec": [0.7, 0.85, 0.5, 0.6, 0.4, 0.6]},
    {"id": "physics_research",      "name": "Fisica & Ricerca",            "riasec": [0.5, 0.98, 0.5, 0.3, 0.3, 0.7]},
    # Legal & Public
    {"id": "law_legal",             "name": "Diritto & Legal",             "riasec": [0.2, 0.7, 0.3, 0.5, 0.7, 0.9]},
    {"id": "public_administration", "name": "Pubblica Amministrazione",    "riasec": [0.3, 0.5, 0.2, 0.6, 0.5, 0.95]},
    {"id": "journalism_media",      "name": "Giornalismo & Media",         "riasec": [0.2, 0.5, 0.8, 0.7, 0.6, 0.3]},
    # Trades & Operations
    {"id": "logistics_supply_chain","name": "Logistica & Supply Chain",    "riasec": [0.6, 0.5, 0.2, 0.4, 0.6, 0.8]},
    {"id": "manufacturing",         "name": "Manifatturiero & Industria",  "riasec": [0.9, 0.6, 0.3, 0.3, 0.5, 0.7]},
    {"id": "hospitality_tourism",   "name": "Turismo & Hospitality",       "riasec": [0.4, 0.3, 0.6, 0.85, 0.6, 0.5]},
]


def get_sector_matrix() -> tuple[np.ndarray, list[dict]]:
    """
    Restituisce (matrice_riasec [N x 6], lista_settori).
    La matrice è usata per similarità coseno e addestramento modelli.
    """
    matrix = np.array([s["riasec"] for s in SECTORS], dtype=np.float32)
    return matrix, SECTORS


def get_sector_by_id(sector_id: str) -> dict | None:
    return next((s for s in SECTORS if s["id"] == sector_id), None)
