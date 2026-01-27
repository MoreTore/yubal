"""Scheduler status endpoint."""

from typing import Annotated

from fastapi import APIRouter, Depends
from starlette.requests import Request

from yubal_api.db.repository import SubscriptionRepository
from yubal_api.schemas.scheduler import SchedulerStatus, SubscriptionCounts
from yubal_api.services.scheduler import Scheduler

router = APIRouter(prefix="/scheduler", tags=["scheduler"])


def get_repository(request: Request) -> SubscriptionRepository:
    """Get subscription repository from app state."""
    return request.app.state.services.repository


def get_scheduler(request: Request) -> Scheduler:
    """Get scheduler from app state."""
    return request.app.state.services.scheduler


RepositoryDep = Annotated[SubscriptionRepository, Depends(get_repository)]
SchedulerDep = Annotated[Scheduler, Depends(get_scheduler)]


@router.get("", response_model=SchedulerStatus)
def get_scheduler_status(
    repository: RepositoryDep,
    scheduler: SchedulerDep,
) -> SchedulerStatus:
    """Get scheduler status (read-only)."""
    return SchedulerStatus(
        running=scheduler.is_running,
        enabled=scheduler.enabled,
        interval_minutes=scheduler.interval_minutes,
        next_run_at=scheduler.next_run_at,
        subscription_counts=SubscriptionCounts(
            total=repository.count(),
            enabled=repository.count(enabled=True),
        ),
    )
