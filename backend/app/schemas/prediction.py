from pydantic import BaseModel, Field

from backend.app.schemas.match import Match


class PredictionScores(BaseModel):
    source_score: int = Field(ge=0, le=100)
    analysis_score: int = Field(ge=0, le=100)
    winner_confidence: int = Field(ge=0, le=100)
    goals_confidence: int = Field(ge=0, le=100)
    score_confidence: int = Field(ge=0, le=100)
    half_full_confidence: int = Field(ge=0, le=100)


class PredictionRequest(BaseModel):
    match: Match
    model_config_name: str | None = None
    force_refresh: bool = False


class PredictionResult(BaseModel):
    match_id: str
    winner: str
    total_goals: str
    half_full: str
    score_pick: str
    first_half_summary: str
    full_time_summary: str
    scores: PredictionScores
    report: str
    generated_at: str

