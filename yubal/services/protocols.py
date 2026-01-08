"""Service protocols for dependency injection."""

from datetime import datetime
from typing import Protocol

from yubal.core.enums import JobStatus
from yubal.core.models import AlbumInfo, Job


class JobExecutionStore(Protocol):
    """Narrow interface for job execution operations.

    This protocol defines the minimal interface that JobExecutor needs,
    following the Interface Segregation Principle.
    """

    async def transition_job(
        self,
        job_id: str,
        status: JobStatus,
        message: str,
        progress: float | None = None,
        album_info: AlbumInfo | None = None,
        started_at: datetime | None = None,
    ) -> Job | None:
        """Atomically update job status and add log entry."""
        ...

    async def pop_next_pending(self) -> Job | None:
        """Get and activate the next pending job."""
        ...
