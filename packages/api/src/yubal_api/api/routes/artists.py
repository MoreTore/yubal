"""Artist API endpoints."""

from typing import Literal

from fastapi import APIRouter, HTTPException, Query, status

from yubal import APIError
from yubal.client import YTMusicClient
from yubal_api.settings import get_settings

router = APIRouter(prefix="/artists", tags=["artists"])


@router.get("/{channel_id}", status_code=status.HTTP_200_OK)
async def get_artist(channel_id: str) -> dict:
    """Get artist details and top releases by channel ID."""
    settings = get_settings()
    client = YTMusicClient(cookies_path=settings.cookies_file)

    try:
        artist = client.get_artist(channel_id)
    except APIError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(exc),
        ) from exc

    return artist


@router.get("/{channel_id}/albums", status_code=status.HTTP_200_OK)
async def get_artist_albums(
    channel_id: str,
    params: str = Query(..., description="Params token from get_artist()"),
    limit: int | None = Query(100, ge=1),
    order: Literal["Recency", "Popularity", "Alphabetical order"] | None = Query(
        None
    ),
) -> list[dict]:
    """Get full list of artist albums/singles/shows."""
    settings = get_settings()
    client = YTMusicClient(cookies_path=settings.cookies_file)

    try:
        albums = client.get_artist_albums(
            channel_id,
            params,
            limit=limit,
            order=order,
        )
    except APIError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(exc),
        ) from exc

    return albums
