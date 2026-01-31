"""Cached YTMusic client factory."""

from functools import lru_cache
from pathlib import Path

from yubal.client import YTMusicClient


@lru_cache(maxsize=4)
def get_ytmusic_client(cookies_path: Path) -> YTMusicClient:
    """Return a cached YTMusic client for the given cookies path."""
    return YTMusicClient(cookies_path=cookies_path)
