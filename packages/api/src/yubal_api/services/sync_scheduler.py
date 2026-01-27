"""Background scheduler for automatic playlist syncing."""

from __future__ import annotations

import asyncio
import logging
from datetime import UTC, datetime
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from yubal_api.db.repository import SyncRepository
    from yubal_api.services.job_store import JobStore

logger = logging.getLogger(__name__)


class SyncScheduler:
    """Background scheduler that periodically creates sync jobs for enabled playlists.

    The scheduler runs in a background asyncio task and creates jobs at the
    configured interval. Jobs are processed through the existing job system,
    which automatically skips files that already exist.
    """

    def __init__(self, repository: SyncRepository, job_store: JobStore) -> None:
        """Initialize the scheduler.

        Args:
            repository: Database repository for sync configuration.
            job_store: Job store for creating sync jobs.
        """
        self._repository = repository
        self._job_store = job_store
        self._task: asyncio.Task[None] | None = None
        self._stop_event: asyncio.Event | None = None

    @property
    def is_running(self) -> bool:
        """Check if the scheduler is currently running."""
        return self._task is not None and not self._task.done()

    def start(self) -> None:
        """Start the scheduler background task."""
        if self.is_running:
            logger.warning("Scheduler already running")
            return

        self._stop_event = asyncio.Event()
        self._task = asyncio.create_task(self._run_loop())
        logger.info("Sync scheduler started")

    async def stop(self) -> None:
        """Stop the scheduler and wait for cleanup."""
        if not self._task or not self._stop_event:
            return

        self._stop_event.set()
        self._task.cancel()
        try:
            await self._task
        except asyncio.CancelledError:
            pass
        finally:
            self._task = None
            self._stop_event = None
            logger.info("Sync scheduler stopped")

    async def _run_loop(self) -> None:
        """Main scheduler loop.

        Waits for the configured interval before syncing, so the first sync
        doesn't run immediately on startup.
        """
        assert self._stop_event is not None

        while not self._stop_event.is_set():
            config = self._repository.get_config()

            # Wait first, then sync
            try:
                await asyncio.wait_for(
                    self._stop_event.wait(),
                    timeout=config.interval_minutes * 60,
                )
            except TimeoutError:
                pass

            if config.enabled and not self._stop_event.is_set():
                job_ids = self._sync_all_enabled()
                if job_ids:
                    logger.info("Scheduled sync created %d jobs", len(job_ids))

    def _sync_all_enabled(self) -> list[str]:
        """Create sync jobs for all enabled playlists.

        Returns:
            List of created job IDs.
        """
        job_ids: list[str] = []
        now = datetime.now(UTC)
        for playlist in self._repository.list_enabled_playlists():
            result = self._job_store.create(playlist.url)
            if result:
                job, _ = result
                self._repository.update_playlist(
                    playlist.id, last_job_id=job.id, last_sync_at=now
                )
                job_ids.append(job.id)
                logger.debug(
                    "Created sync job %s for playlist %s", job.id[:8], playlist.name
                )
        return job_ids

    def sync_playlist(self, playlist_id: str) -> str | None:
        """Create a sync job for a specific playlist.

        Args:
            playlist_id: The playlist ID to sync.

        Returns:
            The job ID if created, None if playlist not found or queue full.
        """
        playlist = self._repository.get_playlist(playlist_id)
        if not playlist:
            return None

        result = self._job_store.create(playlist.url)
        if not result:
            return None

        job, _ = result
        now = datetime.now(UTC)
        self._repository.update_playlist(
            playlist_id, last_job_id=job.id, last_sync_at=now
        )
        logger.info("Created sync job %s for playlist %s", job.id[:8], playlist.name)
        return job.id

    def sync_all(self) -> list[str]:
        """Create sync jobs for all enabled playlists immediately.

        Returns:
            List of created job IDs.
        """
        job_ids = self._sync_all_enabled()
        if job_ids:
            logger.info("Manual sync created %d jobs", len(job_ids))
        return job_ids
