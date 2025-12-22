"""Shared utilities for CLI commands."""
from pathlib import Path

import typer

# Default paths
DEFAULT_BEETS_CONFIG = Path(__file__).parent.parent.parent / "config" / "beets_config.yaml"
DEFAULT_LIBRARY_DIR = Path(__file__).parent.parent.parent / "data"


def echo_error(message: str) -> None:
    """Print error message and exit."""
    typer.echo(f"Error: {message}", err=True)
    raise typer.Exit(1)


def echo_success(message: str) -> None:
    """Print success message."""
    typer.echo(f"Success: {message}")


def echo_info(message: str) -> None:
    """Print info message."""
    typer.echo(message)
