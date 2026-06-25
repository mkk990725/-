from backend.app.schemas.match import Match


def match_basic_features(match: Match) -> dict[str, float]:
    return {
        "has_venue": 1.0 if match.venue else 0.0,
        "has_kickoff_time": 1.0 if match.kickoff_time else 0.0,
        "is_neutral_unknown": 1.0,
    }

