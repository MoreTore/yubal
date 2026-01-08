"""Tests for playlist metadata enrichment."""

import pytest

from yubal.core.enums import ImportType, detect_import_type, extract_playlist_id


class TestExtractPlaylistId:
    """Tests for extract_playlist_id function."""

    def test_playlist_url(self) -> None:
        url = "https://music.youtube.com/playlist?list=PLxxx123"
        assert extract_playlist_id(url) == "PLxxx123"

    def test_album_url(self) -> None:
        url = "https://music.youtube.com/playlist?list=OLAK5uy_abc123"
        assert extract_playlist_id(url) == "OLAK5uy_abc123"

    def test_url_with_extra_params(self) -> None:
        url = "https://music.youtube.com/playlist?list=PLxxx&si=abc123"
        assert extract_playlist_id(url) == "PLxxx"

    def test_watch_url_returns_none(self) -> None:
        url = "https://music.youtube.com/watch?v=abc123"
        assert extract_playlist_id(url) is None

    def test_invalid_url_returns_none(self) -> None:
        url = "https://example.com/not-youtube"
        assert extract_playlist_id(url) is None


class TestDetectImportType:
    """Tests for detect_import_type function."""

    def test_album_prefix_returns_album(self) -> None:
        url = "https://music.youtube.com/playlist?list=OLAK5uy_abc123def456"
        assert detect_import_type(url) == ImportType.ALBUM

    def test_pl_prefix_returns_playlist(self) -> None:
        url = "https://music.youtube.com/playlist?list=PLxxx123"
        assert detect_import_type(url) == ImportType.PLAYLIST

    def test_radio_mix_returns_playlist(self) -> None:
        # Radio mixes start with RDTMAK5uy_
        url = "https://music.youtube.com/playlist?list=RDTMAK5uy_xxx"
        assert detect_import_type(url) == ImportType.PLAYLIST

    def test_unknown_prefix_returns_playlist(self) -> None:
        # Default to playlist for unknown prefixes
        url = "https://music.youtube.com/playlist?list=FUTURE_PREFIX_xxx"
        assert detect_import_type(url) == ImportType.PLAYLIST

    def test_no_list_param_returns_playlist(self) -> None:
        # Edge case: URL without list param defaults to playlist
        url = "https://music.youtube.com/watch?v=abc123"
        assert detect_import_type(url) == ImportType.PLAYLIST
