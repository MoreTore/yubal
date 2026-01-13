"""Entry point for running yubal as a module: python -m yubal."""

import uvicorn

from yubal.settings import get_settings


def main() -> None:
    """Start the FastAPI server."""
    settings = get_settings()
    uvicorn.run(
        "yubal.api.app:app",
        host=settings.host,
        port=settings.port,
        reload=settings.reload,
    )


if __name__ == "__main__":
    main()
