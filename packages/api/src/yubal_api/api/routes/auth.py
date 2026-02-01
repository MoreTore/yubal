"""Authentication endpoints."""

from fastapi import APIRouter, HTTPException, Request, Response, status

from yubal_api.api.deps import AuthServiceDep
from yubal_api.schemas.auth import (
    AuthLoginRequest,
    AuthLoginResponse,
    AuthLogoutResponse,
    AuthSessionResponse,
)

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=AuthLoginResponse, summary="Sign in")
async def login(
    body: AuthLoginRequest,
    response: Response,
    auth_service: AuthServiceDep,
) -> AuthLoginResponse:
    """Authenticate a user and set the session cookie."""
    if not auth_service.enabled:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Auth disabled")

    if not auth_service.authenticate(body.username, body.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
        )

    token = auth_service.issue_token()
    auth_service.apply_session_cookie(response, token)
    return AuthLoginResponse()


@router.post("/logout", response_model=AuthLogoutResponse, summary="Sign out")
async def logout(response: Response, auth_service: AuthServiceDep) -> AuthLogoutResponse:
    """Clear the session cookie."""
    if auth_service.enabled:
        auth_service.clear_session_cookie(response)
    return AuthLogoutResponse()


@router.get("/session", response_model=AuthSessionResponse, summary="Session status")
async def session_status(
    request: Request, auth_service: AuthServiceDep
) -> AuthSessionResponse:
    """Report whether auth is enabled and if the current session is valid."""
    if not auth_service.enabled:
        return AuthSessionResponse(enabled=False, authenticated=True)

    token = request.cookies.get(auth_service.cookie_name)
    return AuthSessionResponse(
        enabled=True,
        authenticated=auth_service.verify_session(token),
    )
