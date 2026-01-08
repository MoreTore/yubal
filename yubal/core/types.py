"""Shared type definitions for the application."""

from typing import Literal

# Supported audio formats for yt-dlp downloads
AudioFormat = Literal["opus", "mp3", "m4a", "aac", "flac", "wav", "vorbis"]

# Log status values (matches ProgressStep enum values)
LogStatus = Literal[
    "fetching_info",
    "downloading",
    "importing",
    "completed",
    "failed",
    "cancelled",
]
