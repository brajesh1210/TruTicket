"""
TruTicket ML Risk Service
FastAPI service for bot risk scoring during checkout and queue entry.
Prototype: uses synthetic dataset. Production: replace with real telemetry.
"""
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Optional
import joblib
import os
import numpy as np
from datetime import datetime

app = FastAPI(title="TruTicket ML Risk Service", version="1.0.0")

# ---------------------------------------------------------------------------
# Request / Response Models
# ---------------------------------------------------------------------------
class SessionFeatures(BaseModel):
    account_age_days: int
    purchase_attempts: int
    account_reuse_count: int
    session_reuse_count: int
    device_integrity_score: float  # 0.0 to 1.0
    rapid_holds_count: int
    rapid_cancellations_count: int
    events_attempted: int
    time_between_actions_ms: float
    ip_burst_count: int

class RiskInferenceResponse(BaseModel):
    risk_score: int            # 0-100
    risk_band: str             # LOW, MEDIUM, HIGH
    reason_codes: List[str]
    model_version: str
    recommended_action: str    # allow, rate_limit, step_up, hold_for_review

class HealthResponse(BaseModel):
    status: str
    model_loaded: bool
    timestamp: str

# ---------------------------------------------------------------------------
# Model Loading (placeholder — train first)
# ---------------------------------------------------------------------------
MODEL_PATH = os.getenv("ML_MODEL_PATH", "./model/risk_model.pkl")
model = None
model_version = "synthetic-v1.0"

def load_model():
    global model
    if os.path.exists(MODEL_PATH):
        model = joblib.load(MODEL_PATH)
        return True
    return False

model_loaded = load_model()

# ---------------------------------------------------------------------------
# Risk Rule Engine (fallback when no model)
# ---------------------------------------------------------------------------
def rule_based_scoring(f: SessionFeatures) -> RiskInferenceResponse:
    score = 0
    reasons: List[str] = []

    if f.account_age_days < 7:
        score += 25
        reasons.append("NEW_ACCOUNT")
    if f.purchase_attempts > 5:
        score += 20
        reasons.append("RAPID_CHECKOUT_CADENCE")
    if f.ip_burst_count > 10:
        score += 20
        reasons.append("IP_BURST_RATE_EXCEEDED")
    if f.rapid_holds_count > 3:
        score += 15
        reasons.append("RAPID_HOLDS")
    if f.rapid_cancellations_count > 2:
        score += 15
        reasons.append("RAPID_CANCELLATIONS")
    if f.device_integrity_score < 0.5:
        score += 15
        reasons.append("LOW_DEVICE_INTEGRITY")
    if f.session_reuse_count > 3:
        score += 10
        reasons.append("SESSION_REUSE")
    if f.events_attempted > 10:
        score += 10
        reasons.append("MULTI_EVENT_ATTEMPTS")

    score = min(score, 100)

    if score >= 70:
        band = "HIGH"
        action = "hold_for_review"
    elif score >= 40:
        band = "MEDIUM"
        action = "step_up"
    elif score >= 15:
        band = "MEDIUM"
        action = "rate_limit"
    else:
        band = "LOW"
        action = "allow"

    return RiskInferenceResponse(
        risk_score=score,
        risk_band=band,
        reason_codes=reasons,
        model_version=model_version,
        recommended_action=action,
    )

# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------
@app.get("/health", response_model=HealthResponse)
async def health():
    return HealthResponse(
        status="ok",
        model_loaded=model_loaded,
        timestamp=datetime.utcnow().isoformat() + "Z",
    )

@app.post("/predict", response_model=RiskInferenceResponse)
async def predict(features: SessionFeatures):
    if model_loaded and model is not None:
        # ML model inference (production path)
        X = np.array([[
            features.account_age_days,
            features.purchase_attempts,
            features.account_reuse_count,
            features.session_reuse_count,
            features.device_integrity_score,
            features.rapid_holds_count,
            features.rapid_cancellations_count,
            features.events_attempted,
            features.time_between_actions_ms,
            features.ip_burst_count,
        ]])
        proba = model.predict_proba(X)[0][1]  # probability of bot
        score = int(proba * 100)
    else:
        # Rule-based fallback (prototype path)
        result = rule_based_scoring(features)
        score = result.risk_score
        return result

    # Map score to band and action
    if score >= 70:
        band, action = "HIGH", "hold_for_review"
    elif score >= 40:
        band, action = "MEDIUM", "step_up"
    elif score >= 15:
        band, action = "MEDIUM", "rate_limit"
    else:
        band, action = "LOW", "allow"

    # Simple reason codes for ML path
    reasons: List[str] = []
    if score >= 70:
        reasons.append("ML_HIGH_RISK")
    elif score >= 40:
        reasons.append("ML_MEDIUM_RISK")

    return RiskInferenceResponse(
        risk_score=score,
        risk_band=band,
        reason_codes=reasons,
        model_version=model_version,
        recommended_action=action,
    )

@app.post("/train")
async def train():
    """
    Train on synthetic dataset. Call this after generating synthetic data.
    In production, replace with real labelled telemetry.
    """
    # Placeholder — implement training script in train.py
    return {
        "status": "not_implemented",
        "message": "Use scripts/train_synthetic.py to generate and train on synthetic data",
    }