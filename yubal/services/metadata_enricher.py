"""YouTube Music metadata enrichment via ytmusicapi.

This service fetches rich metadata from YouTube Music's API, which provides
cleaner titles, artists, and album info than yt-dlp's raw video metadata.
"""

import time
from dataclasses import dataclass
from typing import TypedDict

from loguru import logger
from ytmusicapi import YTMusic


class AlbumSearchResult(TypedDict):
    """Result from album search lookup."""

    album: str
    thumbnail_url: str | None


@dataclass(slots=True, frozen=True)
class TrackMetadata:
    """Enriched metadata for a single track."""

    video_id: str
    title: str
    artist: str
    track_number: int
    is_available: bool
    album: str | None = None
    thumbnail_url: str | None = None


@dataclass(slots=True, frozen=True)
class PlaylistMetadata:
    """Enriched metadata for a playlist."""

    playlist_id: str
    title: str
    track_count: int
    tracks: tuple[TrackMetadata, ...]


class MetadataEnricher:
    """Fetches and enriches playlist metadata from YouTube Music API.

    For tracks missing album info (music videos), searches for the
    album version to get proper metadata.
    """

    def __init__(self, request_delay: float = 0.5):
        """Initialize the enricher.

        Args:
            request_delay: Delay between search requests to avoid rate limiting
        """
        # No auth needed for public playlist metadata
        self._yt = YTMusic()
        self._request_delay = request_delay

    def get_playlist(self, playlist_id: str) -> PlaylistMetadata:
        """Fetch playlist with enriched track metadata.

        Args:
            playlist_id: YouTube playlist ID (e.g., "PLrAXtmErZgOei...")

        Returns:
            PlaylistMetadata with all available tracks enriched
        """
        logger.info("Fetching playlist metadata: {}", playlist_id)
        data = self._yt.get_playlist(playlist_id, limit=None)

        playlist_title = data.get("title", "Unknown Playlist")
        tracks: list[TrackMetadata] = []
        search_count = 0
        track_number = 0

        for item in data.get("tracks", []):
            video_id = item.get("videoId")
            is_available = item.get("isAvailable", False)

            # Skip unavailable tracks (removed videos, region-locked, etc.)
            if not is_available or not video_id:
                logger.debug(
                    "Skipping unavailable track: {}", item.get("title", "unknown")
                )
                continue

            track_number += 1
            title = item.get("title", "Unknown")

            # Extract artist (first one for filename, full list for metadata)
            artists = item.get("artists", [])
            artist = artists[0]["name"] if artists else "Unknown Artist"

            # Extract album info (None for music videos)
            album_data = item.get("album")
            album = album_data["name"] if album_data else None

            # Get best thumbnail (largest is last in array)
            thumbnails = item.get("thumbnails", [])
            thumbnail_url = thumbnails[-1]["url"] if thumbnails else None

            # If no album, search for album version
            if not album:
                if search_count > 0 and self._request_delay > 0:
                    time.sleep(self._request_delay)

                search_result = self._search_album(artist, title)
                if search_result:
                    album = search_result["album"]
                    # Use album thumbnail if we found one
                    if search_result.get("thumbnail_url"):
                        thumbnail_url = search_result["thumbnail_url"]
                search_count += 1

            tracks.append(
                TrackMetadata(
                    video_id=video_id,
                    title=title,
                    artist=artist,
                    album=album,
                    thumbnail_url=thumbnail_url,
                    track_number=track_number,
                    is_available=True,
                )
            )

        logger.info(
            "Enriched {} tracks ({} album searches performed)",
            len(tracks),
            search_count,
        )

        return PlaylistMetadata(
            playlist_id=playlist_id,
            title=playlist_title,
            track_count=len(tracks),
            tracks=tuple(tracks),
        )

    def _search_album(self, artist: str, title: str) -> AlbumSearchResult | None:
        """Search for album version of a track to get album name.

        Args:
            artist: Artist name to match
            title: Track title to search for

        Returns:
            AlbumSearchResult with 'album' and 'thumbnail_url' or None if not found
        """
        try:
            query = f"{artist} {title}"
            results = self._yt.search(query, filter="songs", limit=3)

            if not results:
                return None

            # Find first result with matching artist
            for result in results:
                result_artists = [a.get("name", "") for a in result.get("artists", [])]

                # Check if any artist matches
                if artist not in result_artists:
                    continue

                album_info = result.get("album", {})
                thumbnails = result.get("thumbnails", [])

                if album_info and album_info.get("name"):
                    logger.debug("Found album '{}' for '{}'", album_info["name"], title)
                    return {
                        "album": album_info["name"],
                        "thumbnail_url": thumbnails[-1]["url"] if thumbnails else None,
                    }

            return None

        except Exception as e:
            logger.warning("Search failed for '{}': {}", title, e)
            return None
