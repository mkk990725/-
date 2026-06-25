from typing import Any

from ai.adapters.openai_compatible import OpenAiCompatibleAdapter


class DeepSeekAdapter(OpenAiCompatibleAdapter):
    def request_body(self, messages: list[dict[str, str]]) -> dict[str, Any]:
        body = super().request_body(messages)
        body["reasoning_effort"] = self.config.reasoning_effort or "high"
        body["extra_body"] = self.config.extra_body or {"thinking": {"type": "enabled"}}
        return body

