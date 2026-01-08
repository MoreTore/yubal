import re
from enum import Enum


class ImportType(str, Enum):
    """Type of import operation (album vs playlist)."""

    ALBUM = "album"
    PLAYLIST = "playlist"


# Album playlist IDs start with this prefix
_ALBUM_PREFIX = "OLAK5uy_"


def extract_playlist_id(url: str) -> str | None:
    """Extract playlist ID from YouTube Music URL.

    Args:
        url: YouTube Music URL (e.g., https://music.youtube.com/playlist?list=PLxxx)

    Returns:
        Playlist ID or None if not found
    """
    match = re.search(r"list=([^&]+)", url)
    return match.group(1) if match else None


def detect_import_type(url: str) -> ImportType:
    """Detect whether URL is album or playlist based on playlist ID prefix.

    Albums use OLAK5uy_* prefix, everything else is treated as playlist.

    Args:
        url: YouTube Music URL

    Returns:
        ImportType.ALBUM or ImportType.PLAYLIST
    """
    playlist_id = extract_playlist_id(url)
    if playlist_id and playlist_id.startswith(_ALBUM_PREFIX):
        return ImportType.ALBUM
    return ImportType.PLAYLIST


class JobStatus(str, Enum):
    """Status of a background job."""

    PENDING = "pending"  # Waiting to start
    FETCHING_INFO = "fetching_info"  # Extracting album metadata
    DOWNLOADING = "downloading"  # Downloading tracks (0-80%)
    IMPORTING = "importing"  # Beets import (80-100%)
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"

    @property
    def is_finished(self) -> bool:
        return self in (self.COMPLETED, self.FAILED, self.CANCELLED)


class ProgressStep(str, Enum):
    """Steps in the sync workflow. Values match JobStatus."""

    FETCHING_INFO = "fetching_info"
    DOWNLOADING = "downloading"
    IMPORTING = "importing"
    COMPLETED = "completed"
    FAILED = "failed"
