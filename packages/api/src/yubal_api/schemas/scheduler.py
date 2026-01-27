"""Scheduler status schemas."""

from datetime import datetime

from pydantic import BaseModel


class SubscriptionCounts(BaseModel):
    """Subscription count statistics."""

    total: int
    enabled: int


class SchedulerStatus(BaseModel):
    """Scheduler status response."""

    running: bool
    enabled: bool
    interval_minutes: int
    next_run_at: datetime | None
    subscription_counts: SubscriptionCounts
