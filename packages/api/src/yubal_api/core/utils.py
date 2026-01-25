"""URL parsing and detection utilities."""

import re


def extract_list_id(url: str) -> str | None:
    """Extract list ID from YouTube Music URL.

    The list parameter is used for playlists, albums, and track context.

    Args:
        url: YouTube Music URL (e.g., https://music.youtube.com/playlist?list=PLxxx)

    Returns:
        List ID or None if not found
    """
    match = re.search(r"list=([^&]+)", url)
    return match.group(1) if match else None
