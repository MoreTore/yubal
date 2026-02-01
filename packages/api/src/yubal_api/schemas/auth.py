"""Authentication schemas."""

from typing import Literal

from pydantic import BaseModel, Field


class AuthLoginRequest(BaseModel):
    """Login payload."""

    username: str = Field(min_length=1, max_length=128)
    password: str = Field(min_length=1, max_length=256)


class AuthLoginResponse(BaseModel):
    """Login success response."""

    authenticated: Literal[True] = True


class AuthSessionResponse(BaseModel):
    """Session status."""

    enabled: bool
    authenticated: bool


class AuthLogoutResponse(BaseModel):
    """Logout acknowledgement."""

    status: Literal["ok"] = "ok"
