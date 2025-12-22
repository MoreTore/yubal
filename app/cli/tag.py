"""Tag command."""
from pathlib import Path

import typer

from app.cli.utils import echo_error, echo_info, echo_success, DEFAULT_BEETS_CONFIG, DEFAULT_LIBRARY_DIR
from app.services.tagger import Tagger


def tag(
    input_dir: Path = typer.Argument(..., help="Directory containing downloaded audio files"),
    library_dir: Path = typer.Option(
        DEFAULT_LIBRARY_DIR,
        "--library-dir", "-l",
        help="Library directory for organized music",
    ),
    beets_config: Path = typer.Option(
        DEFAULT_BEETS_CONFIG,
        "--beets-config", "-c",
        help="Path to beets configuration file",
    ),
    copy: bool = typer.Option(
        False,
        "--copy", "-C",
        help="Copy to library instead of moving (original files unchanged)",
    ),
) -> None:
    """
    Tag and organize downloaded music using beets.

    Imports audio files, fetches metadata from Spotify/MusicBrainz,
    and organizes into the library structure.
    """
    if not input_dir.exists():
        echo_error(f"Input directory does not exist: {input_dir}")

    if not beets_config.exists():
        echo_error(f"Beets config not found: {beets_config}")

    echo_info(f"Source: {input_dir}")
    echo_info(f"Library: {library_dir}")
    if copy:
        echo_info("Mode: copy (original files will be preserved)")

    tagger = Tagger(
        beets_config=beets_config,
        library_dir=library_dir,
        beets_db=beets_config.parent / "beets.db",
    )

    result = tagger.tag_album(input_dir, copy=copy)

    if not result.success:
        echo_error(result.error or "Tagging failed")

    echo_info(f"Tagged {result.track_count} tracks")
    if result.dest_dir:
        if copy:
            echo_success(f"Copied and tagged to: {result.dest_dir}")
        else:
            echo_success(f"Moved and tagged to: {result.dest_dir}")
    else:
        echo_success("Tagging complete")
