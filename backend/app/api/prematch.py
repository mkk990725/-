from fastapi import APIRouter

from backend.app.schemas.prematch import PrematchUpdateRequest, PrematchUpdateResult
from backend.app.services.prematch_service import PrematchService

router = APIRouter()


@router.post("/prematch/update", response_model=PrematchUpdateResult)
async def update_prematch(request: PrematchUpdateRequest) -> PrematchUpdateResult:
    return await PrematchService().update(request)

