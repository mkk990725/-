from datetime import datetime, timezone

from backend.app.schemas.prematch import PrematchSourceItem, PrematchUpdateRequest, PrematchUpdateResult


class PrematchService:
    async def update(self, request: PrematchUpdateRequest) -> PrematchUpdateResult:
        match = request.match
        return PrematchUpdateResult(
            changed=False,
            summary=f"{match.home} vs {match.away}：FastAPI 赛前信息服务已接通，数据源抓取将在下一阶段迁移。",
            checked_at=datetime.now(timezone.utc).isoformat(),
            items=[
                PrematchSourceItem(
                    name="FIFA Match Centre",
                    tier="official_fact",
                    status="manual",
                    url="https://www.fifa.com/en/match-centre",
                    note="已预留官方入口，下一阶段接入抓取和关键词命中检查。",
                )
            ],
        )

