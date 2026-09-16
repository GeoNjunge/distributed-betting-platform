from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.database import get_session
from app.schemas.auth import (
    RegisterPendingResponse,
    TokenResponse,
    UserLoginRequest,
    UserRegisterRequest,
    VerifyOTPRequest,
)
from app.services.redis_service import RedisOTP, get_redis
from app.services.sms_service import SMSService
from app.services.user_service import UserService

router = APIRouter(prefix="/auth", tags=["auth"])

_sms_service = SMSService()


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


async def get_user_service(session: AsyncSession = Depends(get_session)) -> UserService:
    redis_client = await get_redis()
    return UserService(session, RedisOTP(redis_client), _sms_service)


@router.post("/register", response_model=RegisterPendingResponse, status_code=status.HTTP_202_ACCEPTED)
async def register(
    payload: UserRegisterRequest,
    service: UserService = Depends(get_user_service),
) -> RegisterPendingResponse:
    result = await service.register_user(payload.email, payload.phone, payload.password, payload.username)
    return RegisterPendingResponse(message=result["message"], phone=result["phone"])


@router.post("/verify-otp", response_model=TokenResponse)
async def verify_otp(
    payload: VerifyOTPRequest,
    response: Response,
    service: UserService = Depends(get_user_service),
) -> TokenResponse:
    tokens = await service.verify_otp(payload.phone, payload.otp)
    _set_auth_cookie(response, tokens["access_token"])
    return TokenResponse(**tokens)


@router.post("/login", response_model=TokenResponse)
async def login(
    payload: UserLoginRequest,
    response: Response,
    service: UserService = Depends(get_user_service),
) -> TokenResponse:
    tokens = await service.login(payload.phone, payload.password)
    _set_auth_cookie(response, tokens["access_token"])
    return TokenResponse(**tokens)
