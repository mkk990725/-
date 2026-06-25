from engine.source_score import SourceInputs, calculate_source_score


def test_source_score_penalizes_missing_critical_items() -> None:
    strong = calculate_source_score(SourceInputs(official_items=3, structured_items=3, media_items=2))
    weak = calculate_source_score(SourceInputs(official_items=1, structured_items=1, missing_critical_items=4))
    assert strong > weak
    assert 0 <= weak <= 100

