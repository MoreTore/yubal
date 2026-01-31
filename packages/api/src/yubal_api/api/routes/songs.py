"""Song API endpoints."""

from __future__ import annotations

import asyncio
import json
import logging
from collections.abc import AsyncIterator
from datetime import UTC, datetime
from pathlib import Path
from typing import Any
from urllib.parse import parse_qs, urlparse

import httpx
import yt_dlp
from fastapi import APIRouter, Header, HTTPException, status
from starlette.background import BackgroundTask
from starlette.responses import StreamingResponse
from yubal import APIError
from yubal_api.services.ytmusic_client import get_ytmusic_client

from yubal_api.settings import get_settings

router = APIRouter(prefix="/songs", tags=["songs"])
logger = logging.getLogger(__name__)

ALLOWED_STREAM_HEADERS = {
    "content-type",
    "content-length",
    "accept-ranges",
    "content-range",
    "cache-control",
}

_STREAM_CACHE: dict[str, tuple[dict[str, Any], dict[str, Any], datetime | None]] = {}
_STREAM_CACHE_LOCK = asyncio.Lock()


class _YTDlpLogger:
    """Proxy yt-dlp logs through the application logger."""

    def debug(self, msg: str) -> None:
        logger.debug("[yt_dlp] %s", msg)

    def warning(self, msg: str) -> None:
        logger.warning("[yt_dlp] %s", msg)

    def error(self, msg: str) -> None:
        logger.error("[yt_dlp] %s", msg)


def _ensure_cache_dir(base_dir: Path) -> Path:
    cache_dir = base_dir / "yt-dlp-cache"
    cache_dir.mkdir(parents=True, exist_ok=True)
    return cache_dir


def _ensure_stream_cache_dir(base_dir: Path) -> Path:
    cache_dir = base_dir / "stream-cache"
    cache_dir.mkdir(parents=True, exist_ok=True)
    return cache_dir


def _build_yt_dlp_options(
    cookies_path: Path | None,
    cache_dir: Path,
) -> dict[str, Any]:
    opts: dict[str, Any] = {
        "quiet": True,
        "no_warnings": True,
        "skip_download": True,
        "noplaylist": True,
        "format": "bestaudio/best",
        "logger": _YTDlpLogger(),
        "remote_components": ["ejs:github"],
        "cachedir": str(cache_dir),
    }
    if cookies_path and cookies_path.exists():
        opts["cookiefile"] = str(cookies_path)
    return opts


def _safe_int(value: Any) -> int | None:
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _parse_expiration_dt(url: str) -> datetime | None:
    try:
        expire_value = parse_qs(urlparse(url).query).get("expire")
        if not expire_value:
            return None
        timestamp = int(expire_value[0])
    except (TypeError, ValueError):
        return None
    return datetime.fromtimestamp(timestamp, tz=UTC)


def _parse_iso_datetime(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(value)
    except ValueError:
        return None
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=UTC)
    return parsed


def _parse_expiration(url: str) -> str | None:
    expires_at = _parse_expiration_dt(url)
    return expires_at.isoformat() if expires_at else None


def _select_stream_format(info: dict[str, Any]) -> dict[str, Any]:
    format_id = info.get("format_id")
    formats = info.get("formats") or []
    return next((fmt for fmt in formats if fmt.get("format_id") == format_id), {})


def _extract_stream_info(
    video_id: str,
    cookies_path: Path | None,
    cache_dir: Path,
) -> tuple[dict[str, Any], dict[str, Any]]:
    url = f"https://music.youtube.com/watch?v={video_id}"
    try:
        with yt_dlp.YoutubeDL(
            _build_yt_dlp_options(cookies_path, cache_dir),
        ) as ydl:
            info = ydl.extract_info(url, download=False)
    except Exception as exc:  # pragma: no cover - passthrough for external lib
        logger.exception("yt-dlp failed for %s", video_id)
        raise RuntimeError("Failed to resolve audio stream") from exc

    stream_url = info.get("url")
    if not stream_url:
        raise RuntimeError("No playable stream URL returned")

    return info, _select_stream_format(info)


def _stream_cache_path(cache_dir: Path, video_id: str) -> Path:
    return cache_dir / f"{video_id}.json"


def _serialize_stream_cache(
    info: dict[str, Any],
    stream_format: dict[str, Any],
    expires_at: datetime | None,
) -> dict[str, Any]:
    return {
        "expiresAt": expires_at.isoformat() if expires_at else None,
        "info": {
            "id": info.get("id"),
            "url": info.get("url"),
            "thumbnails": info.get("thumbnails"),
            "duration": info.get("duration"),
            "filesize": info.get("filesize"),
            "webpage_url": info.get("webpage_url"),
            "title": info.get("title"),
            "fulltitle": info.get("fulltitle"),
            "artist": info.get("artist"),
            "uploader": info.get("uploader"),
            "channel": info.get("channel"),
            "channel_id": info.get("channel_id"),
        },
        "format": {
            "mimeType": stream_format.get("mimeType"),
            "ext": stream_format.get("ext"),
            "tbr": stream_format.get("tbr"),
            "abr": stream_format.get("abr"),
            "asr": stream_format.get("asr"),
            "filesize": stream_format.get("filesize"),
            "filesize_approx": stream_format.get("filesize_approx"),
        },
    }


def _deserialize_stream_cache(
    payload: dict[str, Any],
) -> tuple[dict[str, Any], dict[str, Any], datetime | None] | None:
    info = payload.get("info")
    stream_format = payload.get("format")
    if not isinstance(info, dict) or not isinstance(stream_format, dict):
        return None
    expires_at = _parse_iso_datetime(payload.get("expiresAt"))
    return info, stream_format, expires_at


def _read_stream_cache(
    cache_dir: Path,
    video_id: str,
) -> tuple[dict[str, Any], dict[str, Any], datetime | None] | None:
    path = _stream_cache_path(cache_dir, video_id)
    if not path.exists():
        return None
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None
    result = _deserialize_stream_cache(payload)
    if not result:
        return None
    info, stream_format, expires_at = result
    if expires_at and expires_at <= datetime.now(UTC):
        try:
            path.unlink()
        except OSError:
            pass
        return None
    return info, stream_format, expires_at


def _write_stream_cache(
    cache_dir: Path,
    video_id: str,
    info: dict[str, Any],
    stream_format: dict[str, Any],
    expires_at: datetime | None,
) -> None:
    path = _stream_cache_path(cache_dir, video_id)
    payload = _serialize_stream_cache(info, stream_format, expires_at)
    try:
        path.write_text(json.dumps(payload), encoding="utf-8")
    except OSError:
        return


async def _get_stream_info(
    video_id: str,
    cookies_path: Path | None,
    cache_dir: Path,
) -> tuple[dict[str, Any], dict[str, Any]]:
    async with _STREAM_CACHE_LOCK:
        cached = _STREAM_CACHE.get(video_id)
        if cached:
            info, stream_format, expires_at = cached
            if not expires_at or expires_at > datetime.now(UTC):
                logger.debug("Stream cache hit for %s", video_id)
                return info, stream_format
            _STREAM_CACHE.pop(video_id, None)

    stream_cache_dir = _ensure_stream_cache_dir(cache_dir)
    cached_on_disk = _read_stream_cache(stream_cache_dir, video_id)
    if cached_on_disk:
        info, stream_format, expires_at = cached_on_disk
        async with _STREAM_CACHE_LOCK:
            _STREAM_CACHE[video_id] = (info, stream_format, expires_at)
        logger.debug("Stream disk cache hit for %s", video_id)
        return info, stream_format

    info, stream_format = _extract_stream_info(video_id, cookies_path, cache_dir)
    stream_url = info.get("url") or ""
    expires_at = _parse_expiration_dt(stream_url) if stream_url else None
    async with _STREAM_CACHE_LOCK:
        _STREAM_CACHE[video_id] = (info, stream_format, expires_at)
    _write_stream_cache(stream_cache_dir, video_id, info, stream_format, expires_at)
    return info, stream_format


@router.get("/{video_id}", status_code=status.HTTP_200_OK)
async def get_song(video_id: str) -> dict[str, Any]:
    """Get streaming metadata for a song by video ID."""
    settings = get_settings()
    cache_dir = _ensure_cache_dir(settings.temp)

    try:
        playback_info, playback_format = await _get_stream_info(
            video_id,
            settings.cookies_file,
            cache_dir,
        )
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(exc),
        ) from exc

    thumbnails = playback_info.get("thumbnails") or []
    duration_seconds = _safe_int(playback_info.get("duration"))

    stream_url = playback_info.get("url")
    if not stream_url:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="No stream URL returned",
        )

    stream_payload = {
        "url": stream_url,
        "mimeType": playback_format.get("mimeType")
        or (playback_format.get("ext") and f"audio/{playback_format.get('ext')}"),
        "bitrate": playback_format.get("tbr") or playback_format.get("abr"),
        "audioSampleRate": _safe_int(playback_format.get("asr")),
        "contentLength": playback_format.get("filesize")
        or playback_format.get("filesize_approx")
        or playback_info.get("filesize"),
        "expiresAt": _parse_expiration(stream_url),
        "proxyUrl": f"/api/songs/{video_id}/stream",
    }

    artist = (
        playback_info.get("artist")
        or playback_info.get("uploader")
        or playback_info.get("channel")
    )
    channel_id = playback_info.get("channel_id")

    return {
        "videoId": playback_info.get("id") or video_id,
        "title": playback_info.get("title")
        or playback_info.get("fulltitle"),
        "artist": artist,
        "channelId": channel_id,
        "durationSeconds": duration_seconds,
        "thumbnails": thumbnails,
        "sourceUrl": playback_info.get("webpage_url"),
        "stream": stream_payload,
    }


@router.get("/{video_id}/stream")
async def stream_song(
    video_id: str,
    range_header: str | None = Header(
        default=None,
        convert_underscores=False,
        alias="Range",
    ),
) -> StreamingResponse:
    """Proxy the YouTube audio stream through the API to avoid IP pinning."""
    settings = get_settings()
    cache_dir = _ensure_cache_dir(settings.temp)

    try:
        playback_info, _ = await _get_stream_info(
            video_id,
            settings.cookies_file,
            cache_dir,
        )
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(exc),
        ) from exc

    stream_url = playback_info.get("url")
    if not stream_url:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="No stream URL available",
        )

    request_headers: dict[str, str] = {}
    if range_header:
        request_headers["Range"] = range_header

    http_client = httpx.AsyncClient(timeout=None)
    stream_ctx = http_client.stream("GET", stream_url, headers=request_headers)
    upstream = await stream_ctx.__aenter__()

    if upstream.status_code >= 400:
        await upstream.aclose()
        await http_client.aclose()
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to fetch upstream audio stream",
        )

    response_headers = {
        key: value
        for key, value in upstream.headers.items()
        if key.lower() in ALLOWED_STREAM_HEADERS
    }

    async def chunk_generator() -> AsyncIterator[bytes]:
        async for chunk in upstream.aiter_raw():
            yield chunk

    async def _finalize() -> None:
        await upstream.aclose()
        await stream_ctx.__aexit__(None, None, None)
        await http_client.aclose()

    return StreamingResponse(
        chunk_generator(),
        status_code=upstream.status_code,
        headers=response_headers,
        media_type=upstream.headers.get("Content-Type"),
        background=BackgroundTask(_finalize),
    )


@router.get("/{video_id}/related", status_code=status.HTTP_200_OK)
async def get_song_related(video_id: str) -> list[dict]:
    """Get related content for a song by video ID."""
    settings = get_settings()
    client = get_ytmusic_client(settings.cookies_file)

    try:
        related = client.get_song_related(video_id)
    except APIError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(exc),
        ) from exc

    return related
