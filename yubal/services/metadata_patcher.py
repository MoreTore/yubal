"""Audio file metadata patching via mutagen.

Patches downloaded audio files with enriched metadata from ytmusicapi,
overwriting the raw metadata that yt-dlp embeds.
"""

from collections.abc import Sequence
from pathlib import Path

from loguru import logger
from mutagen import File as MutagenFile

from yubal.services.metadata_enricher import TrackMetadata


class MetadataPatcher:
    """Patches audio file metadata with enriched values."""

    def patch_file(
        self,
        file_path: Path,
        metadata: TrackMetadata,
        playlist_name: str,
    ) -> bool:
        """Update audio file metadata with enriched values.

        Args:
            file_path: Path to audio file
            metadata: TrackMetadata from enricher
            playlist_name: Playlist name (used as album fallback)

        Returns:
            True if successful, False otherwise
        """
        try:
            # easy=True gives us format-agnostic tag access
            audio = MutagenFile(str(file_path), easy=True)
            if audio is None:
                logger.warning("Could not open file for patching: {}", file_path)
                return False

            # Set common tags
            audio["title"] = metadata.title
            audio["artist"] = metadata.artist
            audio["album"] = metadata.album or playlist_name
            audio["albumartist"] = metadata.artist
            audio["tracknumber"] = str(metadata.track_number)

            audio.save()
            logger.debug("Patched metadata for: {}", file_path.name)
            return True

        except Exception as e:
            logger.error("Failed to patch {}: {}", file_path, e)
            return False

    def patch_files(
        self,
        file_paths: Sequence[Path],
        track_metadata: Sequence[TrackMetadata],
        playlist_name: str,
    ) -> int:
        """Patch multiple files with corresponding metadata.

        Files must be in same order as track_metadata list.

        Args:
            file_paths: List of audio file paths (in playlist order)
            track_metadata: List of TrackMetadata (in same order)
            playlist_name: Playlist name for album fallback

        Returns:
            Number of successfully patched files
        """
        if len(file_paths) != len(track_metadata):
            raise ValueError(
                f"File count ({len(file_paths)}) doesn't match "
                f"metadata count ({len(track_metadata)})"
            )

        patched = 0
        for file_path, metadata in zip(file_paths, track_metadata, strict=True):
            if self.patch_file(file_path, metadata, playlist_name):
                patched += 1

        logger.info("Patched {}/{} files", patched, len(file_paths))
        return patched
