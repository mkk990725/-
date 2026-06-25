from fastapi import APIRouter, Depends

from backend.app.repositories.sqlite import SqliteRepository, get_repository
from backend.app.schemas.match import MatchListResponse

router = APIRouter()


@router.get("/matches", response_model=MatchListResponse)
def list_matches(
    start: str | None = None,
    end: str | None = None,
    repo: SqliteRepository = Depends(get_repository),
) -> MatchListResponse:
    return MatchListResponse(matches=repo.list_matches(start=start, end=end))

