"""Metadata resolution service for queued jobs."""

from __future__ import annotations

import logging
from dataclasses import dataclass
from pathlib import Path

from yubal import create_extractor, is_single_track_url
from yubal.services import MetadataExtractorService

from yubal_api.domain.enums import JobKind
from yubal_api.domain.job import ContentInfo
from yubal_api.services.discography import DiscographyService
from yubal_api.services.sync import build_content_info

logger = logging.getLogger(__name__)


@dataclass(slots=True)
class MetadataResolver:
    """Resolve ContentInfo before downloads start."""

    audio_format: str
    cookies_path: Path | None
    base_path: Path
    fetch_lyrics: bool

    def resolve(
        self,
        url: str,
        *,
        kind: JobKind,
        channel_id: str | None,
        max_items: int | None,
    ) -> ContentInfo | None:
        if kind == JobKind.DISCOGRAPHY:
            if not channel_id:
                return None
            return self._resolve_discography(channel_id)

        return self._resolve_standard(url, max_items=max_items)

    def _resolve_discography(self, channel_id: str) -> ContentInfo | None:
        service = DiscographyService(
            self.base_path,
            self.audio_format,
            self.cookies_path,
            self.fetch_lyrics,
        )
        try:
            return service.resolve_metadata(channel_id)
        except Exception as exc:  # pragma: no cover - network guard
            logger.warning("Failed to resolve discography metadata: %s", exc)
            return None

    def _resolve_standard(
        self, url: str, *, max_items: int | None
    ) -> ContentInfo | None:
        extractor = create_extractor(cookies_path=self.cookies_path)
        if is_single_track_url(url):
            return self._resolve_single_track(extractor, url)
        return self._resolve_playlist(extractor, url, max_items=max_items)

    def _resolve_single_track(
        self, extractor: MetadataExtractorService, url: str
    ) -> ContentInfo | None:
        result = extractor.extract_track(url)
        if result is None:
            return None
        return build_content_info(
            result.playlist_info,
            [result.track],
            url,
            self.audio_format,
        )

    def _resolve_playlist(
        self,
        extractor: MetadataExtractorService,
        url: str,
        *,
        max_items: int | None,
    ) -> ContentInfo | None:
        tracks = []
        playlist_info = None
        playlist_total = None

        limit = 1 if max_items is None or max_items > 1 else max_items

        for progress in extractor.extract(url, max_items=limit):
            playlist_info = progress.playlist_info
            playlist_total = progress.playlist_total
            if progress.track is not None:
                tracks.append(progress.track)
            break

        if not playlist_info or not tracks:
            return None

        info = build_content_info(
            playlist_info,
            tracks,
            url,
            self.audio_format,
        )
        if playlist_total:
            if max_items:
                info.track_count = min(playlist_total, max_items)
            else:
                info.track_count = playlist_total
        return info
