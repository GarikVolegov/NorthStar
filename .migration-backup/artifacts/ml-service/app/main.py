from __future__ import annotations
from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, Field
from typing import Any, Dict, List, Optional
from time import perf_counter
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.neighbors import NearestNeighbors
from sklearn.preprocessing import StandardScaler
from sklearn.cluster import KMeans
import numpy as np

APP_VERSION = '1.0.0'
MODEL_VERSION = '2026.05.recommendation-v1'
INTERNAL_SECRET = ''
app = FastAPI(title='NorthStar ML Service', version=APP_VERSION)
RIASEC_KEYS = ['realistic','investigative','artistic','social','enterprising','conventional']
SECTORS = [
 {'sector_id':'software_engineering','sector_name':'Software Engineering','riasec':[0.55,0.90,0.35,0.30,0.45,0.55],'skills':['typescript','javascript','react','node.js','sql','api','git','testing'],'experience_weight':0.6},
 {'sector_id':'data_science','sector_name':'Data Science','riasec':[0.35,0.95,0.40,0.25,0.35,0.45],'skills':['python','pandas','numpy','scikit-learn','statistics','sql','machine learning'],'experience_weight':0.5},
 {'sector_id':'product_management','sector_name':'Product Management','riasec':[0.20,0.55,0.45,0.70,0.85,0.50],'skills':['roadmap','analytics','ux','stakeholder management','agile','prioritization'],'experience_weight':0.7},
 {'sector_id':'digital_marketing','sector_name':'Digital Marketing','riasec':[0.15,0.40,0.75,0.65,0.80,0.35],'skills':['seo','copywriting','content','analytics','social media','campaigns'],'experience_weight':0.4},
 {'sector_id':'ux_ui_design','sector_name':'UX/UI Design','riasec':[0.20,0.45,0.92,0.55,0.45,0.30],'skills':['figma','wireframes','design systems','ux research','prototyping'],'experience_weight':0.3},
 {'sector_id':'cybersecurity','sector_name':'Cybersecurity','riasec':[0.55,0.88,0.20,0.25,0.40,0.65],'skills':['networking','linux','security','threat detection','siem','compliance'],'experience_weight':0.6},
 {'sector_id':'finance_trading','sector_name':'Finance & Trading','riasec':[0.35,0.82,0.28,0.25,0.76,0.58],'skills':['markets','macro','risk management','excel','python','analysis'],'experience_weight':0.8},
 {'sector_id':'education_coaching','sector_name':'Education & Coaching','riasec':[0.12,0.42,0.50,0.92,0.48,0.35],'skills':['teaching','communication','mentoring','curriculum','coaching'],'experience_weight':0.4},
]
SECTOR_TEXTS = [' '.join(s['skills']) + ' ' + s['sector_name'].lower() for s in SECTORS]
TFIDF = TfidfVectorizer(ngram_range=(1,2))
SECTOR_SKILL_MATRIX = TFIDF.fit_transform(SECTOR_TEXTS)
SECTOR_RIASEC = np.array([s['riasec'] for s in SECTORS], dtype=float)
RIASEC_SCALER = StandardScaler().fit(SECTOR_RIASEC)
SECTOR_RIASEC_SCALED = RIASEC_SCALER.transform(SECTOR_RIASEC)
NN_MODEL = NearestNeighbors(metric='cosine', algorithm='brute')
NN_MODEL.fit(SECTOR_RIASEC_SCALED)
KMEANS_MODEL = KMeans(n_clusters=4, random_state=42, n_init=10)
SECTOR_CLUSTERS = KMEANS_MODEL.fit_predict(SECTOR_RIASEC_SCALED)

class RiasecScores(BaseModel):
    realistic: float = Field(ge=0, le=1)
    investigative: float = Field(ge=0, le=1)
    artistic: float = Field(ge=0, le=1)
    social: float = Field(ge=0, le=1)
    enterprising: float = Field(ge=0, le=1)
    conventional: float = Field(ge=0, le=1)
    def as_list(self) -> List[float]:
        return [getattr(self, key) for key in RIASEC_KEYS]

class RecommendRequest(BaseModel):
    user_id: int
    riasec: RiasecScores
    preferred_sectors: List[str] = []
    skills: List[str] = []
    years_experience: int = Field(default=0, ge=0, le=50)
    is_premium: bool = False
    top_k: int = Field(default=5, ge=1, le=20)

class SimilarityRequest(BaseModel):
    riasec: RiasecScores
    top_k: int = Field(default=10, ge=1, le=20)

class SkillRecommendRequest(BaseModel):
    user_id: int
    target_sector_id: str
    current_skills: List[str] = []
    top_k: int = Field(default=8, ge=1, le=20)

class SimilarUsersRequest(BaseModel):
    user_id: int
    riasec: RiasecScores
    skills: List[str] = []
    top_k: int = Field(default=5, ge=1, le=20)

class ClusterProfileRequest(BaseModel):
    riasec: RiasecScores

def _check_secret(x_internal_secret: Optional[str]) -> None:
    if INTERNAL_SECRET and x_internal_secret != INTERNAL_SECRET:
        raise HTTPException(status_code=401, detail='INVALID_INTERNAL_SECRET')

def _cos(a: List[float], b: List[float]) -> float:
    return float(cosine_similarity(np.array(a).reshape(1,-1), np.array(b).reshape(1,-1))[0,0])

def _skill_overlap(user_skills: List[str], sector_skills: List[str]) -> float:
    if not user_skills: return 0.0
    user_set = {s.strip().lower() for s in user_skills if s.strip()}
    sector_set = {s.strip().lower() for s in sector_skills if s.strip()}
    if not user_set or not sector_set: return 0.0
    return len(user_set & sector_set) / len(sector_set)

def _preferred_bonus(preferred: List[str], sector_id: str) -> float:
    return 0.08 if sector_id.lower() in {p.strip().lower() for p in preferred} else 0.0

def _experience_bonus(years_experience: int, weight: float) -> float:
    return (min(max(years_experience,0),10) / 10.0) * 0.08 * weight

def _skill_gap(current_skills: List[str], sector_skills: List[str]) -> List[str]:
    user_set = {s.strip().lower() for s in current_skills if s.strip()}
    return [skill for skill in sector_skills if skill.lower() not in user_set]

@app.get('/ml/health')
def health() -> Dict[str, Any]:
    return {'status':'ok','module':'northstar-ml','is_trained':True,'feature_count':len(RIASEC_KEYS),'algorithm':'content-based + tfidf + knn + kmeans','version':APP_VERSION,'metadata':{'model_version':MODEL_VERSION,'sector_count':len(SECTORS),'cluster_count':4}}

@app.post('/ml/recommend')
def recommend(body: RecommendRequest, x_internal_secret: Optional[str] = Header(default=None)) -> Dict[str, Any]:
    _check_secret(x_internal_secret)
    start = perf_counter(); user_vec = body.riasec.as_list(); recs = []
    for sector in SECTORS:
        riasec_match = _cos(user_vec, sector['riasec'])
        skill_match = _skill_overlap(body.skills, sector['skills'])
        score = min(1.0, 0.72*riasec_match + 0.18*skill_match + _preferred_bonus(body.preferred_sectors, sector['sector_id']) + _experience_bonus(body.years_experience, sector['experience_weight']) + (0.02 if body.is_premium else 0.0))
        recs.append({'sector_id':sector['sector_id'],'sector_name':sector['sector_name'],'score':round(score,4),'riasec_match':round(riasec_match,4),'why':f"RIASEC match {riasec_match:.2f}, skill match {skill_match:.2f}"})
    recs.sort(key=lambda x: x['score'], reverse=True); top = recs[:body.top_k]
    for idx, item in enumerate(top, start=1): item['rank'] = idx
    return {'user_id':body.user_id,'recommendations':top,'model_version':MODEL_VERSION,'algorithm':'content_based_hybrid_v1','processing_ms':int((perf_counter()-start)*1000)}

@app.post('/ml/sector-similarity')
def sector_similarity(body: SimilarityRequest, x_internal_secret: Optional[str] = Header(default=None)) -> Dict[str, Any]:
    _check_secret(x_internal_secret)
    start = perf_counter(); sims = cosine_similarity(np.array(body.riasec.as_list()).reshape(1,-1), SECTOR_RIASEC)[0]; order = np.argsort(-sims)[:body.top_k]
    return {'similarities':[{'sector_id':SECTORS[i]['sector_id'],'sector_name':SECTORS[i]['sector_name'],'cosine_score':round(float(sims[i]),4)} for i in order],'processing_ms':int((perf_counter()-start)*1000)}

@app.post('/ml/recommend-skills')
def recommend_skills(body: SkillRecommendRequest, x_internal_secret: Optional[str] = Header(default=None)) -> Dict[str, Any]:
    _check_secret(x_internal_secret)
    start = perf_counter(); target = next((s for s in SECTORS if s['sector_id'] == body.target_sector_id), None)
    if not target: raise HTTPException(status_code=404, detail='TARGET_SECTOR_NOT_FOUND')
    user_matrix = TFIDF.transform([' '.join(body.current_skills).strip().lower() or 'generalist'])
    target_idx = next(i for i, s in enumerate(SECTORS) if s['sector_id'] == body.target_sector_id)
    semantic_match = float(cosine_similarity(user_matrix, SECTOR_SKILL_MATRIX[target_idx])[0,0])
    gap = _skill_gap(body.current_skills, target['skills'])
    recommendations = [{'rank':rank,'skill':skill,'importance':round(max(0.1,1-(rank-1)*0.08),2),'reason':f"Skill rilevante per {target['sector_name']} e non presente nel profilo corrente"} for rank, skill in enumerate(gap[:body.top_k], start=1)]
    return {'user_id':body.user_id,'target_sector_id':body.target_sector_id,'target_sector_name':target['sector_name'],'semantic_match':round(semantic_match,4),'recommendations':recommendations,'algorithm':'tfidf_skill_gap_v1','processing_ms':int((perf_counter()-start)*1000)}

@app.post('/ml/similar-users')
def similar_users(body: SimilarUsersRequest, x_internal_secret: Optional[str] = Header(default=None)) -> Dict[str, Any]:
    _check_secret(x_internal_secret)
    start = perf_counter(); distances, indices = NN_MODEL.kneighbors(RIASEC_SCALER.transform([body.riasec.as_list()]), n_neighbors=min(body.top_k, len(SECTORS)))
    results = []
    for rank, (idx, dist) in enumerate(zip(indices[0], distances[0]), start=1):
        sector = SECTORS[int(idx)]
        results.append({'rank':rank,'proxy_profile_id':f"profile_like_{sector['sector_id']}",'closest_sector_id':sector['sector_id'],'closest_sector_name':sector['sector_name'],'distance':round(float(dist),4),'similarity':round(1-float(dist),4)})
    return {'user_id':body.user_id,'neighbors':results,'algorithm':'knn_riasec_v1','processing_ms':int((perf_counter()-start)*1000)}

@app.post('/ml/profile-cluster')
def profile_cluster(body: ClusterProfileRequest, x_internal_secret: Optional[str] = Header(default=None)) -> Dict[str, Any]:
    _check_secret(x_internal_secret)
    start = perf_counter(); scaled = RIASEC_SCALER.transform([body.riasec.as_list()]); cluster_id = int(KMEANS_MODEL.predict(scaled)[0])
    members = [SECTORS[i] for i, c in enumerate(SECTOR_CLUSTERS) if int(c) == cluster_id]; centroid = np.mean(np.array([m['riasec'] for m in members]), axis=0)
    archetype = max(members, key=lambda sector: _cos(list(centroid), sector['riasec']))
    return {'cluster_id':cluster_id,'cluster_size':len(members),'archetype_sector_id':archetype['sector_id'],'archetype_sector_name':archetype['sector_name'],'member_sectors':[{'sector_id':s['sector_id'],'sector_name':s['sector_name']} for s in members],'algorithm':'kmeans_riasec_v1','processing_ms':int((perf_counter()-start)*1000)}
