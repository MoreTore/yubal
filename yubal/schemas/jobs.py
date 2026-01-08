"""Job API schemas."""

from typing import Literal

from pydantic import BaseModel

from yubal.core.models import Job, LogEntry
from yubal.core.types import AudioFormat


class CreateJobRequest(BaseModel):
    """Request to create a new sync job."""

    url: str
    audio_format: AudioFormat | None = None  # None = use server default


class JobListResponse(BaseModel):
    """Response for listing jobs."""

    jobs: list[Job]
    logs: list[LogEntry] = []


class JobCreatedResponse(BaseModel):
    """Response when a job is created."""

    id: str
    message: Literal["Job created"] = "Job created"


class JobConflictError(BaseModel):
    """Error response when job creation is rejected."""

    error: Literal["A job is already running", "Queue is full"]
    active_job_id: str | None = None


class ClearJobsResponse(BaseModel):
    """Response when jobs are cleared."""

    cleared: int


class CancelJobResponse(BaseModel):
    """Response when a job is cancelled."""

    message: Literal["Job cancelled"] = "Job cancelled"
