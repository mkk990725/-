from typing import Any, Literal

from pydantic import BaseModel, Field, HttpUrl, SecretStr


Provider = Literal["deepseek", "dmxapi", "openai-compatible"]


class ModelConfig(BaseModel):
    name: str
    provider: Provider = "openai-compatible"
    api_url: HttpUrl
    api_key: SecretStr
    model: str
    temperature: float = Field(default=0.2, ge=0, le=2)
    reasoning_effort: str | None = "high"
    extra_body: dict[str, Any] = Field(default_factory=dict)


class ModelTestResult(BaseModel):
    ok: bool
    provider: str
    model: str
    endpoint: str
    elapsed_ms: int
    message: str

