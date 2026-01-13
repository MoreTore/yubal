"""FastAPI dependency injection factories."""

from pathlib import Path
from typing import Annotated

from fastapi import Depends

from yubal.api.app import get_services
from yubal.core.types import AudioFormat
from yubal.services.job_executor import JobExecutor
from yubal.services.job_store import JobStore
from yubal.services.sync import AlbumSyncService, PlaylistSyncService
from yubal.settings import get_settings


def _get_job_store() -> JobStore:
    return get_services().job_store


def _get_job_executor() -> JobExecutor:
    return get_services().job_executor


def _get_album_sync_service() -> AlbumSyncService:
    return get_services().album_sync_service


def _get_playlist_sync_service() -> PlaylistSyncService:
    return get_services().playlist_sync_service


def _get_audio_format() -> AudioFormat:
    return get_settings().audio_format


def _get_cookies_file() -> Path:
    return get_settings().cookies_file


def _get_ytdlp_dir() -> Path:
    return get_settings().ytdlp_dir


# Type aliases for FastAPI dependency injection
CookiesFileDep = Annotated[Path, Depends(_get_cookies_file)]
YtdlpDirDep = Annotated[Path, Depends(_get_ytdlp_dir)]
JobStoreDep = Annotated[JobStore, Depends(_get_job_store)]
AudioFormatDep = Annotated[AudioFormat, Depends(_get_audio_format)]
AlbumSyncServiceDep = Annotated[AlbumSyncService, Depends(_get_album_sync_service)]
PlaylistSyncServiceDep = Annotated[
    PlaylistSyncService, Depends(_get_playlist_sync_service)
]
JobExecutorDep = Annotated[JobExecutor, Depends(_get_job_executor)]
