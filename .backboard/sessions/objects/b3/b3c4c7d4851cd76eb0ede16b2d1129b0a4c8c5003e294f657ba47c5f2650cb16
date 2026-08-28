from fastapi import APIRouter, Response, status

from app.core.config import get_settings
from app.schemas.auth import AuthResponse, LoginRequest, RegisterRequest
from app.services.security import authenticate_user, create_access_token, create_user


router = APIRouter(tags=["auth"])


def _set_auth_cookie(response: Response, token: str) -> None:
    settings = get_settings()
    response.set_cookie(
        key=settings.auth_cookie_name,
        value=token,
        httponly=True,
        secure=settings.cookie_secure,
        samesite=settings.cookie_samesite,
        domain=settings.cookie_domain,
        max_age=settings.access_token_expire_minutes * 60,
    )


@router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
async def register(payload: RegisterRequest, response: Response) -> AuthResponse:
    user = create_user(payload.email, payload.password)
    _set_auth_cookie(response, create_access_token(user))
    return AuthResponse(user_id=user.user_id, email=user.email)


@router.post("/login", response_model=AuthResponse)
async def login(payload: LoginRequest, response: Response) -> AuthResponse:
    user = authenticate_user(payload.email, payload.password)
    _set_auth_cookie(response, create_access_token(user))
    return AuthResponse(user_id=user.user_id, email=user.email)
