"""Background job system for sync operations."""

import asyncio
import uuid
from collections import OrderedDict
from dataclasses import dataclass, field
from datetime import UTC, datetime
from enum import Enum
from typing import Any

from yubal.core.models import AlbumInfo


class JobStatus(str, Enum):
    """Status of a background job."""

    PENDING = "pending"
    DOWNLOADING = "downloading"
    TAGGING = "tagging"
    COMPLETE = "complete"
    FAILED = "failed"


@dataclass
class LogEntry:
    """A log entry for a job."""

    timestamp: datetime
    step: str
    message: str
    progress: float | None = None
    details: dict[str, Any] | None = None


@dataclass
class Job:
    """A background sync job."""

    id: str
    url: str
    audio_format: str = "mp3"
    status: JobStatus = JobStatus.PENDING
    progress: float = 0.0
    message: str = ""
    album_info: AlbumInfo | None = None
    logs: list[LogEntry] = field(default_factory=list)
    error: str | None = None
    created_at: datetime = field(default_factory=lambda: datetime.now(UTC))
    started_at: datetime | None = None
    completed_at: datetime | None = None


class JobStore:
    """Thread-safe in-memory job store with capacity limit."""

    MAX_JOBS = 50
    MAX_LOGS = 100
    TIMEOUT_SECONDS = 30 * 60  # 30 minutes

    def __init__(self) -> None:
        self._jobs: OrderedDict[str, Job] = OrderedDict()
        self._lock = asyncio.Lock()
        self._active_job_id: str | None = None

    async def create_job(self, url: str, audio_format: str = "mp3") -> Job | None:
        """
        Create a new job.

        Returns None if a job is already running (caller should return 409).
        """
        async with self._lock:
            # Check if there's an active job
            if self._active_job_id is not None:
                active = self._jobs.get(self._active_job_id)
                if active and active.status not in (
                    JobStatus.COMPLETE,
                    JobStatus.FAILED,
                ):
                    return None  # Job already running

            # Prune old jobs if at capacity
            while len(self._jobs) >= self.MAX_JOBS:
                # Remove oldest job (first item in OrderedDict)
                oldest_id = next(iter(self._jobs))
                del self._jobs[oldest_id]

            # Create new job
            job = Job(
                id=str(uuid.uuid4()),
                url=url,
                audio_format=audio_format,
            )
            self._jobs[job.id] = job
            self._active_job_id = job.id

            return job

    async def get_job(self, job_id: str) -> Job | None:
        """Get a job by ID. Also checks for timeout."""
        async with self._lock:
            job = self._jobs.get(job_id)
            if job:
                self._check_timeout(job)
            return job

    async def get_all_jobs(self) -> list[Job]:
        """Get all jobs, most recent first."""
        async with self._lock:
            # Check timeouts on all active jobs
            for job in self._jobs.values():
                self._check_timeout(job)
            return list(reversed(self._jobs.values()))

    async def get_active_job(self) -> Job | None:
        """Get the currently active job, if any."""
        async with self._lock:
            if self._active_job_id:
                job = self._jobs.get(self._active_job_id)
                if job:
                    self._check_timeout(job)
                return job
            return None

    async def update_job(
        self,
        job_id: str,
        status: JobStatus | None = None,
        progress: float | None = None,
        message: str | None = None,
        album_info: AlbumInfo | None = None,
        error: str | None = None,
        started_at: datetime | None = None,
        completed_at: datetime | None = None,
    ) -> Job | None:
        """Update job fields."""
        async with self._lock:
            job = self._jobs.get(job_id)
            if not job:
                return None

            if status is not None:
                job.status = status
            if progress is not None:
                job.progress = progress
            if message is not None:
                job.message = message
            if album_info is not None:
                job.album_info = album_info
            if error is not None:
                job.error = error
            if started_at is not None:
                job.started_at = started_at
            if completed_at is not None:
                job.completed_at = completed_at

            # Clear active job if completed or failed
            if job.status in (JobStatus.COMPLETE, JobStatus.FAILED):
                job.completed_at = job.completed_at or datetime.now(UTC)
                if self._active_job_id == job_id:
                    self._active_job_id = None

            return job

    async def add_log(
        self,
        job_id: str,
        step: str,
        message: str,
        progress: float | None = None,
        details: dict[str, Any] | None = None,
    ) -> None:
        """Add a log entry to a job. Trims to MAX_LOGS if exceeded."""
        async with self._lock:
            job = self._jobs.get(job_id)
            if not job:
                return

            entry = LogEntry(
                timestamp=datetime.now(UTC),
                step=step,
                message=message,
                progress=progress,
                details=details,
            )
            job.logs.append(entry)

            # Trim logs if exceeded
            if len(job.logs) > self.MAX_LOGS:
                job.logs = job.logs[-self.MAX_LOGS :]

    async def delete_job(self, job_id: str) -> bool:
        """
        Delete a job.

        Returns False if job doesn't exist or is still running.
        """
        async with self._lock:
            job = self._jobs.get(job_id)
            if not job:
                return False

            if job.status not in (JobStatus.COMPLETE, JobStatus.FAILED):
                return False  # Cannot delete running job

            del self._jobs[job_id]
            return True

    async def clear_completed(self) -> int:
        """
        Clear all completed/failed jobs.

        Returns the number of jobs removed.
        """
        async with self._lock:
            to_remove = [
                job_id
                for job_id, job in self._jobs.items()
                if job.status in (JobStatus.COMPLETE, JobStatus.FAILED)
            ]
            for job_id in to_remove:
                del self._jobs[job_id]
            return len(to_remove)

    def _check_timeout(self, job: Job) -> bool:
        """
        Check if job has timed out. Must be called with lock held.

        Returns True if job was timed out.
        """
        if job.started_at and job.status not in (JobStatus.COMPLETE, JobStatus.FAILED):
            elapsed = datetime.now(UTC) - job.started_at
            if elapsed.total_seconds() > self.TIMEOUT_SECONDS:
                job.status = JobStatus.FAILED
                job.error = "Job timed out after 30 minutes"
                job.completed_at = datetime.now(UTC)
                if self._active_job_id == job.id:
                    self._active_job_id = None
                return True
        return False


# Global singleton instance
job_store = JobStore()
