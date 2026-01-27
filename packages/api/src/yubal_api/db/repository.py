"""Repository for sync-related database operations."""

from datetime import datetime

from sqlalchemy import Engine
from sqlmodel import Session, col, select

from yubal_api.db.models import SyncConfig, SyncedPlaylist


class SyncRepository:
    """Repository for sync-related database operations."""

    def __init__(self, engine: Engine) -> None:
        self._engine = engine

    # --- Playlists ---

    def add_playlist(self, playlist: SyncedPlaylist) -> SyncedPlaylist:
        """Add a new synced playlist.

        Args:
            playlist: The playlist to add.

        Returns:
            The added playlist with any database-generated fields.
        """
        with Session(self._engine) as session:
            session.add(playlist)
            session.commit()
            session.refresh(playlist)
            return playlist

    def get_playlist(self, playlist_id: str) -> SyncedPlaylist | None:
        """Get a playlist by ID.

        Args:
            playlist_id: The playlist ID.

        Returns:
            The playlist if found, None otherwise.
        """
        with Session(self._engine) as session:
            return session.get(SyncedPlaylist, playlist_id)

    def get_playlist_by_url(self, url: str) -> SyncedPlaylist | None:
        """Get a playlist by URL.

        Args:
            url: The playlist URL.

        Returns:
            The playlist if found, None otherwise.
        """
        with Session(self._engine) as session:
            statement = select(SyncedPlaylist).where(SyncedPlaylist.url == url)
            return session.exec(statement).first()

    def list_playlists(self) -> list[SyncedPlaylist]:
        """List all synced playlists.

        Returns:
            List of all playlists ordered by creation time.
        """
        with Session(self._engine) as session:
            statement = select(SyncedPlaylist).order_by(
                col(SyncedPlaylist.created_at).desc()
            )
            return list(session.exec(statement).all())

    def list_enabled_playlists(self) -> list[SyncedPlaylist]:
        """List all enabled synced playlists.

        Returns:
            List of enabled playlists.
        """
        with Session(self._engine) as session:
            statement = select(SyncedPlaylist).where(SyncedPlaylist.enabled == True)  # noqa: E712
            return list(session.exec(statement).all())

    def update_playlist(
        self, playlist_id: str, **updates: str | bool | datetime | None
    ) -> SyncedPlaylist | None:
        """Update a playlist's fields.

        Args:
            playlist_id: The playlist ID.
            **updates: Fields to update.

        Returns:
            The updated playlist if found, None otherwise.
        """
        with Session(self._engine) as session:
            playlist = session.get(SyncedPlaylist, playlist_id)
            if not playlist:
                return None
            for key, value in updates.items():
                setattr(playlist, key, value)
            session.add(playlist)
            session.commit()
            session.refresh(playlist)
            return playlist

    def delete_playlist(self, playlist_id: str) -> bool:
        """Delete a playlist.

        Args:
            playlist_id: The playlist ID.

        Returns:
            True if deleted, False if not found.
        """
        with Session(self._engine) as session:
            playlist = session.get(SyncedPlaylist, playlist_id)
            if not playlist:
                return False
            session.delete(playlist)
            session.commit()
            return True

    # --- Config ---

    def get_config(self) -> SyncConfig:
        """Get the sync configuration, creating default if needed.

        Returns:
            The sync configuration.
        """
        with Session(self._engine) as session:
            config = session.get(SyncConfig, 1)
            if not config:
                config = SyncConfig(id=1)
                session.add(config)
                session.commit()
                session.refresh(config)
            return config

    def update_config(self, **updates: bool | int) -> SyncConfig:
        """Update the sync configuration.

        Args:
            **updates: Fields to update (enabled, interval_minutes).

        Returns:
            The updated configuration.
        """
        with Session(self._engine) as session:
            config = session.get(SyncConfig, 1)
            if not config:
                config = SyncConfig(id=1)
            for key, value in updates.items():
                if key != "id":
                    setattr(config, key, value)
            session.add(config)
            session.commit()
            session.refresh(config)
            return config
