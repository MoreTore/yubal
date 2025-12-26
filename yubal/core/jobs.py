"""Background job system for sync operations."""

import asyncio
import uuid
from collections import OrderedDict
from dataclasses import dataclass, field
from datetime import UTC, datetime
from enum import Enum
from typing import Any

from yubal.core.models import AlbumInfo


class JobPhase(str, Enum):
    """Phase of a background job."""

    PENDING = "pending"  # Job created, not started
    FETCHING_INFO = "fetching_info"  # Extracting album metadata
    DOWNLOADING = "downloading"  # Downloading tracks (0-80%)
    IMPORTING = "importing"  # Beets import (80-100%)
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


# Alias for backward compatibility
JobStatus = JobPhase


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
    phase: JobPhase = JobPhase.PENDING
    progress: float = 0.0
    message: str = ""
    album_info: AlbumInfo | None = None
    current_track: int | None = None  # 1-based track number being processed
    total_tracks: int | None = None  # Total tracks in album
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
        self._cancellation_requested: set[str] = set()

    async def create_job(self, url: str, audio_format: str = "mp3") -> Job | None:
        """
        Create a new job.

        Returns None if a job is already running (caller should return 409).
        """
        async with self._lock:
            # Check if there's an active job
            if self._active_job_id is not None:
                active = self._jobs.get(self._active_job_id)
                if active and active.phase not in (
                    JobPhase.COMPLETED,
                    JobPhase.FAILED,
                    JobPhase.CANCELLED,
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

    async def cancel_job(self, job_id: str) -> bool:
        """
        Cancel a running job.

        Returns False if job doesn't exist or is already finished.
        """
        async with self._lock:
            job = self._jobs.get(job_id)
            if not job:
                return False

            # Cannot cancel already finished jobs
            if job.phase in (
                JobPhase.COMPLETED,
                JobPhase.FAILED,
                JobPhase.CANCELLED,
            ):
                return False

            # Mark as cancelled
            self._cancellation_requested.add(job_id)
            job.phase = JobPhase.CANCELLED
            job.message = "Job cancelled by user"
            job.completed_at = datetime.now(UTC)

            # Clear active job if it matches
            if self._active_job_id == job_id:
                self._active_job_id = None

            return True

    def is_cancelled(self, job_id: str) -> bool:
        """Check if cancellation was requested for a job."""
        return job_id in self._cancellation_requested

    async def update_job(
        self,
        job_id: str,
        phase: JobPhase | None = None,
        progress: float | None = None,
        message: str | None = None,
        album_info: AlbumInfo | None = None,
        current_track: int | None = None,
        total_tracks: int | None = None,
        error: str | None = None,
        started_at: datetime | None = None,
        completed_at: datetime | None = None,
    ) -> Job | None:
        """Update job fields. Cancelled jobs cannot be updated."""
        async with self._lock:
            job = self._jobs.get(job_id)
            if not job:
                return None

            # Don't update cancelled jobs (prevents race conditions)
            if job.phase == JobPhase.CANCELLED:
                return job

            if phase is not None:
                job.phase = phase
            if progress is not None:
                job.progress = progress
            if message is not None:
                job.message = message
            if album_info is not None:
                job.album_info = album_info
            if current_track is not None:
                job.current_track = current_track
            if total_tracks is not None:
                job.total_tracks = total_tracks
            if error is not None:
                job.error = error
            if started_at is not None:
                job.started_at = started_at
            if completed_at is not None:
                job.completed_at = completed_at

            # Clear active job if completed, failed, or cancelled
            if job.phase in (
                JobPhase.COMPLETED,
                JobPhase.FAILED,
                JobPhase.CANCELLED,
            ):
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

            # Don't add logs to cancelled jobs (prevents stale updates)
            if job.phase == JobPhase.CANCELLED:
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

            if job.phase not in (
                JobPhase.COMPLETED,
                JobPhase.FAILED,
                JobPhase.CANCELLED,
            ):
                return False  # Cannot delete running job

            del self._jobs[job_id]
            # Also remove from cancellation set if present
            self._cancellation_requested.discard(job_id)
            return True

    async def clear_completed(self) -> int:
        """
        Clear all completed/failed/cancelled jobs.

        Returns the number of jobs removed.
        """
        async with self._lock:
            to_remove = [
                job_id
                for job_id, job in self._jobs.items()
                if job.phase
                in (JobPhase.COMPLETED, JobPhase.FAILED, JobPhase.CANCELLED)
            ]
            for job_id in to_remove:
                del self._jobs[job_id]
                self._cancellation_requested.discard(job_id)
            return len(to_remove)

    def _check_timeout(self, job: Job) -> bool:
        """
        Check if job has timed out. Must be called with lock held.

        Returns True if job was timed out.
        """
        if job.started_at and job.phase not in (
            JobPhase.COMPLETED,
            JobPhase.FAILED,
            JobPhase.CANCELLED,
        ):
            elapsed = datetime.now(UTC) - job.started_at
            if elapsed.total_seconds() > self.TIMEOUT_SECONDS:
                job.phase = JobPhase.FAILED
                job.error = "Job timed out after 30 minutes"
                job.completed_at = datetime.now(UTC)
                if self._active_job_id == job.id:
                    self._active_job_id = None
                return True
        return False


# Global singleton instance
job_store = JobStore()
