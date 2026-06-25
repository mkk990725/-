from backend.app.schemas.match import Match
from engine.confidence import calculate_prediction_scores


def test_confidence_outputs_all_fixed_slots() -> None:
    match = Match(id="m1", date="2026-06-25", home="A", away="B", kickoff_time="09:00")
    scores = calculate_prediction_scores(match)
    assert scores.winner_confidence >= scores.score_confidence
    assert 0 <= scores.half_full_confidence <= 100

