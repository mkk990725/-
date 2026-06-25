from typing import Any


def create_scheduler() -> Any:
    from apscheduler.schedulers.asyncio import AsyncIOScheduler

    scheduler = AsyncIOScheduler(timezone="Asia/Shanghai")
    return scheduler
