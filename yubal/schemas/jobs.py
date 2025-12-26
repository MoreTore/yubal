"""Job API schemas."""

from datetime import datetime
from typing import Any

from pydantic import BaseModel

from yubal.core.models import AlbumInfo


class CreateJobRequest(BaseModel):
    """Request to create a new sync job."""

    url: str
    audio_format: str = "mp3"


class LogEntrySchema(BaseModel):
    """A log entry for a job."""

    timestamp: datetime
    step: str
    message: str
    progress: float | None = None
    details: dict[str, Any] | None = None


class JobResponse(BaseModel):
    """Response schema for a job."""

    id: str
    url: str
    audio_format: str
    status: (
        str  # "pending", "fetching_info", "downloading", "importing", "completed", etc.
    )
    progress: float
    message: str
    album_info: AlbumInfo | None = None
    current_track: int | None = None  # 1-based track number being processed
    total_tracks: int | None = None  # Total tracks in album
    logs: list[LogEntrySchema] = []
    error: str | None = None
    created_at: datetime
    started_at: datetime | None = None
    completed_at: datetime | None = None


class JobListResponse(BaseModel):
    """Response for listing jobs."""

    jobs: list[JobResponse]
    active_job_id: str | None = None


class JobCreatedResponse(BaseModel):
    """Response when a job is created."""

    id: str
    message: str = "Job created"


class JobConflictError(BaseModel):
    """Error response when job creation is rejected."""

    error: str = "A job is already running"
    active_job_id: str | None = None


class ClearJobsResponse(BaseModel):
    """Response when jobs are cleared."""

    cleared: int


class CancelJobResponse(BaseModel):
    """Response when a job is cancelled."""

    message: str = "Job cancelled"
