"""Local authentication with hashed credentials and signed sessions."""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import logging
import os
import secrets
import time
from pathlib import Path
from typing import Literal

from pydantic import BaseModel, Field
from starlette.responses import Response

from yubal_api.settings import Settings

logger = logging.getLogger(__name__)

DEFAULT_ITERATIONS = 390_000


def _b64encode(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).decode("ascii").rstrip("=")


def _b64decode(value: str) -> bytes:
    padding = "=" * (-len(value) % 4)
    return base64.urlsafe_b64decode(value + padding)


def _hash_password(password: str, salt: bytes, iterations: int) -> str:
    return hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, iterations).hex()


class AuthConfig(BaseModel):
    """Serialized authentication config persisted to disk."""

    version: Literal[1] = 1
    username: str
    password_hash: str
    salt: str
    iterations: int = Field(default=DEFAULT_ITERATIONS)
    secret_key: str


class AuthService:
    """Stateless session authentication backed by hashed config."""

    def __init__(self, settings: Settings) -> None:
        self.enabled = settings.auth_enabled
        self.cookie_name = settings.auth_cookie_name
        self.cookie_secure = settings.auth_cookie_secure
        self.cookie_path = "/"
        self.cookie_same_site = "lax"
        self._session_max_age = settings.auth_session_hours * 3600
        self._config_path = settings.auth_config_file
        self._config: AuthConfig | None = None
        self._secret_key: bytes | None = None
        self._salt: bytes | None = None
        self._username: str | None = None

        if not self.enabled:
            return

        if self._config_path is None:
            raise RuntimeError("auth_config_file path is not configured")

        username = settings.auth_username
        password = (
            settings.auth_password.get_secret_value()
            if settings.auth_password is not None
            else None
        )
        self._config = self._load_or_initialize_config(self._config_path, username, password)
        self._secret_key = _b64decode(self._config.secret_key)
        self._salt = _b64decode(self._config.salt)
        self._username = self._config.username

    @property
    def requires_cookie(self) -> bool:
        return self.enabled

    @property
    def max_age(self) -> int:
        return self._session_max_age

    def authenticate(self, username: str, password: str) -> bool:
        """Validate supplied credentials."""
        if not self.enabled:
            return True
        if not self._config or not self._salt:
            return False
        if username != self._config.username:
            return False
        expected = self._config.password_hash
        computed = _hash_password(password, self._salt, self._config.iterations)
        return hmac.compare_digest(expected, computed)

    def issue_token(self) -> str:
        """Issue a signed session token."""
        if not self.enabled or not self._secret_key or not self._username:
            raise RuntimeError("Authentication service is not enabled")
        payload = {
            "sub": self._username,
            "exp": int(time.time()) + self._session_max_age,
            "nonce": secrets.token_hex(8),
        }
        payload_bytes = json.dumps(payload, separators=(",", ":"), sort_keys=True).encode(
            "utf-8"
        )
        signature = hmac.new(self._secret_key, payload_bytes, hashlib.sha256).digest()
        return f"{_b64encode(payload_bytes)}.{_b64encode(signature)}"

    def verify_session(self, token: str | None) -> bool:
        """Check if the provided session token is valid."""
        if not self.enabled:
            return True
        if not token or not self._secret_key:
            return False
        try:
            payload_b64, signature_b64 = token.split(".", 1)
        except ValueError:
            return False

        payload_bytes = _b64decode(payload_b64)
        signature = _b64decode(signature_b64)
        expected_signature = hmac.new(self._secret_key, payload_bytes, hashlib.sha256).digest()

        if not hmac.compare_digest(signature, expected_signature):
            return False

        try:
            payload = json.loads(payload_bytes.decode("utf-8"))
        except json.JSONDecodeError:
            return False

        if payload.get("sub") != self._username:
            return False

        expires_at = payload.get("exp")
        if not isinstance(expires_at, int):
            return False
        if expires_at < int(time.time()):
            return False

        return True

    def apply_session_cookie(self, response: Response, token: str) -> None:
        """Attach session cookie to response."""
        if not self.enabled:
            return
        response.set_cookie(
            key=self.cookie_name,
            value=token,
            max_age=self._session_max_age,
            httponly=True,
            secure=self.cookie_secure,
            samesite=self.cookie_same_site,  # type: ignore[arg-type]
            path=self.cookie_path,
        )

    def clear_session_cookie(self, response: Response) -> None:
        """Remove session cookie from response."""
        if not self.enabled:
            return
        response.delete_cookie(
            key=self.cookie_name,
            path=self.cookie_path,
            httponly=True,
        )

    def _load_or_initialize_config(
        self,
        path: Path,
        username: str | None,
        password: str | None,
    ) -> AuthConfig:
        if path.exists():
            return self._load_config(path)

        if not username or not password:
            raise RuntimeError(
                "Local authentication is enabled but credentials are missing. "
                "Set YUBAL_AUTH_USERNAME and YUBAL_AUTH_PASSWORD (once) to bootstrap.",
            )

        config = self._create_config(username, password)
        self._write_config(path, config)
        logger.info("Created hashed auth config at %s", path)
        return config

    @staticmethod
    def _load_config(path: Path) -> AuthConfig:
        return AuthConfig.model_validate_json(path.read_text())

    @staticmethod
    def _create_config(username: str, password: str) -> AuthConfig:
        salt = secrets.token_bytes(16)
        secret_key = secrets.token_bytes(32)
        iterations = DEFAULT_ITERATIONS
        password_hash = _hash_password(password, salt, iterations)
        return AuthConfig(
            username=username,
            password_hash=password_hash,
            salt=_b64encode(salt),
            iterations=iterations,
            secret_key=_b64encode(secret_key),
        )

    @staticmethod
    def _write_config(path: Path, config: AuthConfig) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        tmp_path = path.with_suffix(".tmp")
        tmp_path.write_text(config.model_dump_json(indent=2))
        os.chmod(tmp_path, 0o600)
        tmp_path.replace(path)
