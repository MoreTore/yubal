"""Version command."""
import typer


def version() -> None:
    """Show version information."""
    typer.echo("ytad version 0.1.0")
