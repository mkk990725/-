from pydantic import BaseModel, Field


class Match(BaseModel):
    id: str
    date: str
    home: str
    away: str
    competition: str = "FIFA World Cup"
    competition_type: str = "world_cup"
    season: str | None = None
    group: str | None = None
    venue: str | None = None
    kickoff_time: str | None = None
    status: str = "scheduled"
    score: str | None = None


class MatchListResponse(BaseModel):
    matches: list[Match] = Field(default_factory=list)

