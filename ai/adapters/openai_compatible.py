from time import perf_counter
from typing import Any

import httpx

from ai.adapters.base import LlmAdapter


class OpenAiCompatibleAdapter(LlmAdapter):
    def endpoint(self) -> str:
        raw = str(self.config.api_url).rstrip("/")
        if raw.endswith("/chat/completions"):
            return raw
        if raw.endswith("/v1"):
            return f"{raw}/chat/completions"
        return f"{raw}/chat/completions"

    def request_body(self, messages: list[dict[str, str]]) -> dict[str, Any]:
        return {
            "model": self.config.model,
            "messages": messages,
            "temperature": self.config.temperature,
        }

    async def chat(self, messages: list[dict[str, str]]) -> dict[str, Any]:
        started = perf_counter()
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(
                self.endpoint(),
                headers={"Authorization": f"Bearer {self.config.api_key.get_secret_value()}"},
                json=self.request_body(messages),
            )
            response.raise_for_status()
            payload = response.json()
        payload["elapsed_ms"] = int((perf_counter() - started) * 1000)
        return payload

