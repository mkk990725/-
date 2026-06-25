from fastapi import APIRouter, Depends

from backend.app.repositories.sqlite import SqliteRepository, get_repository
from backend.app.schemas.team import TeamProfile

router = APIRouter()


@router.get("/teams/{team_id}", response_model=TeamProfile | None)
def get_team(
    team_id: str,
    repo: SqliteRepository = Depends(get_repository),
) -> TeamProfile | None:
    return repo.get_team(team_id)

