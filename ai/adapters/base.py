from abc import ABC, abstractmethod
from typing import Any

from backend.app.schemas.model_config import ModelConfig


class LlmAdapter(ABC):
    def __init__(self, config: ModelConfig) -> None:
        self.config = config

    @abstractmethod
    async def chat(self, messages: list[dict[str, str]]) -> dict[str, Any]:
        raise NotImplementedError

    async def test_connection(self) -> dict[str, Any]:
        payload = await self.chat(
            [
                {"role": "system", "content": "You are a connection test assistant."},
                {"role": "user", "content": "Reply with pong."},
            ]
        )
        return {
            "ok": True,
            "provider": self.config.provider,
            "model": self.config.model,
            "endpoint": str(self.config.api_url),
            "elapsed_ms": int(payload.get("elapsed_ms", 0)),
            "message": "模型已响应",
        }

