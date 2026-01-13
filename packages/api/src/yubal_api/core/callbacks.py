"""Callback types for progress reporting."""

from collections.abc import Callable
from typing import Any

from pydantic import BaseModel, Field

from yubal_api.core.enums import ProgressStep


class ProgressEvent(BaseModel):
    """A progress update event."""

    step: ProgressStep
    message: str
    progress: float | None = None  # 0-100 for percentage progress
    details: dict[str, Any] = Field(default_factory=dict)


# Callable type aliases for callbacks
type ProgressCallback = Callable[[ProgressEvent], None]
type CancelCheck = Callable[[], bool]
