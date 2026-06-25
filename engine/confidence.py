from backend.app.schemas.match import Match
from backend.app.schemas.prediction import PredictionScores
from engine.source_score import SourceInputs, calculate_source_score


def calculate_prediction_scores(match: Match) -> PredictionScores:
    source_score = calculate_source_score(
        SourceInputs(
            official_items=1 if match.id else 0,
            structured_items=1 if match.date and match.home and match.away else 0,
            media_items=0,
            missing_critical_items=3,
        )
    )
    analysis_score = max(0, min(100, source_score + 10 if match.kickoff_time else source_score))
    base = max(0, min(100, round(analysis_score * 0.65)))
    return PredictionScores(
        source_score=source_score,
        analysis_score=analysis_score,
        winner_confidence=base,
        goals_confidence=max(0, base - 8),
        score_confidence=max(0, base - 28),
        half_full_confidence=max(0, base - 14),
    )

