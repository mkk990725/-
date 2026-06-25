from dataclasses import dataclass


@dataclass(frozen=True)
class SourceInputs:
    official_items: int = 0
    structured_items: int = 0
    media_items: int = 0
    missing_critical_items: int = 0


def calculate_source_score(inputs: SourceInputs) -> int:
    score = 0
    score += min(inputs.official_items, 4) * 18
    score += min(inputs.structured_items, 4) * 10
    score += min(inputs.media_items, 3) * 6
    score -= min(inputs.missing_critical_items, 5) * 12
    return max(0, min(100, round(score)))

