from datetime import datetime, timezone

from ai.report_generator import build_prediction_report
from backend.app.repositories.sqlite import SqliteRepository
from backend.app.schemas.prediction import PredictionRequest, PredictionResult
from engine.confidence import calculate_prediction_scores


class PredictionService:
    def __init__(self, repo: SqliteRepository) -> None:
        self.repo = repo

    async def run(self, request: PredictionRequest) -> PredictionResult:
        scores = calculate_prediction_scores(request.match)
        result = PredictionResult(
            match_id=request.match.id,
            winner="待模型解释",
            total_goals="待模型解释",
            half_full="待模型解释",
            score_pick="待模型解释",
            first_half_summary="数学引擎已完成信心度计算，等待 AI 层生成中文解释。",
            full_time_summary="数学引擎已完成基础评分，后续接入统计特征和机器学习修正。",
            scores=scores,
            report=build_prediction_report(request.match, scores),
            generated_at=datetime.now(timezone.utc).isoformat(),
        )
        self.repo.save_prediction(result)
        return result

