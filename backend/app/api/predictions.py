from fastapi import APIRouter, Depends

from backend.app.repositories.sqlite import SqliteRepository, get_repository
from backend.app.schemas.prediction import PredictionRequest, PredictionResult
from backend.app.services.prediction_service import PredictionService

router = APIRouter()


@router.get("/predictions/{match_id}", response_model=PredictionResult | None)
def get_prediction(
    match_id: str,
    repo: SqliteRepository = Depends(get_repository),
) -> PredictionResult | None:
    return repo.get_prediction(match_id)


@router.post("/predictions/run", response_model=PredictionResult)
async def run_prediction(
    request: PredictionRequest,
    repo: SqliteRepository = Depends(get_repository),
) -> PredictionResult:
    service = PredictionService(repo)
    return await service.run(request)

