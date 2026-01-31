"""Artist discography download service."""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Iterable

from yubal import CancelToken, PhaseStats
from yubal.client import YTMusicClient
from yubal_api.services.ytmusic_client import get_ytmusic_client
from yubal.models.enums import ContentKind, SkipReason

from yubal_api.domain.enums import ProgressStep
from yubal_api.domain.job import ContentInfo
from yubal_api.services.sync import ProgressCallback, SyncService

logger = logging.getLogger(__name__)


@dataclass(slots=True)
class DiscographyRelease:
    """Single release within an artist discography."""

    browse_id: str
    title: str
    kind_label: str
    year: str | None = None
    download_id: str | None = None

    @property
    def url(self) -> str:
        if self.download_id:
            return f"https://music.youtube.com/playlist?list={self.download_id}"
        return f"https://music.youtube.com/browse/{self.browse_id}"


@dataclass(slots=True)
class DiscographyPlan:
    """Collected discography metadata."""

    artist_name: str | None
    thumbnail_url: str | None
    releases: list[DiscographyRelease] = field(default_factory=list)


@dataclass(slots=True)
class DiscographyResult:
    """Outcome of a discography download."""

    success: bool
    completed_releases: int
    total_releases: int
    content_info: ContentInfo | None = None
    download_stats: PhaseStats | None = None
    errors: list[str] = field(default_factory=list)

    @property
    def has_partial_failures(self) -> bool:
        return bool(self.errors) and self.completed_releases > 0


class DiscographyService:
    """Downloads all albums and singles for an artist in a single job."""

    def __init__(
        self,
        base_path: Path,
        audio_format: str,
        cookies_path: Path | None,
        fetch_lyrics: bool,
    ) -> None:
        self._base_path = base_path
        self._audio_format = audio_format
        self._cookies_path = cookies_path
        self._fetch_lyrics = fetch_lyrics

    # --------------------------------------------------------------------- #
    # Public API
    # --------------------------------------------------------------------- #

    def run(
        self,
        channel_id: str,
        cancel_token: CancelToken,
        on_progress: ProgressCallback | None = None,
        *,
        include_albums: bool = True,
        include_singles: bool = True,
    ) -> DiscographyResult:
        """Download the artist discography."""
        client = get_ytmusic_client(self._cookies_path)
        plan = self._collect_discography(
            client,
            channel_id,
            include_albums=include_albums,
            include_singles=include_singles,
        )

        if not plan.releases:
            message = "No albums or singles found for this artist"
            logger.warning("Discography empty for channel %s", channel_id)
            return DiscographyResult(
                success=False,
                completed_releases=0,
                total_releases=0,
                errors=[message],
            )

        content_info = self._build_content_info(plan, channel_id)
        aggregated_stats = _AggregatedStats()

        if on_progress:
            on_progress(
                ProgressStep.FETCHING_INFO,
                f"Found {len(plan.releases)} releases",
                0.0,
                {"content_info": content_info.model_dump()},
            )

        sync_service = SyncService(
            self._base_path,
            self._audio_format,
            self._cookies_path,
            self._fetch_lyrics,
        )

        completed = 0
        errors: list[str] = []
        total = len(plan.releases)

        for index, release in enumerate(plan.releases):
            if cancel_token.is_cancelled:
                logger.info("Discography download cancelled (%s)", release.title)
                break

            release_callback = self._wrap_progress_callback(
                on_progress, index, total, release
            )

            try:
                result = sync_service.run(
                    release.url,
                    release_callback,
                    cancel_token,
                )
            except Exception as exc:  # pragma: no cover - defensive
                logger.exception("Release download failed: %s", release.title)
                errors.append(str(exc))
                continue

            if not result.success:
                errors.append(result.error or f"Failed to download {release.title}")
                continue

            completed += 1
            aggregated_stats.add(result.download_stats)
            self._update_content_info(content_info, result.content_info)

        success = completed > 0 and not cancel_token.is_cancelled
        return DiscographyResult(
            success=success,
            completed_releases=completed,
            total_releases=total,
            content_info=content_info if completed > 0 else None,
            download_stats=aggregated_stats.to_phase_stats(),
            errors=errors,
        )

    def resolve_metadata(
        self,
        channel_id: str,
        *,
        include_albums: bool = True,
        include_singles: bool = True,
    ) -> ContentInfo | None:
        """Resolve discography metadata without downloading."""
        client = YTMusicClient(cookies_path=self._cookies_path)
        plan = self._collect_discography(
            client,
            channel_id,
            include_albums=include_albums,
            include_singles=include_singles,
        )
        if not plan.releases:
            return None
        return self._build_content_info(plan, channel_id)

    # --------------------------------------------------------------------- #
    # Internal helpers
    # --------------------------------------------------------------------- #

    def _collect_discography(
        self,
        client: YTMusicClient,
        channel_id: str,
        *,
        include_albums: bool,
        include_singles: bool,
    ) -> DiscographyPlan:
        artist = client.get_artist(channel_id)
        releases: list[DiscographyRelease] = []
        seen: set[str] = set()

        def _collect_section(key: str, label: str) -> None:
            section = artist.get(key) or {}
            items: list[dict[str, Any]] = list(section.get("results") or [])
            params = section.get("params")

            if params:
                try:
                    extra = client.get_artist_albums(
                        channel_id,
                        params,
                        limit=None,
                    )
                    items.extend(extra or [])
                except Exception as exc:  # pragma: no cover - network guard
                    logger.warning(
                        "Failed to fetch %s for channel %s: %s", key, channel_id, exc
                    )

            for item in items:
                browse_id = item.get("browseId")
                if not browse_id or browse_id in seen:
                    continue
                seen.add(browse_id)
                title = item.get("title") or item.get("name") or "Untitled"
                download_id = self._resolve_download_id(client, item, browse_id)
                releases.append(
                    DiscographyRelease(
                        browse_id=browse_id,
                        title=title,
                        kind_label=label,
                        year=item.get("year"),
                        download_id=download_id,
                    )
                )

        if include_albums:
            _collect_section("albums", "Album")
        if include_singles:
            _collect_section("singles", "Single/EP")

        thumbnail = self._extract_thumbnail_url(artist.get("thumbnails"))
        return DiscographyPlan(
            artist_name=artist.get("name"),
            thumbnail_url=thumbnail,
            releases=releases,
        )

    def _wrap_progress_callback(
        self,
        callback: ProgressCallback | None,
        index: int,
        total: int,
        release: DiscographyRelease,
    ) -> ProgressCallback | None:
        if callback is None:
            return None

        def _inner(
            step: ProgressStep,
            message: str,
            percent: float | None,
            details: dict[str, Any] | None,
        ) -> None:
            scaled = _scale_progress(index, total, percent)
            filtered_details = (
                {k: v for k, v in (details or {}).items() if k != "content_info"}
                if details
                else None
            )
            callback(
                step,
                f"[{release.kind_label}] {release.title}: {message}",
                scaled,
                filtered_details,
            )

        return _inner

    def _build_content_info(
        self,
        plan: DiscographyPlan,
        channel_id: str,
    ) -> ContentInfo:
        artist_name = plan.artist_name or "Unknown artist"
        return ContentInfo(
            title=f"{artist_name} discography",
            artist=artist_name,
            year=None,
            track_count=0,
            album_count=len(plan.releases),
            playlist_id=channel_id,
            url=f"https://music.youtube.com/browse/{channel_id}",
            thumbnail_url=plan.thumbnail_url,
            audio_codec=self._audio_format.upper(),
            audio_bitrate=None,
            kind=ContentKind.PLAYLIST,
        )

    def _update_content_info(
        self,
        aggregate: ContentInfo,
        release_info: ContentInfo | None,
    ) -> None:
        if release_info is None:
            return

        aggregate.track_count = (aggregate.track_count or 0) + (
            release_info.track_count or 0
        )

        if aggregate.audio_bitrate is None and release_info.audio_bitrate is not None:
            aggregate.audio_bitrate = release_info.audio_bitrate

    def _resolve_download_id(
        self,
        client: YTMusicClient,
        item: dict[str, Any],
        browse_id: str,
    ) -> str | None:
        playlist_id = item.get("playlistId") or item.get("audioPlaylistId")
        if isinstance(playlist_id, str) and playlist_id.strip():
            return playlist_id

        if browse_id.startswith("MPRE"):
            try:
                album = client.get_album(browse_id)
            except Exception as exc:  # pragma: no cover - network guard
                logger.warning(
                    "Failed to resolve album playlist for %s: %s", browse_id, exc
                )
                return None

            if album.audio_playlist_id:
                return album.audio_playlist_id

        return None

    @staticmethod
    def _extract_thumbnail_url(thumbnails: Iterable[dict[str, Any]] | None) -> str | None:
        if not thumbnails:
            return None
        sorted_thumbs = sorted(
            (thumb for thumb in thumbnails if isinstance(thumb, dict)),
            key=lambda t: (t.get("width") or 0) * (t.get("height") or 0),
            reverse=True,
        )
        return sorted_thumbs[0].get("url") if sorted_thumbs else None


def _scale_progress(index: int, total: int, percent: float | None) -> float | None:
    if total <= 0 or percent is None:
        return percent
    per_release = percent / total
    base = (index / total) * 100.0
    value = base + per_release
    return min(max(value, 0.0), 100.0)


class _AggregatedStats:
    """Mutable accumulator for PhaseStats."""

    def __init__(self) -> None:
        self.success = 0
        self.failed = 0
        self.skipped_by_reason: dict[SkipReason, int] = {}

    def add(self, stats: PhaseStats | None) -> None:
        if stats is None:
            return
        self.success += stats.success
        self.failed += stats.failed
        for reason, count in stats.skipped_by_reason.items():
            self.skipped_by_reason[reason] = (
                self.skipped_by_reason.get(reason, 0) + count
            )

    def to_phase_stats(self) -> PhaseStats:
        return PhaseStats(
            success=self.success,
            failed=self.failed,
            skipped_by_reason=self.skipped_by_reason.copy(),
        )
