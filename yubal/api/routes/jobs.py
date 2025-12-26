"""Jobs API routes."""

import asyncio
from collections.abc import AsyncGenerator
from datetime import UTC, datetime

from fastapi import APIRouter, BackgroundTasks, HTTPException, status
from fastapi.responses import StreamingResponse

from yubal.core.config import DEFAULT_BEETS_CONFIG, DEFAULT_LIBRARY_DIR
from yubal.core.jobs import Job, JobPhase, job_store
from yubal.core.models import AlbumInfo
from yubal.core.progress import ProgressEvent
from yubal.schemas.jobs import (
    CancelJobResponse,
    ClearJobsResponse,
    CreateJobRequest,
    JobConflictError,
    JobCreatedResponse,
    JobListResponse,
    JobResponse,
    LogEntrySchema,
)
from yubal.services.sync import SyncService

router = APIRouter()


def job_to_response(job: Job) -> JobResponse:
    """Convert Job dataclass to JobResponse schema."""
    return JobResponse(
        id=job.id,
        url=job.url,
        audio_format=job.audio_format,
        status=job.phase.value,  # Internal: phase, API: status
        progress=job.progress,
        message=job.message,
        album_info=job.album_info,
        current_track=job.current_track,
        total_tracks=job.total_tracks,
        logs=[
            LogEntrySchema(
                timestamp=log.timestamp,
                step=log.step,
                message=log.message,
                progress=log.progress,
                details=log.details,
            )
            for log in job.logs
        ],
        error=job.error,
        created_at=job.created_at,
        started_at=job.started_at,
        completed_at=job.completed_at,
    )


async def run_sync_job(job_id: str, url: str, audio_format: str) -> None:
    """Background task that runs the sync operation."""
    # Check if cancelled before starting
    if job_store.is_cancelled(job_id):
        return

    # Update job to started (fetching info phase)
    await job_store.update_job(
        job_id,
        phase=JobPhase.FETCHING_INFO,
        started_at=datetime.now(UTC),
        message="Fetching album info...",
    )
    await job_store.add_log(job_id, "starting", f"Starting sync from: {url}")

    # Capture the event loop BEFORE entering the thread
    loop = asyncio.get_running_loop()

    def cancel_check() -> bool:
        """Check if job has been cancelled."""
        return job_store.is_cancelled(job_id)

    def progress_callback(event: ProgressEvent) -> None:
        """Thread-safe callback that updates job state."""
        # Skip updates for cancelled jobs
        if job_store.is_cancelled(job_id):
            return

        # Map ProgressStep to JobPhase
        phase_map = {
            "starting": JobPhase.FETCHING_INFO,
            "downloading": JobPhase.DOWNLOADING,
            "tagging": JobPhase.IMPORTING,
            "complete": JobPhase.COMPLETED,
            "error": JobPhase.FAILED,
        }

        new_phase = phase_map.get(event.step.value, JobPhase.DOWNLOADING)

        # Schedule async update using the captured loop
        loop.call_soon_threadsafe(
            lambda: asyncio.create_task(
                _update_job_from_event(job_id, new_phase, event)
            )
        )

    try:
        service = SyncService(
            library_dir=DEFAULT_LIBRARY_DIR,
            beets_config=DEFAULT_BEETS_CONFIG,
            audio_format=audio_format,
        )

        result = await asyncio.to_thread(
            service.sync_album,
            url,
            progress_callback,
            cancel_check,
        )

        # Check if job was cancelled
        if job_store.is_cancelled(job_id):
            await job_store.add_log(job_id, "cancelled", "Job cancelled by user")
            return

        # Update job with final result
        if result.success:
            # Build completion message
            if result.destination:
                complete_msg = f"Sync complete: {result.destination}"
            elif result.album_info:
                complete_msg = f"Sync complete: {result.album_info.title}"
            else:
                complete_msg = "Sync complete"

            await job_store.update_job(
                job_id,
                phase=JobPhase.COMPLETED,
                progress=100.0,
                message=complete_msg,
                album_info=result.album_info,
            )
            await job_store.add_log(
                job_id,
                "complete",
                complete_msg,
                progress=100.0,
                details={
                    "destination": str(result.destination)
                    if result.destination
                    else None,
                    "track_count": result.tag_result.track_count
                    if result.tag_result
                    else 0,
                },
            )
        else:
            await job_store.update_job(
                job_id,
                phase=JobPhase.FAILED,
                message=result.error or "Sync failed",
                error=result.error,
            )
            await job_store.add_log(job_id, "error", result.error or "Sync failed")

    except Exception as e:
        await job_store.update_job(
            job_id,
            phase=JobPhase.FAILED,
            message=str(e),
            error=str(e),
        )
        await job_store.add_log(job_id, "error", str(e))


async def _update_job_from_event(
    job_id: str, new_phase: JobPhase, event: ProgressEvent
) -> None:
    """Helper to update job from progress event."""
    # Don't update cancelled jobs - prevents race condition with status overwrite
    if job_store.is_cancelled(job_id):
        return

    # Don't update to complete/failed from callback - final result handles that
    if new_phase in (JobPhase.COMPLETED, JobPhase.FAILED):
        new_phase = (
            JobPhase.IMPORTING
            if event.step.value == "tagging"
            else JobPhase.DOWNLOADING
        )

    # Extract track info and album_info from event details
    details = event.details or {}
    current_track = details.get("current_track")
    total_tracks = details.get("total_tracks")

    # Parse album_info if provided as dict (from STARTING event)
    album_info_data = details.get("album_info")
    album_info = None
    if album_info_data and isinstance(album_info_data, dict):
        try:
            album_info = AlbumInfo(**album_info_data)
        except Exception:  # noqa: S110
            pass  # Ignore invalid album_info - non-critical data

    await job_store.update_job(
        job_id,
        phase=new_phase,
        progress=event.progress if event.progress is not None else None,
        message=event.message,
        current_track=current_track,
        total_tracks=total_tracks,
        album_info=album_info,
    )
    await job_store.add_log(
        job_id,
        event.step.value,
        event.message,
        progress=event.progress,
        details=event.details if event.details else None,
    )


@router.post(
    "/jobs",
    response_model=JobCreatedResponse,
    status_code=status.HTTP_201_CREATED,
    responses={409: {"model": JobConflictError, "description": "Job already running"}},
)
async def create_job(
    request: CreateJobRequest,
    background_tasks: BackgroundTasks,
) -> JobCreatedResponse:
    """
    Create a new sync job.

    Only one job can run at a time. If a job is already running,
    returns 409 Conflict with the active job ID.
    """
    job = await job_store.create_job(request.url, request.audio_format)

    if job is None:
        active_job = await job_store.get_active_job()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "error": "A job is already running",
                "active_job_id": active_job.id if active_job else None,
            },
        )

    # Start the sync in the background
    background_tasks.add_task(run_sync_job, job.id, request.url, request.audio_format)

    return JobCreatedResponse(id=job.id)


@router.get("/jobs", response_model=JobListResponse)
async def list_jobs() -> JobListResponse:
    """
    List all jobs (most recent first).

    Returns up to 50 jobs with their current status.
    """
    jobs = await job_store.get_all_jobs()
    active_job = await job_store.get_active_job()

    return JobListResponse(
        jobs=[job_to_response(j) for j in jobs],
        active_job_id=active_job.id if active_job else None,
    )


@router.get("/jobs/{job_id}", response_model=JobResponse)
async def get_job(job_id: str) -> JobResponse:
    """
    Get a specific job by ID.
    """
    job = await job_store.get_job(job_id)
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Job {job_id} not found",
        )
    return job_to_response(job)


@router.post("/jobs/{job_id}/cancel", response_model=CancelJobResponse)
async def cancel_job(job_id: str) -> CancelJobResponse:
    """
    Cancel a running job.

    Returns 404 if job not found, 409 if job already finished.
    """
    job = await job_store.get_job(job_id)
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Job {job_id} not found",
        )

    if job.phase in (JobPhase.COMPLETED, JobPhase.FAILED, JobPhase.CANCELLED):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Job already finished",
        )

    success = await job_store.cancel_job(job_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Could not cancel job",
        )

    return CancelJobResponse()


@router.get("/jobs/{job_id}/stream")
async def stream_job(job_id: str) -> StreamingResponse:
    """
    Stream job progress updates via SSE.

    Immediately sends current job state, then streams updates until
    job completes or client disconnects.
    """
    job = await job_store.get_job(job_id)
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Job {job_id} not found",
        )

    async def event_generator() -> AsyncGenerator[str, None]:
        event_id = 0
        last_progress = -1.0
        last_phase = ""

        while True:
            current_job = await job_store.get_job(job_id)
            if not current_job:
                break

            # Send update if progress or phase changed
            if (
                current_job.progress != last_progress
                or current_job.phase.value != last_phase
            ):
                last_progress = current_job.progress
                last_phase = current_job.phase.value

                event_id += 1
                response = job_to_response(current_job)
                yield f"id: {event_id}\ndata: {response.model_dump_json()}\n\n"

                # If job is finished, send complete event and exit
                if current_job.phase in (
                    JobPhase.COMPLETED,
                    JobPhase.FAILED,
                    JobPhase.CANCELLED,
                ):
                    event_id += 1
                    data = response.model_dump_json()
                    yield f"id: {event_id}\nevent: complete\ndata: {data}\n\n"
                    break

            # Wait before next poll
            await asyncio.sleep(0.5)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.delete("/jobs", response_model=ClearJobsResponse)
async def clear_jobs() -> ClearJobsResponse:
    """
    Clear all completed/failed jobs.

    Running jobs are not affected.
    """
    count = await job_store.clear_completed()
    return ClearJobsResponse(cleared=count)


@router.delete("/jobs/{job_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_job(job_id: str) -> None:
    """
    Delete a completed, failed, or cancelled job.

    Running jobs cannot be deleted (returns 409).
    """
    job = await job_store.get_job(job_id)
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Job {job_id} not found",
        )

    if job.phase not in (JobPhase.COMPLETED, JobPhase.FAILED, JobPhase.CANCELLED):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot delete a running job",
        )

    await job_store.delete_job(job_id)
