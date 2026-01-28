"""Shared type definitions for the application."""

from collections.abc import Callable
from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field

from yubal_api.domain.enums import ProgressStep

# Callable type aliases for dependency injection
type Clock = Callable[[], datetime]
type IdGenerator = Callable[[], str]


# Progress reporting types
class ProgressEvent(BaseModel):
    """A progress update event."""

    step: ProgressStep
    message: str
    progress: float | None = None  # 0-100 for percentage progress
    details: dict[str, Any] = Field(default_factory=dict)


type ProgressCallback = Callable[[ProgressEvent], None]
type CancelCheck = Callable[[], bool]
