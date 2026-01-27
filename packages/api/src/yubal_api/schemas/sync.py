"""Sync API schemas."""

from datetime import datetime

from pydantic import BaseModel, Field

from yubal_api.schemas.jobs import YouTubeMusicUrl

# -- Playlist Schemas --


class SyncedPlaylistResponse(BaseModel):
    """Response for a synced playlist."""

    id: str
    url: str
    name: str
    thumbnail_url: str | None = None
    enabled: bool
    created_at: datetime
    last_job_id: str | None = None
    last_sync_at: datetime | None = None


class SyncedPlaylistsResponse(BaseModel):
    """Response for listing synced playlists."""

    playlists: list[SyncedPlaylistResponse]


class AddPlaylistRequest(BaseModel):
    """Request to add a playlist for syncing."""

    url: YouTubeMusicUrl = Field(
        description="YouTube or YouTube Music playlist URL",
        examples=["https://music.youtube.com/playlist?list=OLAK5uy_..."],
    )
    name: str = Field(
        description="Display name for the playlist",
        min_length=1,
        max_length=200,
    )


class AddPlaylistResponse(BaseModel):
    """Response when a playlist is added."""

    id: str
    message: str = "Playlist added"


class UpdatePlaylistRequest(BaseModel):
    """Request to update a synced playlist."""

    name: str | None = Field(
        default=None,
        description="New display name",
        min_length=1,
        max_length=200,
    )
    enabled: bool | None = Field(
        default=None,
        description="Whether to include in scheduled syncs",
    )


# -- Sync Job Schemas --


class SyncJobResponse(BaseModel):
    """Response when a sync job is created."""

    job_id: str
    message: str = "Sync job created"


class SyncAllResponse(BaseModel):
    """Response when sync jobs are created for all playlists."""

    job_ids: list[str]
    message: str


# -- Config Schemas --


class SyncConfigResponse(BaseModel):
    """Response for sync configuration."""

    enabled: bool
    interval_minutes: int


class UpdateSyncConfigRequest(BaseModel):
    """Request to update sync configuration."""

    enabled: bool | None = Field(
        default=None,
        description="Master switch for scheduled syncing",
    )
    interval_minutes: int | None = Field(
        default=None,
        ge=5,
        le=10080,  # 1 week
        description="Minutes between sync runs (5-10080)",
    )


# -- Status Schemas --


class SyncStatusResponse(BaseModel):
    """Response for scheduler status."""

    scheduler_running: bool
    config: SyncConfigResponse
    playlist_count: int
    enabled_playlist_count: int
