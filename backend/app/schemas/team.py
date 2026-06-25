from pydantic import BaseModel, Field


class CoachProfile(BaseModel):
    name: str | None = None
    tenure: str | None = None
    tactical_style: str | None = None
    adjustment_notes: list[str] = Field(default_factory=list)


class PlayerProfile(BaseModel):
    name: str
    name_zh: str | None = None
    position: str | None = None
    age: int | None = None
    height_cm: int | None = None
    club: str | None = None
    market_value: str | None = None


class TeamProfile(BaseModel):
    id: str
    name: str
    name_zh: str | None = None
    coach: CoachProfile = Field(default_factory=CoachProfile)
    tactical_summary: str | None = None
    players: list[PlayerProfile] = Field(default_factory=list)

