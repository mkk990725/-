from fastapi import APIRouter, Depends

from ai.adapters.factory import create_llm_adapter
from backend.app.repositories.sqlite import SqliteRepository, get_repository
from backend.app.schemas.model_config import ModelConfig, ModelTestResult

router = APIRouter()


@router.get("/model-configs", response_model=list[ModelConfig])
def list_model_configs(repo: SqliteRepository = Depends(get_repository)) -> list[ModelConfig]:
    return repo.list_model_configs()


@router.post("/model-configs", response_model=ModelConfig)
def save_model_config(
    config: ModelConfig,
    repo: SqliteRepository = Depends(get_repository),
) -> ModelConfig:
    repo.upsert_model_config(config)
    return config


@router.post("/model-configs/test", response_model=ModelTestResult)
async def test_model_config(config: ModelConfig) -> ModelTestResult:
    adapter = create_llm_adapter(config)
    result = await adapter.test_connection()
    return ModelTestResult(**result)

