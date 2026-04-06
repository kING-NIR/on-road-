"""
RoadAssist ML Microservice — FastAPI
Endpoints:
  POST /recommend         — Smart provider recommendation
  POST /predict-breakdown — Road breakdown risk prediction
  POST /fuel-demand       — Fuel demand prediction
  GET  /risk-insights     — Pre-computed road risk insights
  GET  /health            — Health check
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import numpy as np
import joblib
import os
from pathlib import Path
from datetime import datetime

app = FastAPI(title="RoadAssist ML Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Load Models (on startup) ───────────────────────────────────────────────
MODEL_DIR = Path(__file__).parent / "models"
breakdown_model = None
fuel_model = None
provider_model = None

@app.on_event("startup")
async def load_models():
    global breakdown_model, fuel_model, provider_model
    try:
        breakdown_model = joblib.load(MODEL_DIR / "breakdown_predictor.pkl")
        print("Breakdown model loaded")
    except FileNotFoundError:
        print("⚠️  Breakdown model not found — using rule-based fallback")
    try:
        fuel_model = joblib.load(MODEL_DIR / "fuel_demand.pkl")
        print("Fuel demand model loaded")
    except FileNotFoundError:
        print("⚠️  Fuel model not found — using rule-based fallback")


# ─── Schemas ────────────────────────────────────────────────────────────────
class RecommendRequest(BaseModel):
    service_type: str
    lat: float
    lng: float
    providers: Optional[List[dict]] = None   # injected from backend

class BreakdownRequest(BaseModel):
    lat: float
    lng: float
    highway_code: Optional[str] = None
    hour: Optional[int] = None
    temperature: Optional[float] = None
    rainfall: Optional[float] = None

class FuelDemandRequest(BaseModel):
    lat: float
    lng: float
    hour: Optional[int] = None
    day_of_week: Optional[int] = None
    is_holiday: Optional[bool] = False


# ─── Haversine ──────────────────────────────────────────────────────────────
def haversine(lat1, lng1, lat2, lng2):
    R = 6371
    dlat = (lat2 - lat1) * np.pi / 180
    dlng = (lng2 - lng1) * np.pi / 180
    a = np.sin(dlat/2)**2 + np.cos(lat1*np.pi/180)*np.cos(lat2*np.pi/180)*np.sin(dlng/2)**2
    return R * 2 * np.arctan2(np.sqrt(a), np.sqrt(1-a))


# ─── Provider Recommendation ────────────────────────────────────────────────
@app.post("/recommend")
async def recommend_provider(req: RecommendRequest):
    """
    ML-based provider recommendation.
    Score = 0.50 * (1/dist) + 0.30 * rating_norm + 0.20 * availability_bonus
    Returns top provider_id.
    """
    providers = req.providers or []
    if not providers:
        return {"provider_id": None, "reason": "No providers supplied"}

    scores = []
    for p in providers:
        if not p.get("is_available", True):
            continue
        dist = haversine(req.lat, req.lng, p.get("lat", req.lat), p.get("lng", req.lng))
        dist_score  = 1 / (dist + 0.5)          # inverse distance
        rating_score = p.get("rating", 4.0) / 5.0
        jobs_score   = min(p.get("total_jobs", 0) / 100, 1.0)  # experience bonus

        # Service-type match bonus
        service_match = 1.2 if req.service_type in p.get("service_types", []) else 0.5

        composite = (dist_score * 0.5 + rating_score * 0.3 + jobs_score * 0.2) * service_match
        scores.append({"id": p["id"], "score": composite, "dist_km": round(dist, 2)})

    if not scores:
        return {"provider_id": None, "reason": "No available providers"}

    best = max(scores, key=lambda x: x["score"])
    return {
        "provider_id": best["id"],
        "score": round(best["score"], 4),
        "dist_km": best["dist_km"],
        "algorithm": "weighted_composite_v1"
    }


# ─── Breakdown Risk Prediction ──────────────────────────────────────────────
@app.post("/predict-breakdown")
async def predict_breakdown(req: BreakdownRequest):
    """
    Predicts breakdown probability for a road segment.
    Returns risk_score (0-1) and risk_level (low/medium/high/critical).
    """
    now = datetime.now()
    hour = req.hour if req.hour is not None else now.hour
    temp = req.temperature or 28.0  # Hyderabad default
    rain = req.rainfall or 0.0

    # Feature vector (simplified)
    features = np.array([[
        req.lat, req.lng,
        hour,
        now.weekday(),
        temp,
        rain,
        1 if rain > 10 else 0,   # heavy_rain flag
        1 if hour in range(8,11) or hour in range(17,20) else 0  # peak_hour flag
    ]])

    if breakdown_model:
        score = float(breakdown_model.predict_proba(features)[0][1])
    else:
        # Rule-based fallback
        score = 0.1
        if rain > 20: score += 0.4
        if rain > 5:  score += 0.2
        if hour in range(0,5): score += 0.15   # night driving risk
        if temp > 40: score += 0.1             # engine heat risk
        score = min(score, 1.0)

    level = "low" if score < 0.3 else "medium" if score < 0.6 else "high" if score < 0.8 else "critical"

    return {
        "risk_score": round(score, 3),
        "risk_level": level,
        "factors": {
            "weather": "high" if rain > 10 else "normal",
            "time": "peak" if hour in range(8,11) or hour in range(17,20) else "off-peak",
            "temperature": "extreme" if temp > 42 else "normal"
        }
    }


# ─── Fuel Demand Prediction ─────────────────────────────────────────────────
@app.post("/fuel-demand")
async def predict_fuel_demand(req: FuelDemandRequest):
    """
    Predicts fuel demand level for a location.
    Helps fuel providers pre-position stock.
    """
    now = datetime.now()
    hour = req.hour if req.hour is not None else now.hour
    dow  = req.day_of_week if req.day_of_week is not None else now.weekday()

    features = np.array([[req.lat, req.lng, hour, dow, int(req.is_holiday)]])

    if fuel_model:
        demand = float(fuel_model.predict(features)[0])
    else:
        # Rule-based
        base = 50
        if hour in range(7, 10) or hour in range(17, 21): base += 30
        if dow >= 5: base += 20   # weekend
        if req.is_holiday: base += 40
        demand = min(base, 100)

    level = "low" if demand < 40 else "medium" if demand < 70 else "high"
    return { "demand_score": round(demand, 1), "demand_level": level, "recommended_stock_multiplier": round(demand / 50, 2) }


# ─── Road Risk Insights (static + dynamic) ──────────────────────────────────
@app.get("/risk-insights")
async def risk_insights():
    """Pre-computed road risk insights for dashboard display."""
    return {
        "insights": [
            {
                "route": "NH-44 near Nagpur",
                "level": "high",
                "icon": "⚠️",
                "message": "NH-44 near Nagpur — 3 breakdown reports in the last hour. Fuel stations sparse next 80 km.",
                "risk_score": 0.78
            },
            {
                "route": "Hyderabad ORR",
                "level": "medium",
                "icon": "🔶",
                "message": "Hyderabad ORR — Peak hour congestion. Expected fuel consumption +18% above normal.",
                "risk_score": 0.52
            },
            {
                "route": "Mumbai–Pune Expressway",
                "level": "low",
                "icon": "✅",
                "message": "Mumbai–Pune Expressway — No breakdown incidents. Fuel stations every 15 km.",
                "risk_score": 0.15
            }
        ],
        "updated_at": datetime.now().isoformat()
    }


# ─── Health Check ────────────────────────────────────────────────────────────
@app.get("/health")
async def health():
    return {
        "status": "ok",
        "models": {
            "breakdown": breakdown_model is not None,
            "fuel_demand": fuel_model is not None
        },
        "timestamp": datetime.now().isoformat()
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
