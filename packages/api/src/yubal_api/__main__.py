"""Entry point for running yubal-api as a module: python -m yubal_api."""

import uvicorn

from yubal_api.settings import get_settings


def main() -> None:
    """Start the FastAPI server."""
    settings = get_settings()
    uvicorn.run(
        "yubal_api.api.app:app",
        host=settings.host,
        port=settings.port,
        reload=settings.reload,
    )


if __name__ == "__main__":
    main()
