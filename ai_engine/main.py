import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any

# Import services
from services.smc_detector import detect_smc_concepts
from services.sentiment_analyzer import analyze_headlines
from models.prediction import generate_ensemble_predictions

app = FastAPI(
    title="Aurax AI Platform - Engine",
    description="Institutional-grade AI intelligence engine for Gold (XAUUSD) trading.",
    version="1.0.0"
)

# Enable CORS for communication with our Node.js Backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Pydantic Schemas
class CandleData(BaseModel):
    timestamp: Any
    open: float
    high: float
    low: float
    close: float
    volume: float

class SMCRequest(BaseModel):
    candles: List[CandleData]

class HeadlineData(BaseModel):
    title: str
    description: Optional[str] = None
    url: Optional[str] = None
    source: Optional[str] = None

class SentimentRequest(BaseModel):
    headlines: List[HeadlineData]

class PredictRequest(BaseModel):
    candles: List[CandleData]
    sentiment_score: Optional[float] = 0.0

# Health check route
@app.get("/")
def read_root():
    return {
        "status": "healthy",
        "service": "Aurax AI Engine",
        "model_status": {
            "random_forest": "active",
            "xgboost": "active",
            "lstm_simulator": "active"
        }
    }

# SMC Concepts Detection Endpoint
@app.post("/api/smc")
def get_smc_concepts(request: SMCRequest):
    try:
        # Convert Pydantic list to list of dicts
        candles_list = [c.model_dump() for c in request.candles]
        results = detect_smc_concepts(candles_list)
        return results
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"SMC detection error: {str(e)}")

# News Sentiment Analysis Endpoint
@app.post("/api/sentiment")
def get_sentiment(request: SentimentRequest):
    try:
        headlines_list = [h.model_dump() for h in request.headlines]
        results = analyze_headlines(headlines_list)
        return results
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Sentiment analysis error: {str(e)}")

# AI Prediction Ensemble Endpoint
@app.post("/api/predict")
def get_predictions(request: PredictRequest):
    try:
        candles_list = [c.model_dump() for c in request.candles]
        results = generate_ensemble_predictions(candles_list, request.sentiment_score)
        return results
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prediction error: {str(e)}")

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
