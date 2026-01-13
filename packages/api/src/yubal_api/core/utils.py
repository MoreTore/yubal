"""URL parsing and detection utilities."""

import re

from yubal_api.core.enums import ImportType

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
