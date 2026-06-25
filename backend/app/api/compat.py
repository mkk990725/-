from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import SecretStr

from ai.adapters.factory import create_llm_adapter
from backend.app.repositories.sqlite import SqliteRepository, get_repository
from backend.app.schemas.match import Match
from backend.app.schemas.model_config import ModelConfig
from backend.app.schemas.prediction import PredictionRequest
from backend.app.schemas.prematch import PrematchUpdateRequest
from backend.app.services.prediction_service import PredictionService
from backend.app.services.prematch_service import PrematchService

router = APIRouter()
ROOT = Path(__file__).resolve().parents[3]
MODEL_CONFIG_FILE = ROOT / "model-config.json"
MODEL_CONFIG_EXAMPLE = ROOT / "model-config.example.json"


def _read_json_file(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {}
    return json.loads(path.read_text(encoding="utf-8"))


def read_legacy_model_config() -> dict[str, Any]:
    if MODEL_CONFIG_FILE.exists():
        return _read_json_file(MODEL_CONFIG_FILE)
    return _read_json_file(MODEL_CONFIG_EXAMPLE)


def write_legacy_model_config(payload: dict[str, Any]) -> dict[str, Any]:
    MODEL_CONFIG_FILE.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    return payload


def legacy_model_to_schema(payload: dict[str, Any]) -> ModelConfig:
    model = payload.get("model", payload)
    api_url = model.get("apiUrl") or model.get("api_url")
    api_key = model.get("apiKey") or model.get("api_key")
    model_name = model.get("model")
    if not api_url or not api_key or not model_name:
        raise HTTPException(status_code=400, detail="缺少 API URL / API Key / 模型名")
    provider = model.get("provider") or "openai-compatible"
    if "deepseek" in str(api_url).lower() or "deepseek" in str(model_name).lower():
        provider = "deepseek"
    elif "dmx" in str(api_url).lower():
        provider = "dmxapi"
    return ModelConfig(
        name=model.get("profileName") or model_name,
        provider=provider,
        api_url=api_url,
        api_key=SecretStr(api_key),
        model=model_name,
        temperature=float(model.get("temperature", 0.2)),
        reasoning_effort=model.get("reasoningEffort") or "high",
        extra_body=model.get("extraBody") or {},
    )


def match_from_legacy(payload: dict[str, Any]) -> Match:
    return Match(
        id=str(payload.get("id") or payload.get("matchId") or ""),
        date=str(payload.get("date") or ""),
        home=str(payload.get("home") or ""),
        away=str(payload.get("away") or ""),
        competition=str(payload.get("competition") or "FIFA World Cup"),
        competition_type=str(payload.get("competition_type") or payload.get("competitionType") or "world_cup"),
        season=payload.get("season"),
        group=payload.get("group"),
        venue=payload.get("venue"),
        kickoff_time=payload.get("kickoffTime") or payload.get("kickoff_time"),
        status=str(payload.get("status") or "scheduled"),
        score=payload.get("score"),
    )


@router.get("/predictions")
def list_predictions(repo: SqliteRepository = Depends(get_repository)) -> dict[str, Any]:
    return {key: value.model_dump(mode="json") for key, value in repo.list_predictions().items()}


@router.post("/prematch-update")
async def prematch_update_legacy(payload: dict[str, Any]) -> dict[str, Any]:
    match = match_from_legacy(payload.get("match", payload))
    result = await PrematchService().update(PrematchUpdateRequest(match=match, manual=True))
    data = result.model_dump(mode="json")
    data["checkedAt"] = data.pop("checked_at")
    return data


@router.get("/model-config")
def get_model_config_legacy() -> dict[str, Any]:
    return read_legacy_model_config()


@router.post("/model-config")
def save_model_config_legacy(payload: dict[str, Any]) -> dict[str, Any]:
    return write_legacy_model_config(payload)


@router.post("/test-model")
async def test_model_legacy(payload: dict[str, Any]) -> dict[str, Any]:
    config = legacy_model_to_schema(payload.get("config") or read_legacy_model_config())
    result = await create_llm_adapter(config).test_connection()
    return {
        "ok": result["ok"],
        "provider": result["provider"],
        "model": result["model"],
        "endpoint": result["endpoint"],
        "elapsedMs": result["elapsed_ms"],
        "responsePreview": result["message"],
    }


@router.post("/predict")
async def predict_legacy(
    payload: dict[str, Any],
    repo: SqliteRepository = Depends(get_repository),
) -> dict[str, Any]:
    match = match_from_legacy(payload.get("match", payload))
    result = await PredictionService(repo).run(PredictionRequest(match=match))
    return {"ok": True, "mode": "math-engine", "saved": result.model_dump(mode="json")}

