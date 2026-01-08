import shutil
from pathlib import Path

from loguru import logger
from mutagen import File as MutagenFile

from yubal.core.callbacks import CancelCheck, ProgressCallback, ProgressEvent
from yubal.core.enums import ProgressStep, extract_playlist_id
from yubal.core.models import AlbumInfo, SyncResult
from yubal.services.downloader import Downloader
from yubal.services.m3u_generator import generate_m3u, sanitize_filename
from yubal.services.metadata_enricher import MetadataEnricher
from yubal.services.metadata_patcher import MetadataPatcher
from yubal.services.tagger import Tagger


def _get_file_bitrate(file_path: Path) -> int | None:
    """Get actual average bitrate from audio file (calculated from size/duration)."""
    try:
        audio = MutagenFile(str(file_path))
        if not audio or not audio.info or not audio.info.length:
            return None

        file_size = file_path.stat().st_size
        duration = audio.info.length

        # Calculate actual average bitrate: (bytes * 8 bits) / seconds / 1000
        return int((file_size * 8) / duration / 1000)

    except Exception:  # noqa: S110  # Best-effort, non-critical
        pass
    return None


class SyncService:
    """Orchestrates the download → tag workflow."""

    def __init__(
        self,
        library_dir: Path,
        beets_config: Path,
        audio_format: str,
        temp_dir: Path,
        playlists_dir: Path,
        downloader: Downloader,
        tagger: Tagger,
    ):
        """
        Initialize the sync service.

        Args:
            library_dir: Directory for the organized music library
            beets_config: Path to beets configuration file
            audio_format: Audio format for downloads (mp3, m4a, opus, etc.)
            temp_dir: Directory for temporary download files
            playlists_dir: Directory for playlist downloads (Playlists/{name}/)
            downloader: Downloader instance for fetching from YouTube
            tagger: Tagger instance for organizing with beets
        """
        self.library_dir = library_dir
        self.beets_config = beets_config
        self.audio_format = audio_format
        self.temp_dir = temp_dir
        self.playlists_dir = playlists_dir
        self._downloader = downloader
        self._tagger = tagger

    def sync_album(
        self,
        url: str,
        job_id: str,
        progress_callback: ProgressCallback | None = None,
        cancel_check: CancelCheck | None = None,
    ) -> SyncResult:
        """
        Download and tag an album in one operation.

        Progress is calculated as:
        - 0% → 10%: Fetching info phase
        - 10% → 90%: Download phase (proportional to tracks)
        - 90% → 100%: Import/tagging phase

        Args:
            url: YouTube Music album/playlist URL
            job_id: Unique job identifier (used for temp directory)
            progress_callback: Optional callback for progress updates
            cancel_check: Function returning True if operation should cancel

        Returns:
            SyncResult with success status and details
        """
        # Create temp subfolder per job for easier cleanup/debugging
        job_temp_dir = self.temp_dir / job_id
        job_temp_dir.mkdir(parents=True, exist_ok=True)
        album_info: AlbumInfo | None = None

        try:
            # Phase 1: Extract album info (0% → 10%)
            if progress_callback:
                progress_callback(
                    ProgressEvent(
                        step=ProgressStep.FETCHING_INFO,
                        message="Fetching album info...",
                        progress=0.0,
                    )
                )

            downloader = self._downloader

            try:
                album_info = downloader.extract_info(url)
                total_tracks = album_info.track_count or 1  # Fallback to 1
            except Exception as e:
                if progress_callback:
                    progress_callback(
                        ProgressEvent(
                            step=ProgressStep.FAILED,
                            message=f"Failed to fetch album info: {e}",
                        )
                    )
                return SyncResult(
                    success=False,
                    error=f"Failed to fetch album info: {e}",
                )

            # Notify with album info - fetching complete at 10%
            if progress_callback:
                progress_callback(
                    ProgressEvent(
                        step=ProgressStep.FETCHING_INFO,
                        message=f"Found {total_tracks} tracks: {album_info.title}",
                        progress=10.0,
                        details={"album_info": album_info.model_dump()},
                    )
                )

            # Phase 2: Download (10% → 90%)
            def download_progress_wrapper(event: ProgressEvent) -> None:
                """Wrapper that calculates album-wide progress for download phase."""
                if not progress_callback:
                    return

                # If no progress info, pass through as-is
                if event.progress is None:
                    progress_callback(event)
                    return

                # Get track index from details (0-based)
                track_idx = 0
                if event.details:
                    track_idx = event.details.get("track_index", 0)

                track_progress = event.progress

                # Calculate album-wide progress: 10 + (tracks_done / total) * 80
                # This maps download progress to the 10-90% range
                album_progress = (
                    10 + ((track_idx + track_progress / 100) / total_tracks) * 80
                )

                progress_callback(
                    ProgressEvent(
                        step=ProgressStep.DOWNLOADING,
                        message=event.message,
                        progress=album_progress,
                    )
                )

            if progress_callback:
                progress_callback(
                    ProgressEvent(
                        step=ProgressStep.DOWNLOADING,
                        message="Starting download...",
                        progress=10.0,
                    )
                )

            download_result = downloader.download_album(
                url,
                job_temp_dir,
                progress_callback=download_progress_wrapper,
                cancel_check=cancel_check,
            )

            # Check if cancelled
            if download_result.cancelled:
                return SyncResult(
                    success=False,
                    download_result=download_result,
                    album_info=album_info,
                    error="Download cancelled",
                )

            if not download_result.success:
                if progress_callback:
                    progress_callback(
                        ProgressEvent(
                            step=ProgressStep.FAILED,
                            message=download_result.error or "Download failed",
                        )
                    )
                return SyncResult(
                    success=False,
                    download_result=download_result,
                    album_info=album_info,
                    error=download_result.error or "Download failed",
                )

            # Download complete - progress at 90%
            if progress_callback:
                track_count = len(download_result.downloaded_files)
                progress_callback(
                    ProgressEvent(
                        step=ProgressStep.DOWNLOADING,
                        message=f"Downloaded {track_count} tracks",
                        progress=90.0,
                    )
                )

            # Get real bitrate from downloaded file
            if download_result.downloaded_files and album_info:
                real_bitrate = _get_file_bitrate(
                    Path(download_result.downloaded_files[0])
                )
                if real_bitrate:
                    album_info.audio_bitrate = real_bitrate

            # Phase 3: Import/Tag (90% → 100%)
            if progress_callback:
                progress_callback(
                    ProgressEvent(
                        step=ProgressStep.IMPORTING,
                        message="Starting import...",
                        progress=90.0,
                    )
                )

            tagger = self._tagger
            audio_files = [Path(f) for f in download_result.downloaded_files]
            tag_result = tagger.tag_album(
                audio_files, progress_callback=progress_callback
            )

            if not tag_result.success:
                if progress_callback:
                    progress_callback(
                        ProgressEvent(
                            step=ProgressStep.FAILED,
                            message=tag_result.error or "Import failed",
                        )
                    )
                return SyncResult(
                    success=False,
                    download_result=download_result,
                    tag_result=tag_result,
                    album_info=album_info,
                    error=tag_result.error or "Import failed",
                )

            # Success - progress at 100%
            if progress_callback:
                progress_callback(
                    ProgressEvent(
                        step=ProgressStep.COMPLETED,
                        message=f"Sync complete: {tag_result.dest_dir}",
                        progress=100.0,
                    )
                )

            return SyncResult(
                success=True,
                download_result=download_result,
                tag_result=tag_result,
                album_info=album_info,
                destination=tag_result.dest_dir,
            )

        except Exception as e:
            # Cleanup on any unexpected failure
            if progress_callback:
                progress_callback(
                    ProgressEvent(
                        step=ProgressStep.FAILED,
                        message=str(e),
                    )
                )
            return SyncResult(
                success=False,
                album_info=album_info,
                error=str(e),
            )

        finally:
            # Cleanup temp directory
            if job_temp_dir.exists():
                shutil.rmtree(job_temp_dir, ignore_errors=True)

    def sync_playlist(
        self,
        url: str,
        job_id: str,
        progress_callback: ProgressCallback | None = None,
        cancel_check: CancelCheck | None = None,
    ) -> SyncResult:
        """
        Download and organize a playlist with metadata enrichment.

        Progress phases:
        - 0% → 10%: Enriching metadata via ytmusicapi
        - 10% → 60%: Downloading tracks via yt-dlp
        - 60% → 70%: Patching metadata with enriched data
        - 70% → 75%: Organizing files to Playlists/{name}/
        - 75% → 90%: Beets import (in place, no moves)
        - 90% → 100%: Generating M3U playlist

        Args:
            url: YouTube Music playlist URL
            job_id: Unique job identifier (used for temp directory)
            progress_callback: Optional callback for progress updates
            cancel_check: Function returning True if operation should cancel

        Returns:
            SyncResult with success status and details
        """
        job_temp_dir = self.temp_dir / job_id
        job_temp_dir.mkdir(parents=True, exist_ok=True)
        album_info: AlbumInfo | None = None

        try:
            # Phase 1: Enrich metadata via ytmusicapi (0% → 10%)
            if progress_callback:
                progress_callback(
                    ProgressEvent(
                        step=ProgressStep.FETCHING_INFO,
                        message="Enriching playlist metadata...",
                        progress=0.0,
                    )
                )

            playlist_id = extract_playlist_id(url)
            if not playlist_id:
                return SyncResult(
                    success=False,
                    error="Could not extract playlist ID from URL",
                )

            try:
                enricher = MetadataEnricher()
                playlist_meta = enricher.get_playlist(playlist_id)
            except Exception as e:
                logger.error("Failed to enrich playlist metadata: {}", e)
                return SyncResult(
                    success=False,
                    error=f"Failed to fetch playlist metadata: {e}",
                )

            if not playlist_meta.tracks:
                return SyncResult(
                    success=False,
                    error="No available tracks in playlist",
                )

            # Create AlbumInfo for progress updates (reuse existing model)
            album_info = AlbumInfo(
                title=playlist_meta.title,
                artist="Various Artists",
                track_count=playlist_meta.track_count,
                playlist_id=playlist_id,
                url=url,
            )

            if progress_callback:
                msg = f"Found {playlist_meta.track_count} tracks: {playlist_meta.title}"
                progress_callback(
                    ProgressEvent(
                        step=ProgressStep.FETCHING_INFO,
                        message=msg,
                        progress=10.0,
                        details={"album_info": album_info.model_dump()},
                    )
                )

            # Check cancellation
            if cancel_check and cancel_check():
                return SyncResult(
                    success=False,
                    album_info=album_info,
                    error="Cancelled",
                )

            # Phase 2: Download via yt-dlp (10% → 60%)
            total_tracks = playlist_meta.track_count

            def download_progress_wrapper(event: ProgressEvent) -> None:
                if not progress_callback:
                    return
                if event.progress is None:
                    progress_callback(event)
                    return

                track_idx = event.details.get("track_index", 0) if event.details else 0
                track_progress = event.progress
                # Map to 10-60% range
                overall = 10 + ((track_idx + track_progress / 100) / total_tracks) * 50
                progress_callback(
                    ProgressEvent(
                        step=ProgressStep.DOWNLOADING,
                        message=event.message,
                        progress=overall,
                    )
                )

            if progress_callback:
                progress_callback(
                    ProgressEvent(
                        step=ProgressStep.DOWNLOADING,
                        message="Starting download...",
                        progress=10.0,
                    )
                )

            download_result = self._downloader.download_album(
                url,
                job_temp_dir,
                progress_callback=download_progress_wrapper,
                cancel_check=cancel_check,
            )

            if download_result.cancelled:
                return SyncResult(
                    success=False,
                    download_result=download_result,
                    album_info=album_info,
                    error="Download cancelled",
                )

            if not download_result.success:
                return SyncResult(
                    success=False,
                    download_result=download_result,
                    album_info=album_info,
                    error=download_result.error or "Download failed",
                )

            downloaded_files = sorted(
                [Path(f) for f in download_result.downloaded_files]
            )

            if progress_callback:
                progress_callback(
                    ProgressEvent(
                        step=ProgressStep.DOWNLOADING,
                        message=f"Downloaded {len(downloaded_files)} tracks",
                        progress=60.0,
                    )
                )

            # Phase 3: Patch metadata (60% → 70%)
            if progress_callback:
                progress_callback(
                    ProgressEvent(
                        step=ProgressStep.IMPORTING,
                        message="Patching track metadata...",
                        progress=60.0,
                    )
                )

            patcher = MetadataPatcher()
            patcher.patch_files(
                downloaded_files, playlist_meta.tracks, playlist_meta.title
            )

            if progress_callback:
                progress_callback(
                    ProgressEvent(
                        step=ProgressStep.IMPORTING,
                        message="Metadata patched",
                        progress=70.0,
                    )
                )

            # Phase 4: Organize files to Playlists/{name}/ (70% → 75%)
            if progress_callback:
                progress_callback(
                    ProgressEvent(
                        step=ProgressStep.IMPORTING,
                        message="Organizing files...",
                        progress=70.0,
                    )
                )

            playlist_dir = self.playlists_dir / sanitize_filename(playlist_meta.title)
            playlist_dir.mkdir(parents=True, exist_ok=True)

            final_files: list[Path] = []
            for downloaded_file, track in zip(
                downloaded_files, playlist_meta.tracks, strict=False
            ):
                # New filename: "01 - Artist - Title.opus"
                safe_artist = sanitize_filename(track.artist)
                safe_title = sanitize_filename(track.title)
                new_name = (
                    f"{track.track_number:02d} - {safe_artist} - "
                    f"{safe_title}{downloaded_file.suffix}"
                )
                dest = playlist_dir / new_name
                shutil.move(str(downloaded_file), str(dest))
                final_files.append(dest)

            if progress_callback:
                progress_callback(
                    ProgressEvent(
                        step=ProgressStep.IMPORTING,
                        message=f"Files organized to {playlist_dir.name}/",
                        progress=75.0,
                    )
                )

            # Phase 5: Beets import in place (75% → 90%)
            if progress_callback:
                progress_callback(
                    ProgressEvent(
                        step=ProgressStep.IMPORTING,
                        message="Running beets enrichment...",
                        progress=75.0,
                    )
                )

            tag_result = self._tagger.tag_playlist(
                final_files, progress_callback=progress_callback
            )

            # Beets failure is non-fatal for playlists (metadata already patched)
            if not tag_result.success:
                logger.warning(
                    "Beets enrichment failed (non-fatal): {}", tag_result.error
                )

            if progress_callback:
                progress_callback(
                    ProgressEvent(
                        step=ProgressStep.IMPORTING,
                        message="Beets enrichment complete",
                        progress=90.0,
                    )
                )

            # Phase 6: Generate M3U (90% → 100%)
            if progress_callback:
                progress_callback(
                    ProgressEvent(
                        step=ProgressStep.IMPORTING,
                        message="Generating playlist file...",
                        progress=90.0,
                    )
                )

            generate_m3u(
                playlist_meta.title, final_files, playlist_meta.tracks, playlist_dir
            )

            # Success
            if progress_callback:
                progress_callback(
                    ProgressEvent(
                        step=ProgressStep.COMPLETED,
                        message=f"Sync complete: {playlist_dir}",
                        progress=100.0,
                    )
                )

            return SyncResult(
                success=True,
                download_result=download_result,
                tag_result=tag_result,
                album_info=album_info,
                destination=str(playlist_dir),
            )

        except Exception as e:
            logger.exception("Playlist sync failed")
            if progress_callback:
                progress_callback(
                    ProgressEvent(
                        step=ProgressStep.FAILED,
                        message=str(e),
                    )
                )
            return SyncResult(
                success=False,
                album_info=album_info,
                error=str(e),
            )

        finally:
            # Cleanup temp directory
            if job_temp_dir.exists():
                shutil.rmtree(job_temp_dir, ignore_errors=True)
