"""Tests for playlist URL detection and type classification."""

import pytest

from yubal.core.enums import ImportType
from yubal.core.utils import detect_import_type, extract_playlist_id


class TestExtractPlaylistId:
    """Tests for extract_playlist_id function."""

    @pytest.mark.parametrize(
        ("url", "expected"),
        [
            ("https://music.youtube.com/playlist?list=PLxxx123", "PLxxx123"),
            (
                "https://music.youtube.com/playlist?list=OLAK5uy_abc123",
                "OLAK5uy_abc123",
            ),
            ("https://music.youtube.com/playlist?list=PLxxx&si=abc123", "PLxxx"),
        ],
    )
    def test_extracts_playlist_id(self, url: str, expected: str) -> None:
        assert extract_playlist_id(url) == expected

    @pytest.mark.parametrize(
        "url",
        [
            "https://music.youtube.com/watch?v=abc123",
            "https://example.com/not-youtube",
        ],
    )
    def test_returns_none_for_invalid_urls(self, url: str) -> None:
        assert extract_playlist_id(url) is None


class TestDetectImportType:
    """Tests for detect_import_type function."""

    @pytest.mark.parametrize(
        ("url", "expected"),
        [
            # Album prefix
            (
                "https://music.youtube.com/playlist?list=OLAK5uy_abc123def456",
                ImportType.ALBUM,
            ),
            # PL prefix
            (
                "https://music.youtube.com/playlist?list=PLxxx123",
                ImportType.PLAYLIST,
            ),
            # Radio mix (RDTMAK5uy_)
            (
                "https://music.youtube.com/playlist?list=RDTMAK5uy_xxx",
                ImportType.PLAYLIST,
            ),
            # Unknown prefix defaults to playlist
            (
                "https://music.youtube.com/playlist?list=FUTURE_PREFIX_xxx",
                ImportType.PLAYLIST,
            ),
            # URL without list param defaults to playlist
            (
                "https://music.youtube.com/watch?v=abc123",
                ImportType.PLAYLIST,
            ),
        ],
    )
    def test_detects_import_type(self, url: str, expected: ImportType) -> None:
        assert detect_import_type(url) == expected
