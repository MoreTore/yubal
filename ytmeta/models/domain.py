"""Domain models for ytmeta.

These are the public models that represent the output of the library.
"""

from __future__ import annotations

from enum import StrEnum

from pydantic import BaseModel, ConfigDict


class VideoType(StrEnum):
    """YouTube Music video types."""

    ATV = "ATV"  # Audio Track Video (album version)
    OMV = "OMV"  # Official Music Video


class TrackMetadata(BaseModel):
    """Metadata for a single track."""

    omv_video_id: str | None = None
    atv_video_id: str | None = None
    title: str
    artists: list[str]
    album: str
    album_artists: list[str]
    track_number: int | None = None
    total_tracks: int | None = None
    year: str | None = None
    cover_url: str | None = None
    video_type: VideoType

    @property
    def artist(self) -> str:
        """Joined artists for metadata embedding."""
        return "; ".join(self.artists)

    @property
    def album_artist(self) -> str:
        """Joined album artists for metadata embedding."""
        return "; ".join(self.album_artists)

    @property
    def primary_album_artist(self) -> str:
        """First album artist for path construction."""
        return self.album_artists[0] if self.album_artists else "Unknown Artist"


class ExtractProgress(BaseModel):
    """Progress update during metadata extraction.

    Yielded by MetadataExtractorService.extract() to report progress.

    Attributes:
        current: Number of tracks processed so far (1-indexed).
        total: Total number of tracks in the playlist.
        track: Extracted track metadata, or None if extraction failed for this track.
    """

    model_config = ConfigDict(frozen=True)

    current: int
    total: int
    track: TrackMetadata | None = None
