from datetime import UTC, datetime

from pydantic import BaseModel, ConfigDict, Field

from yubal.core.enums import JobStatus
from yubal.core.types import AudioFormat, LogStatus


class AlbumInfo(BaseModel):
    """Information about an album/playlist."""

    title: str
    artist: str
    year: int | None = None
    track_count: int
    playlist_id: str = ""
    url: str = ""
    thumbnail_url: str | None = None
    audio_codec: str | None = None  # e.g. "opus", "mp3"
    audio_bitrate: int | None = None  # kbps, e.g. 128


class DownloadResult(BaseModel):
    """Result of a download operation."""

    success: bool
    album_info: AlbumInfo | None = None
    output_dir: str
    downloaded_files: list[str] = []
    error: str | None = None
    cancelled: bool = False


class TagResult(BaseModel):
    """Result of a tagging operation."""

    success: bool
    source_dir: str
    dest_dir: str | None = None
    album_name: str | None = None
    artist_name: str | None = None
    track_count: int = 0
    error: str | None = None


class SyncResult(BaseModel):
    """Result of a sync operation."""

    success: bool
    download_result: DownloadResult | None = None
    tag_result: TagResult | None = None
    album_info: AlbumInfo | None = None
    destination: str | None = None
    error: str | None = None


class LogEntry(BaseModel):
    """A log entry for a job."""

    timestamp: datetime
    status: LogStatus
    message: str


class Job(BaseModel):
    """A background sync job."""

    model_config = ConfigDict(validate_assignment=True)

    id: str
    url: str
    audio_format: AudioFormat = "opus"
    status: JobStatus = JobStatus.PENDING
    progress: float = 0.0
    album_info: AlbumInfo | None = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    started_at: datetime | None = None
    completed_at: datetime | None = None
