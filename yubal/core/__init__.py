"""Core utilities shared across CLI and API."""

from yubal.core.config import (
    APP_ROOT,
    CONFIG_DIR,
    DATA_DIR,
    DEFAULT_BEETS_CONFIG,
    DEFAULT_BEETS_DB,
    DEFAULT_LIBRARY_DIR,
)
from yubal.core.jobs import Job, JobPhase, JobStatus, LogEntry, job_store
from yubal.core.models import (
    AlbumInfo,
    DownloadResult,
    LibraryHealth,
    SyncResult,
    TagResult,
    TrackInfo,
)
from yubal.core.progress import ProgressCallback, ProgressEvent, ProgressStep

__all__ = [
    "APP_ROOT",
    "CONFIG_DIR",
    "DATA_DIR",
    "DEFAULT_BEETS_CONFIG",
    "DEFAULT_BEETS_DB",
    "DEFAULT_LIBRARY_DIR",
    "AlbumInfo",
    "DownloadResult",
    "Job",
    "JobPhase",
    "JobStatus",
    "LibraryHealth",
    "LogEntry",
    "ProgressCallback",
    "ProgressEvent",
    "ProgressStep",
    "SyncResult",
    "TagResult",
    "TrackInfo",
    "job_store",
]
