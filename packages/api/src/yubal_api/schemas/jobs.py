"""Job API schemas."""

import re
from typing import Annotated, Literal

from pydantic import AfterValidator, BaseModel, Field
from yubal import AudioCodec

from yubal_api.core.models import Job

# YouTube Music URL patterns
_YOUTUBE_MUSIC_PATTERNS = [
    r"^https?://music\.youtube\.com/playlist\?list=[\w-]+",
    r"^https?://music\.youtube\.com/browse/[\w-]+",
    r"^https?://(?:www\.)?youtube\.com/playlist\?list=[\w-]+",
]
_YOUTUBE_MUSIC_REGEX = re.compile("|".join(_YOUTUBE_MUSIC_PATTERNS))


def validate_youtube_music_url(url: str) -> str:
    """Validate that the URL is a YouTube Music or YouTube playlist URL."""
    url = url.strip()
    if not _YOUTUBE_MUSIC_REGEX.match(url):
        raise ValueError(
            "Invalid URL. Expected a YouTube Music playlist URL "
            "(e.g., https://music.youtube.com/playlist?list=...)"
        )
    return url


YouTubeMusicUrl = Annotated[str, AfterValidator(validate_youtube_music_url)]


class CreateJobRequest(BaseModel):
    """Request to create a new sync job."""

    url: YouTubeMusicUrl = Field(
        description="YouTube Music playlist or album URL",
        examples=["https://music.youtube.com/playlist?list=OLAK5uy_..."],
    )
    audio_format: AudioCodec | None = Field(
        default=None,
        description="Audio format for downloads. Uses server default if not set.",
    )
    max_items: int | None = Field(
        default=None,
        ge=1,
        le=10000,
        description="Maximum number of tracks to download",
    )


class JobsResponse(BaseModel):
    """Response for listing jobs."""

    jobs: list[Job]


class JobCreatedResponse(BaseModel):
    """Response when a job is created."""

    id: str
    message: Literal["Job created"] = "Job created"


class ClearJobsResponse(BaseModel):
    """Response when jobs are cleared."""

    cleared: int


class CancelJobResponse(BaseModel):
    """Response when a job is cancelled."""

    message: Literal["Job cancelled"] = "Job cancelled"
