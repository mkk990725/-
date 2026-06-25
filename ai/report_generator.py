from backend.app.schemas.match import Match
from backend.app.schemas.prediction import PredictionScores


def build_prediction_report(match: Match, scores: PredictionScores) -> str:
    return (
        f"{match.home} vs {match.away} 的数学评分已生成："
        f"数据充足度 {scores.source_score}，可分析度 {scores.analysis_score}。"
        "当前阶段尚未让大模型生成正式中文报告。"
    )

