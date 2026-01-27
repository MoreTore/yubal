"""SQLModel table definitions for sync feature."""

from datetime import datetime

from sqlmodel import Field, SQLModel


class SyncedPlaylist(SQLModel, table=True):
    """A playlist registered for automatic syncing."""

    __tablename__ = "synced_playlist"

    id: str = Field(primary_key=True)
    url: str = Field(unique=True, index=True)
    name: str
    thumbnail_url: str | None = None
    enabled: bool = Field(default=True)
    created_at: datetime
    last_job_id: str | None = None
    last_sync_at: datetime | None = None


class SyncConfig(SQLModel, table=True):
    """Global sync configuration (singleton row)."""

    __tablename__ = "sync_config"

    id: int = Field(default=1, primary_key=True)
    enabled: bool = Field(default=True)
    interval_minutes: int = Field(default=60)
