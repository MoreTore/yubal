"""Job execution orchestration service."""

import asyncio
import logging
from datetime import UTC, datetime
from functools import partial
from pathlib import Path
from typing import Any

from yubal import CancelToken, cleanup_part_files

from yubal_api.domain.enums import JobKind, JobStatus, ProgressStep
from yubal_api.domain.job import ContentInfo, Job
from yubal_api.services.protocols import JobExecutionStore
from yubal_api.services.discography import DiscographyResult, DiscographyService
from yubal_api.services.metadata import MetadataResolver
from yubal_api.services.sync import ProgressCallback, SyncService

logger = logging.getLogger(__name__)

PROGRESS_COMPLETE = 100.0


class JobExecutor:
    """Orchestrates job execution lifecycle.

    This executor manages background job execution with proper cleanup and
    cancellation support. Jobs run in a thread pool to avoid blocking the
    async event loop during I/O-heavy operations (yt-dlp downloads).

    Key Responsibilities:
        - Background task lifecycle (creation, tracking, cleanup)
        - Cancellation via CancelToken registry
        - Job queue continuation (starts next pending job when one completes)
        - Progress callback wiring to update job store

    Architecture Notes:
        - Uses JobExecutionStore protocol for persistence (ISP compliance)
        - CancelToken is the single source of truth for cancellation
        - Tasks are tracked in a set to prevent garbage collection
    """

    def __init__(
        self,
        job_store: JobExecutionStore,
        base_path: Path,
        audio_format: str = "opus",
        cookies_path: Path | None = None,
        fetch_lyrics: bool = True,
    ) -> None:
        """Initialize the job executor.

        Args:
            job_store: Store for job persistence (protocol-based for testability).
            base_path: Base directory for downloaded files.
            audio_format: Target audio format (opus, mp3, m4a).
            cookies_path: Optional path to cookies.txt for authenticated requests.
            fetch_lyrics: Whether to fetch lyrics from lrclib.net.
        """
        self._job_store = job_store
        self._base_path = base_path
        self._audio_format = audio_format
        self._cookies_path = cookies_path
        self._fetch_lyrics = fetch_lyrics

        # Track background tasks to prevent GC during execution
        self._background_tasks: set[asyncio.Task[Any]] = set()
        self._metadata_tasks: set[asyncio.Task[Any]] = set()
        # Map job_id -> CancelToken for cancellation support
        self._cancel_tokens: dict[str, CancelToken] = {}

    def start_job(self, job: Job) -> None:
        """Start a job as a background task.

        The task is tracked to prevent garbage collection and will
        automatically trigger the next pending job when complete.

        Args:
            job: The job to start executing.
        """
        task = asyncio.create_task(
            self._run_job(job),
            name=f"job-{job.id[:8]}",  # Helpful for debugging
        )
        self._background_tasks.add(task)
        task.add_done_callback(self._background_tasks.discard)

    def start_metadata_prefetch(self, job: Job) -> None:
        """Resolve metadata early without starting downloads."""
        task = asyncio.create_task(
            self._run_metadata_prefetch(job),
            name=f"job-meta-{job.id[:8]}",
        )
        self._metadata_tasks.add(task)
        task.add_done_callback(self._metadata_tasks.discard)

    def cancel_job(self, job_id: str) -> bool:
        """Signal cancellation for a running job.

        This sets the cancel token which will be checked during download.
        The actual job status update happens in _run_job when it detects
        the cancellation.

        Args:
            job_id: ID of the job to cancel.

        Returns:
            True if a cancel token existed (job was running), False otherwise.
        """
        token = self._cancel_tokens.get(job_id)
        if token is None:
            return False

        token.cancel()
        logger.info("Job cancellation requested: %s", job_id[:8])
        return True

    def cancel_all_jobs(self) -> int:
        """Cancel all running jobs. Used during shutdown.

        Returns:
            Number of jobs that were signalled for cancellation.
        """
        tokens = list(self._cancel_tokens.values())
        for token in tokens:
            token.cancel()
        return len(tokens)

    async def _run_metadata_prefetch(self, job: Job) -> None:
        try:
            resolver = MetadataResolver(
                audio_format=self._audio_format,
                cookies_path=self._cookies_path,
                base_path=self._base_path,
                fetch_lyrics=self._fetch_lyrics,
            )
            content_info = await asyncio.to_thread(
                resolver.resolve,
                job.url,
                kind=job.kind,
                channel_id=job.channel_id,
                max_items=job.max_items,
            )
            if content_info is None:
                return

            current = self._job_store.get(job.id)
            if (
                current is None
                or current.status.is_finished
                or current.content_info is not None
            ):
                return

            self._job_store.transition(
                job.id,
                current.status,
                content_info=content_info,
            )
        except Exception as exc:  # pragma: no cover - defensive
            logger.debug("Metadata prefetch failed for %s: %s", job.id[:8], exc)

    async def _run_job(self, job: Job) -> None:
        """Background task that runs the sync operation."""
        job_id = job.id
        cancel_token = CancelToken()
        self._cancel_tokens[job_id] = cancel_token

        try:
            # Check cancellation before starting (CancelToken is single source of truth)
            if cancel_token.is_cancelled:
                return

            self._job_store.transition(
                job_id,
                JobStatus.FETCHING_INFO,
                started_at=datetime.now(UTC),
            )

            # Create progress callback that updates job store
            loop = asyncio.get_running_loop()

            def on_progress(
                step: ProgressStep,
                _message: str,
                progress: float | None,
                details: dict[str, Any] | None,
            ) -> None:
                if cancel_token.is_cancelled:
                    return

                status = self._step_to_status(step)
                content_info = self._parse_content_info(details) if details else None

                # Skip terminal states - handled by result
                if status in (JobStatus.COMPLETED, JobStatus.FAILED):
                    return

                loop.call_soon_threadsafe(
                    partial(
                        self._job_store.transition,
                        job_id,
                        status,
                        progress=progress,
                        content_info=content_info,
                    )
                )

            # Run sync in thread pool
            sync_service = SyncService(
                self._base_path,
                self._audio_format,
                self._cookies_path,
                self._fetch_lyrics,
            )
            if job.kind == JobKind.DISCOGRAPHY:
                if not job.channel_id:
                    raise ValueError("Discography jobs require a channel_id")
                result = await asyncio.to_thread(
                    self._run_discography,
                    job,
                    cancel_token,
                    on_progress,
                )
            else:
                result = await asyncio.to_thread(
                    sync_service.run,
                    job.url,
                    on_progress,
                    cancel_token,
                    job.max_items,
                )

            # Handle result (cancelled status already set by cancel_job API)
            if cancel_token.is_cancelled:
                pass  # Status already set, cleanup happens in finally block
            elif result.success:
                self._job_store.transition(
                    job_id,
                    JobStatus.COMPLETED,
                    progress=PROGRESS_COMPLETE,
                    content_info=result.content_info,
                    download_stats=result.download_stats,
                )
            else:
                error_msg = self._result_error(result)
                logger.error("Job %s failed: %s", job_id[:8], error_msg)
                self._job_store.transition(job_id, JobStatus.FAILED)

        except Exception as e:
            logger.exception("Job %s failed with error: %s", job_id[:8], e)
            self._job_store.transition(job_id, JobStatus.FAILED)

        finally:
            # Clean up .part files if job was cancelled
            if cancel_token.is_cancelled:
                cleaned = cleanup_part_files(self._base_path)
                if cleaned:
                    logger.info("Cleaned up %d partial download(s)", cleaned)

            self._cancel_tokens.pop(job_id, None)

            # Release active job slot AFTER cleanup, then start next
            # This ensures no concurrent downloads
            self._job_store.release_active(job_id)
            self._start_next_pending()

    def _run_discography(
        self,
        job: Job,
        cancel_token: CancelToken,
        on_progress: ProgressCallback | None,
    ) -> DiscographyResult:
        service = DiscographyService(
            self._base_path,
            self._audio_format,
            self._cookies_path,
            self._fetch_lyrics,
        )
        return service.run(
            channel_id=job.channel_id or "",
            cancel_token=cancel_token,
            on_progress=on_progress,
        )

    @staticmethod
    def _result_error(result: Any) -> str:
        error = getattr(result, "error", None)
        if error:
            return error
        errors = getattr(result, "errors", None)
        if errors:
            if isinstance(errors, list):
                return "; ".join(errors)
            return str(errors)
        return "Unknown error"

    @staticmethod
    def _step_to_status(step: ProgressStep) -> JobStatus:
        """Map progress step to job status."""
        return {
            ProgressStep.FETCHING_INFO: JobStatus.FETCHING_INFO,
            ProgressStep.DOWNLOADING: JobStatus.DOWNLOADING,
            ProgressStep.IMPORTING: JobStatus.IMPORTING,
            ProgressStep.COMPLETED: JobStatus.COMPLETED,
            ProgressStep.FAILED: JobStatus.FAILED,
        }.get(step, JobStatus.DOWNLOADING)

    @staticmethod
    def _parse_content_info(details: dict[str, Any]) -> ContentInfo | None:
        """Extract content info from details dict."""
        if data := details.get("content_info"):
            try:
                return ContentInfo(**data)
            except (TypeError, ValueError) as e:
                logger.warning("Failed to parse content info: %s", e)
        return None

    def _start_next_pending(self) -> None:
        """Start the next pending job if any."""
        if next_job := self._job_store.pop_next_pending():
            self.start_job(next_job)
