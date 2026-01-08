"""Audio file metadata patching via mutagen.

Patches downloaded audio files with enriched metadata from ytmusicapi,
overwriting the raw metadata that yt-dlp embeds.
"""

import base64
from collections.abc import Sequence
from io import BytesIO
from pathlib import Path

import httpx
from loguru import logger
from mutagen import File as MutagenFile
from mutagen.flac import Picture
from mutagen.id3 import APIC, ID3
from mutagen.mp4 import MP4Cover
from mutagen.oggopus import OggOpus
from mutagen.oggvorbis import OggVorbis
from PIL import Image

from yubal.services.metadata_enricher import TrackMetadata


class MetadataPatcher:
    """Patches audio file metadata with enriched values."""

    def _detect_mime_type(self, data: bytes) -> str:
        """Detect image format from magic bytes."""
        if data[:3] == b"\xff\xd8\xff":
            return "image/jpeg"
        elif data[:8] == b"\x89PNG\r\n\x1a\n":
            return "image/png"
        elif data[:4] == b"RIFF" and data[8:12] == b"WEBP":
            return "image/webp"
        return "image/jpeg"  # fallback

    def _ensure_jpeg(self, data: bytes) -> bytes:
        """Convert image to JPEG for maximum compatibility."""
        mime = self._detect_mime_type(data)
        if mime == "image/jpeg":
            return data

        try:
            img = Image.open(BytesIO(data))
            if img.mode in ("RGBA", "P"):
                img = img.convert("RGB")
            output = BytesIO()
            img.save(output, format="JPEG", quality=95)
            logger.debug("Converted {} to JPEG", mime)
            return output.getvalue()
        except Exception as e:
            logger.warning("Failed to convert image: {}", e)
            return data  # Return original if conversion fails

    def _download_artwork(self, url: str) -> bytes | None:
        """Download artwork from URL."""
        try:
            with httpx.Client(timeout=10) as client:
                response = client.get(url)
                response.raise_for_status()
                return response.content
        except Exception as e:
            logger.debug("Failed to download artwork: {}", e)
            return None

    def _embed_artwork(self, file_path: Path, image_data: bytes) -> bool:
        """Embed artwork into audio file based on format."""
        suffix = file_path.suffix.lower()

        # Convert to JPEG for maximum compatibility
        jpeg_data = self._ensure_jpeg(image_data)

        # Get image dimensions for Picture metadata (required for Ogg/Opus/FLAC)
        try:
            img = Image.open(BytesIO(jpeg_data))
            img_width, img_height = img.size
        except Exception:
            img_width, img_height = 0, 0

        try:
            if suffix == ".mp3":
                audio = ID3(str(file_path))
                audio.delall("APIC")  # Remove existing artwork
                audio.add(
                    APIC(
                        encoding=3,  # UTF-8
                        mime="image/jpeg",
                        type=3,  # Front cover
                        desc="Cover",
                        data=jpeg_data,
                    )
                )
                audio.save()

            elif suffix in {".m4a", ".mp4"}:
                audio = MutagenFile(str(file_path))
                if audio is not None:
                    audio["covr"] = [
                        MP4Cover(jpeg_data, imageformat=MP4Cover.FORMAT_JPEG)
                    ]
                    audio.save()

            elif suffix == ".flac":
                audio = MutagenFile(str(file_path))
                if audio is not None:
                    pic = Picture()
                    pic.type = 3  # Front cover
                    pic.mime = "image/jpeg"
                    pic.width = img_width
                    pic.height = img_height
                    pic.depth = 24  # RGB
                    pic.data = jpeg_data
                    audio.clear_pictures()
                    audio.add_picture(pic)
                    audio.save()

            elif suffix == ".opus":
                audio = OggOpus(str(file_path))
                pic = Picture()
                pic.type = 3
                pic.mime = "image/jpeg"
                pic.width = img_width
                pic.height = img_height
                pic.depth = 24  # RGB
                pic.data = jpeg_data
                audio["metadata_block_picture"] = [
                    base64.b64encode(pic.write()).decode("ascii")
                ]
                audio.save()

            elif suffix == ".ogg":
                audio = OggVorbis(str(file_path))
                pic = Picture()
                pic.type = 3
                pic.mime = "image/jpeg"
                pic.width = img_width
                pic.height = img_height
                pic.depth = 24  # RGB
                pic.data = jpeg_data
                audio["metadata_block_picture"] = [
                    base64.b64encode(pic.write()).decode("ascii")
                ]
                audio.save()

            else:
                logger.debug("Unsupported format for artwork: {}", suffix)
                return False

            return True

        except Exception as e:
            logger.warning("Failed to embed artwork in {}: {}", file_path.name, e)
            return False

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

            # Embed album artwork if available
            if metadata.thumbnail_url:
                logger.debug("Downloading artwork for: {}", file_path.name)
                image_data = self._download_artwork(metadata.thumbnail_url)
                if image_data:
                    logger.debug("Downloaded {} bytes of artwork", len(image_data))
                    if self._embed_artwork(file_path, image_data):
                        logger.debug("Artwork embedded successfully")
                    else:
                        logger.warning(
                            "Failed to embed artwork for: {}", file_path.name
                        )
                else:
                    logger.warning("Artwork download failed for: {}", file_path.name)

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
            logger.warning(
                "File count ({}) doesn't match metadata count ({}). "
                "Patching {} files with available metadata.",
                len(file_paths),
                len(track_metadata),
                min(len(file_paths), len(track_metadata)),
            )

        patched = 0
        paired_count = min(len(file_paths), len(track_metadata))
        for file_path, metadata in zip(file_paths, track_metadata, strict=False):
            if self.patch_file(file_path, metadata, playlist_name):
                patched += 1

        # Log results with clarity about unmatched files
        unmatched = len(file_paths) - paired_count
        if unmatched > 0:
            logger.warning(
                "Patched {}/{} files ({} files had no matching metadata)",
                patched,
                len(file_paths),
                unmatched,
            )
        else:
            logger.info("Patched {}/{} files", patched, len(file_paths))

        return patched
