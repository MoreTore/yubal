"""Event bus for job state changes."""

from __future__ import annotations

import asyncio
import json
import threading
from contextlib import asynccontextmanager
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from collections.abc import AsyncIterator

    from yubal_api.domain.job import Job


class JobEventBus:
    """Event bus for job state changes.

    This bus emits events to async SSE subscribers. The emit() method is always
    called from the event loop thread - either directly from async code or via
    call_soon_threadsafe from worker threads (see JobExecutor._on_progress).

    Backpressure is handled by drop-oldest: if a subscriber's queue is full,
    the oldest event is dropped to make room for the new one.
    """

    SUBSCRIBER_QUEUE_SIZE = 100

    def __init__(self) -> None:
        self._subscribers: list[asyncio.Queue[str]] = []
        self._lock = threading.Lock()

    @asynccontextmanager
    async def subscribe(self) -> AsyncIterator[asyncio.Queue[str]]:
        """Subscribe to job events via context manager."""
        queue: asyncio.Queue[str] = asyncio.Queue(maxsize=self.SUBSCRIBER_QUEUE_SIZE)
        with self._lock:
            self._subscribers.append(queue)
        try:
            yield queue
        finally:
            with self._lock:
                self._subscribers.remove(queue)

    def emit(self, event: dict[str, Any]) -> None:
        """Emit event to all subscribers.

        Note: This method is always called from the event loop thread
        (either from async code or via call_soon_threadsafe from worker threads).
        """
        data = json.dumps(event)
        with self._lock:
            for queue in list(self._subscribers):
                self._safe_put(queue, data)

    def _safe_put(self, queue: asyncio.Queue[str], data: str) -> None:
        """Put data with drop-oldest backpressure."""
        try:
            queue.put_nowait(data)
        except asyncio.QueueFull:
            try:
                queue.get_nowait()  # Drop oldest
                queue.put_nowait(data)
            except asyncio.QueueEmpty:
                pass  # Race condition

    def emit_created(self, job: Job) -> None:
        """Emit job created event."""
        self.emit({"type": "created", "job": job.model_dump(mode="json")})

    def emit_updated(self, job: Job) -> None:
        """Emit job updated event."""
        self.emit({"type": "updated", "job": job.model_dump(mode="json")})

    def emit_deleted(self, job_id: str) -> None:
        """Emit job deleted event."""
        self.emit({"type": "deleted", "jobId": job_id})

    def emit_cleared(self, count: int) -> None:
        """Emit jobs cleared event."""
        self.emit({"type": "cleared", "count": count})


# Singleton instance
_job_event_bus: JobEventBus | None = None


def get_job_event_bus() -> JobEventBus:
    """Get the singleton JobEventBus instance."""
    global _job_event_bus
    if _job_event_bus is None:
        _job_event_bus = JobEventBus()
    return _job_event_bus
