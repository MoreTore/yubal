"""Sync API routes."""

import asyncio
import json
from collections.abc import AsyncGenerator

from fastapi import APIRouter
from fastapi.responses import StreamingResponse

from app.core.config import DEFAULT_BEETS_CONFIG, DEFAULT_LIBRARY_DIR
from app.core.progress import ProgressEvent
from app.schemas.progress import ProgressEventSchema
from app.schemas.sync import AlbumInfoSchema, SyncRequest, SyncResponse
from app.services.sync import SyncService

router = APIRouter()


@router.post("/sync")
async def sync_album(request: SyncRequest) -> StreamingResponse:
    """
    Sync an album from YouTube Music.

    Downloads and tags the album, streaming progress updates via SSE.

    Returns:
        StreamingResponse with SSE events for progress updates,
        ending with a final result event.
    """

    async def event_generator() -> AsyncGenerator[str, None]:
        queue: asyncio.Queue[ProgressEvent | None] = asyncio.Queue()

        def progress_callback(event: ProgressEvent) -> None:
            """Thread-safe callback that puts events in the queue."""
            queue.put_nowait(event)

        async def run_sync():
            """Run the sync operation in a thread."""
            service = SyncService(
                library_dir=DEFAULT_LIBRARY_DIR,
                beets_config=DEFAULT_BEETS_CONFIG,
                audio_format=request.audio_format,
            )
            result = await asyncio.to_thread(
                service.sync_album,
                request.url,
                progress_callback,
            )
            # Signal completion
            queue.put_nowait(None)
            return result

        # Start the sync task
        task = asyncio.create_task(run_sync())

        # Stream progress events
        while True:
            try:
                event = await asyncio.wait_for(queue.get(), timeout=1.0)
            except asyncio.TimeoutError:
                # Send keepalive comment
                yield ": keepalive\n\n"
                continue

            if event is None:
                # Sync completed, break out of loop
                break

            # Convert event to schema and send
            event_data = ProgressEventSchema(
                step=event.step.value,
                message=event.message,
                progress=event.progress,
                details=event.details if event.details else None,
            )
            yield f"data: {event_data.model_dump_json()}\n\n"

        # Get the final result
        result = await task

        # Build response schema
        album_schema = None
        if result.album_info:
            album_schema = AlbumInfoSchema(
                title=result.album_info.title,
                artist=result.album_info.artist,
                year=result.album_info.year,
                track_count=result.album_info.track_count,
            )

        response = SyncResponse(
            success=result.success,
            album=album_schema,
            destination=str(result.destination) if result.destination else None,
            track_count=result.tag_result.track_count if result.tag_result else 0,
            error=result.error,
        )

        # Send final result event
        yield f"event: complete\ndata: {response.model_dump_json()}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # Disable nginx buffering
        },
    )


@router.post("/sync/blocking")
async def sync_album_blocking(request: SyncRequest) -> SyncResponse:
    """
    Sync an album from YouTube Music (blocking).

    Downloads and tags the album, returning the final result.
    Use /sync for streaming progress updates.

    Returns:
        SyncResponse with the operation result.
    """
    service = SyncService(
        library_dir=DEFAULT_LIBRARY_DIR,
        beets_config=DEFAULT_BEETS_CONFIG,
        audio_format=request.audio_format,
    )

    result = await asyncio.to_thread(
        service.sync_album,
        request.url,
        None,  # No progress callback for blocking mode
    )

    album_schema = None
    if result.album_info:
        album_schema = AlbumInfoSchema(
            title=result.album_info.title,
            artist=result.album_info.artist,
            year=result.album_info.year,
            track_count=result.album_info.track_count,
        )

    return SyncResponse(
        success=result.success,
        album=album_schema,
        destination=str(result.destination) if result.destination else None,
        track_count=result.tag_result.track_count if result.tag_result else 0,
        error=result.error,
    )
