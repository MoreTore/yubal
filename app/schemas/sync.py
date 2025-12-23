"""Sync operation schemas."""

from pydantic import BaseModel, HttpUrl


class SyncRequest(BaseModel):
    """Request schema for sync operation."""

    url: str  # YouTube Music URL
    audio_format: str = "mp3"


class AlbumInfoSchema(BaseModel):
    """Schema for album information."""

    title: str
    artist: str
    year: int | None = None
    track_count: int = 0


class SyncResponse(BaseModel):
    """Response schema for sync operation result."""

    success: bool
    album: AlbumInfoSchema | None = None
    destination: str | None = None
    track_count: int = 0
    error: str | None = None
