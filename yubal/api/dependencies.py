import uuid
from datetime import datetime
from functools import cache
from pathlib import Path
from typing import Annotated

from fastapi import Depends

from yubal.core.types import AudioFormat
from yubal.services.downloader import Downloader
from yubal.services.job_store import JobStore
from yubal.services.sync import SyncService
from yubal.services.tagger import Tagger
from yubal.settings import get_settings


@cache
def get_job_store() -> JobStore:
    """Get cached job store instance (created on first call)."""
    settings = get_settings()
    return JobStore(
        clock=lambda: datetime.now(settings.timezone),
        id_generator=lambda: str(uuid.uuid4()),
    )


def get_audio_format() -> AudioFormat:
    """Get audio format from settings."""
    return get_settings().audio_format


def get_cookies_file() -> Path:
    """Get cookies file path from settings."""
    return get_settings().cookies_file


def get_ytdlp_dir() -> Path:
    """Get yt-dlp directory from settings."""
    return get_settings().ytdlp_dir


def get_sync_service() -> SyncService:
    """Factory for creating SyncService with injected dependencies."""
    settings = get_settings()
    return SyncService(
        library_dir=settings.library_dir,
        beets_config=settings.beets_config,
        audio_format=settings.audio_format,
        temp_dir=settings.temp_dir,
        playlists_dir=settings.playlists_dir,
        downloader=Downloader(
            audio_format=settings.audio_format,
            cookies_file=settings.cookies_file,
        ),
        tagger=Tagger(
            beets_config=settings.beets_config,
            library_dir=settings.library_dir,
            beets_db=settings.beets_db,
        ),
    )


SyncServiceDep = Annotated[SyncService, Depends(get_sync_service)]
CookiesFileDep = Annotated[Path, Depends(get_cookies_file)]
YtdlpDirDep = Annotated[Path, Depends(get_ytdlp_dir)]
JobStoreDep = Annotated[JobStore, Depends(get_job_store)]
AudioFormatDep = Annotated[AudioFormat, Depends(get_audio_format)]
