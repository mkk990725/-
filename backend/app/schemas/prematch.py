from pydantic import BaseModel, Field

from backend.app.schemas.match import Match


class PrematchSourceItem(BaseModel):
    name: str
    tier: str
    status: str
    url: str | None = None
    note: str


class PrematchUpdateRequest(BaseModel):
    match: Match
    manual: bool = False


class PrematchUpdateResult(BaseModel):
    changed: bool
    summary: str
    checked_at: str
    items: list[PrematchSourceItem] = Field(default_factory=list)

