"""Sync API routes for managing playlist syncing."""

import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, status

from yubal_api.api.dependencies import SyncRepositoryDep, SyncSchedulerDep
from yubal_api.api.exceptions import (
    QueueFullError,
    SyncedPlaylistConflictError,
    SyncedPlaylistNotFoundError,
)
from yubal_api.db.models import SyncedPlaylist
from yubal_api.schemas.sync import (
    AddPlaylistRequest,
    AddPlaylistResponse,
    SyncAllResponse,
    SyncConfigResponse,
    SyncedPlaylistResponse,
    SyncedPlaylistsResponse,
    SyncJobResponse,
    SyncStatusResponse,
    UpdatePlaylistRequest,
    UpdateSyncConfigRequest,
)

router = APIRouter(prefix="/sync", tags=["sync"])


# -- Playlist Endpoints --


@router.get("/playlists", response_model=SyncedPlaylistsResponse)
async def list_playlists(repository: SyncRepositoryDep) -> SyncedPlaylistsResponse:
    """List all synced playlists."""
    playlists = repository.list_playlists()
    return SyncedPlaylistsResponse(
        playlists=[
            SyncedPlaylistResponse.model_validate(p, from_attributes=True)
            for p in playlists
        ]
    )


@router.post(
    "/playlists",
    response_model=AddPlaylistResponse,
    status_code=status.HTTP_201_CREATED,
)
async def add_playlist(
    request: AddPlaylistRequest,
    repository: SyncRepositoryDep,
) -> AddPlaylistResponse:
    """Add a playlist for syncing.

    Returns 409 Conflict if the URL is already registered.
    """
    # Check for duplicate URL
    existing = repository.get_playlist_by_url(request.url)
    if existing:
        raise SyncedPlaylistConflictError(
            f"Playlist URL already registered as '{existing.name}'"
        )

    playlist = SyncedPlaylist(
        id=str(uuid.uuid4()),
        url=request.url,
        name=request.name,
        created_at=datetime.now(UTC),
    )
    repository.add_playlist(playlist)

    return AddPlaylistResponse(id=playlist.id)


@router.get("/playlists/{playlist_id}", response_model=SyncedPlaylistResponse)
async def get_playlist(
    playlist_id: str,
    repository: SyncRepositoryDep,
) -> SyncedPlaylistResponse:
    """Get a single synced playlist."""
    playlist = repository.get_playlist(playlist_id)
    if not playlist:
        raise SyncedPlaylistNotFoundError(playlist_id)
    return SyncedPlaylistResponse.model_validate(playlist, from_attributes=True)


@router.patch("/playlists/{playlist_id}", response_model=SyncedPlaylistResponse)
async def update_playlist(
    playlist_id: str,
    request: UpdatePlaylistRequest,
    repository: SyncRepositoryDep,
) -> SyncedPlaylistResponse:
    """Update a synced playlist's name or enabled status."""
    updates = request.model_dump(exclude_unset=True)
    if not updates:
        # No updates provided, just return current state
        playlist = repository.get_playlist(playlist_id)
        if not playlist:
            raise SyncedPlaylistNotFoundError(playlist_id)
        return SyncedPlaylistResponse.model_validate(playlist, from_attributes=True)

    playlist = repository.update_playlist(playlist_id, **updates)
    if not playlist:
        raise SyncedPlaylistNotFoundError(playlist_id)
    return SyncedPlaylistResponse.model_validate(playlist, from_attributes=True)


@router.delete("/playlists/{playlist_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_playlist(
    playlist_id: str,
    repository: SyncRepositoryDep,
) -> None:
    """Remove a playlist from syncing."""
    if not repository.delete_playlist(playlist_id):
        raise SyncedPlaylistNotFoundError(playlist_id)


# -- Sync Job Endpoints --


@router.post("/playlists/{playlist_id}/sync", response_model=SyncJobResponse)
async def sync_playlist(
    playlist_id: str,
    scheduler: SyncSchedulerDep,
) -> SyncJobResponse:
    """Create a sync job for a specific playlist.

    Returns 404 if playlist not found, 409 if queue is full.
    """
    job_id = scheduler.sync_playlist(playlist_id)
    if job_id is None:
        # Check if it's a not-found or queue-full situation
        playlist = scheduler._repository.get_playlist(playlist_id)
        if not playlist:
            raise SyncedPlaylistNotFoundError(playlist_id)
        raise QueueFullError()
    return SyncJobResponse(job_id=job_id)


@router.post("/run", response_model=SyncAllResponse)
async def sync_all(scheduler: SyncSchedulerDep) -> SyncAllResponse:
    """Create sync jobs for all enabled playlists."""
    job_ids = scheduler.sync_all()
    count = len(job_ids)
    if count == 0:
        message = "No enabled playlists to sync"
    elif count == 1:
        message = "Created 1 sync job"
    else:
        message = f"Created {count} sync jobs"
    return SyncAllResponse(job_ids=job_ids, message=message)


# -- Config Endpoints --


@router.get("/config", response_model=SyncConfigResponse)
async def get_config(repository: SyncRepositoryDep) -> SyncConfigResponse:
    """Get sync configuration."""
    config = repository.get_config()
    return SyncConfigResponse(
        enabled=config.enabled,
        interval_minutes=config.interval_minutes,
    )


@router.patch("/config", response_model=SyncConfigResponse)
async def update_config(
    request: UpdateSyncConfigRequest,
    repository: SyncRepositoryDep,
) -> SyncConfigResponse:
    """Update sync configuration."""
    updates = request.model_dump(exclude_unset=True)
    config = repository.update_config(**updates)
    return SyncConfigResponse(
        enabled=config.enabled,
        interval_minutes=config.interval_minutes,
    )


# -- Status Endpoint --


@router.get("/status", response_model=SyncStatusResponse)
async def get_status(
    repository: SyncRepositoryDep,
    scheduler: SyncSchedulerDep,
) -> SyncStatusResponse:
    """Get scheduler status and summary."""
    config = repository.get_config()
    playlists = repository.list_playlists()
    enabled_count = sum(1 for p in playlists if p.enabled)

    return SyncStatusResponse(
        scheduler_running=scheduler.is_running,
        config=SyncConfigResponse(
            enabled=config.enabled,
            interval_minutes=config.interval_minutes,
        ),
        playlist_count=len(playlists),
        enabled_playlist_count=enabled_count,
    )
