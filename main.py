"""Mental Health Score Prediction API.

Loads the existing scikit-learn Pipeline saved in Model.pkl
(ColumnTransformer preprocessor + RandomForestRegressor). The pipeline does
all preprocessing itself, so inputs are passed to it raw: no scaling or
encoding is repeated here.
"""
import logging
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Literal

import joblib
import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field, model_validator

logger = logging.getLogger("mh-api")

BASE_DIR = Path(__file__).resolve().parent
MODEL_PATH = BASE_DIR / "Model.pkl"
FRONTEND_DIR = BASE_DIR / "frontend"

# Countries the model was trained with; every other country becomes "Other".
TOP_COUNTRIES = ["India", "USA", "Canada", "Australia", "UK",
                 "Germany", "Mexico", "Turkey", "France"]
_COUNTRY_LOOKUP = {c.lower(): c for c in TOP_COUNTRIES}


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.model = None
    app.state.model_error = None
    try:
        app.state.model = joblib.load(MODEL_PATH)
        logger.info("Model loaded from %s", MODEL_PATH)
    except Exception as exc:  # keep the server up so /api/health can report it
        app.state.model_error = f"{type(exc).__name__}: {exc}"
        logger.exception("Could not load model")
    yield


app = FastAPI(title="Mental Health Score Prediction", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class StudentData(BaseModel):
    Age: int = Field(..., ge=10, le=100)
    Gender: Literal["Male", "Female"]
    Country: str = Field(..., min_length=1, max_length=60)
    Academic_Level: Literal["Undergraduate", "Graduate", "High School"]
    Most_Used_Platform: Literal[
        "Facebook", "LinkedIn", "Instagram", "Snapchat", "Twitter", "YouTube",
        "TikTok", "LINE", "KakaoTalk", "VKontakte", "WhatsApp", "WeChat"]
    Purpose_Of_Use: Literal["Networking", "Education", "Entertainment", "News"]
    Avg_Daily_Usage_Hours: float = Field(..., ge=0, le=24)
    Daily_Unlocks: int = Field(..., ge=0, le=2000)
    Study_Hours: float = Field(..., ge=0, le=24)
    Physical_Activity_Hours: float = Field(..., ge=0, le=24)
    Sleep_Hours_Per_Night: float = Field(..., ge=0, le=24)
    Stress_Level: Literal["Low", "Medium", "High", "Very High"]

    @model_validator(mode="after")
    def daily_hours_fit_in_a_day(self):
        total = (self.Study_Hours + self.Physical_Activity_Hours
                 + self.Sleep_Hours_Per_Night)
        if total > 24:
            raise ValueError(
                "Study, physical activity and sleep hours together cannot exceed 24.")
        return self


class PredictionResponse(BaseModel):
    predicted_mental_health_score: float
    country_group: str


@app.get("/api/health")
def health():
    loaded = app.state.model is not None
    body = {"status": "ok" if loaded else "degraded", "model_loaded": loaded}
    if not loaded:
        body["detail"] = app.state.model_error
    return body


@app.post("/api/predict", response_model=PredictionResponse)
def predict(data: StudentData):
    model = app.state.model
    if model is None:
        raise HTTPException(status_code=503, detail="The model is not loaded on the server.")

    country_group = _COUNTRY_LOOKUP.get(data.Country.strip().lower(), "Other")

    # Mental_Health_Score is the target, so it is NOT an input.
    # The model was trained on 'Grouped_Countries', not the raw 'Country'.
    row = {
        "Study_Hours": data.Study_Hours,
        "Age": data.Age,
        "Avg_Daily_Usage_Hours": data.Avg_Daily_Usage_Hours,
        "Daily_Unlocks": data.Daily_Unlocks,
        "Physical_Activity_Hours": data.Physical_Activity_Hours,
        "Sleep_Hours_Per_Night": data.Sleep_Hours_Per_Night,
        "Stress_Level": data.Stress_Level,
        "Gender": data.Gender,
        "Academic_Level": data.Academic_Level,
        "Most_Used_Platform": data.Most_Used_Platform,
        "Purpose_Of_Use": data.Purpose_Of_Use,
        "Grouped_Countries": country_group,
    }
    input_df = pd.DataFrame([row])
    expected = getattr(model, "feature_names_in_", None)
    if expected is not None:
        input_df = input_df[list(expected)]

    try:
        prediction = float(model.predict(input_df)[0])
    except Exception:
        logger.exception("Prediction failed")
        raise HTTPException(status_code=500, detail="The model could not produce a prediction.")

    return PredictionResponse(
        predicted_mental_health_score=round(prediction, 2),
        country_group=country_group,
    )


# Serve the frontend from its own folder (never the project root, so Model.pkl
# is not downloadable). Mounted last so /api/* routes take priority.
if FRONTEND_DIR.is_dir():
    app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")
else:
    logger.warning("No 'frontend' folder at %s; serving the API only.", FRONTEND_DIR)
