"""Song API endpoints."""

from __future__ import annotations

import asyncio
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
from yubal.client import YTMusicClient

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


def _parse_expiration(url: str) -> str | None:
    try:
        expire_value = parse_qs(urlparse(url).query).get("expire")
        if not expire_value:
            return None
        timestamp = int(expire_value[0])
    except (TypeError, ValueError):
        return None
    return datetime.fromtimestamp(timestamp, tz=UTC).isoformat()


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


@router.get("/{video_id}", status_code=status.HTTP_200_OK)
async def get_song(video_id: str) -> dict[str, Any]:
    """Get streaming metadata for a song by video ID."""
    settings = get_settings()
    client = YTMusicClient(cookies_path=settings.cookies_file)
    cache_dir = _ensure_cache_dir(settings.temp)

    try:
        song = client.get_song(video_id)
    except APIError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(exc),
        ) from exc

    try:
        playback_info, playback_format = _extract_stream_info(
            video_id,
            settings.cookies_file,
            cache_dir,
        )
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(exc),
        ) from exc

    video_details = song.get("videoDetails") or {}
    microformat = (song.get("microformat") or {}).get("microformatDataRenderer", {})
    microformat_details = microformat.get("videoDetails") or {}
    thumbnails = (
        video_details.get("thumbnail", {}).get("thumbnails")
        or microformat.get("thumbnail", {}).get("thumbnails")
        or playback_info.get("thumbnails")
        or []
    )
    duration_seconds = (
        _safe_int(video_details.get("lengthSeconds"))
        or _safe_int(microformat_details.get("durationSeconds"))
        or _safe_int(playback_info.get("duration"))
    )

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
        video_details.get("author")
        or playback_info.get("artist")
        or playback_info.get("uploader")
        or playback_info.get("channel")
    )

    return {
        "videoId": video_details.get("videoId") or playback_info.get("id") or video_id,
        "title": video_details.get("title")
        or playback_info.get("title")
        or playback_info.get("fulltitle"),
        "artist": artist,
        "channelId": video_details.get("channelId") or playback_info.get("channel_id"),
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
        playback_info, _ = _extract_stream_info(
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
    upstream = await http_client.stream("GET", stream_url, headers=request_headers)

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

    def _finalize() -> None:
        async def closer() -> None:
            await upstream.aclose()
            await http_client.aclose()

        _ = asyncio.create_task(closer())

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
    client = YTMusicClient(cookies_path=settings.cookies_file)

    try:
        related = client.get_song_related(video_id)
    except APIError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(exc),
        ) from exc

    return related
