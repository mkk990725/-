from ai.adapters.base import LlmAdapter
from ai.adapters.deepseek import DeepSeekAdapter
from ai.adapters.dmxapi import DmxApiAdapter
from ai.adapters.openai_compatible import OpenAiCompatibleAdapter
from backend.app.schemas.model_config import ModelConfig


def create_llm_adapter(config: ModelConfig) -> LlmAdapter:
    if config.provider == "deepseek":
        return DeepSeekAdapter(config)
    if config.provider == "dmxapi":
        return DmxApiAdapter(config)
    return OpenAiCompatibleAdapter(config)

