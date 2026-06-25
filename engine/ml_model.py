from dataclasses import dataclass


@dataclass
class ProbabilityCorrection:
    winner_delta: float = 0.0
    goals_delta: float = 0.0
    half_full_delta: float = 0.0


class BaselineMlModel:
    def predict_correction(self, features: dict[str, float]) -> ProbabilityCorrection:
        # Placeholder for scikit-learn model integration. Deterministic no-op for MVP.
        return ProbabilityCorrection()

