"""Safaricom Daraja M-Pesa client with in-memory OAuth cache-aside."""

from __future__ import annotations

import asyncio
import base64
import time
from dataclasses import dataclass
from datetime import datetime
from typing import Any

import httpx
from fastapi import FastAPI, HTTPException, status

from app.config import Settings, get_settings


@dataclass
class MpesaOAuthCache:
    access_token: str | None = None
    expires_at: float = 0.0
    refresh_lock: asyncio.Lock | None = None


def init_mpesa_state(app: FastAPI) -> None:
    app.state.mpesa_oauth = MpesaOAuthCache(refresh_lock=asyncio.Lock())
    app.state.mpesa_http_client = httpx.AsyncClient(timeout=httpx.Timeout(30.0))


async def close_mpesa_state(app: FastAPI) -> None:
    client: httpx.AsyncClient | None = getattr(app.state, "mpesa_http_client", None)
    if client is not None:
        await client.aclose()


def _basic_auth_header(settings: Settings) -> str:
    raw = f"{settings.consumer_key}:{settings.consumer_secret}".encode()
    return base64.b64encode(raw).decode()


def stk_password_and_timestamp(shortcode: str, passkey: str) -> tuple[str, str]:
    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    password_string = shortcode + passkey + timestamp
    stk_password = base64.b64encode(password_string.encode()).decode("utf-8")
    return stk_password, timestamp


async def fetch_oauth_token(
    client: httpx.AsyncClient,
    settings: Settings,
) -> tuple[str, float]:
    if not settings.consumer_key or not settings.consumer_secret:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="M-Pesa OAuth credentials are not configured",
        )

    response = await client.get(
        settings.mpesa_oauth_url,
        params={"grant_type": "client_credentials"},
        headers={"Authorization": f"Basic {_basic_auth_header(settings)}"},
    )
    if response.status_code != 200:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Safaricom OAuth failed: HTTP {response.status_code}",
        )

    payload = response.json()
    access_token = payload.get("access_token")
    expires_in = payload.get("expires_in", 3599)
    if not access_token:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Safaricom OAuth response missing access_token",
        )

    expires_at = time.time() + float(expires_in)
    return access_token, expires_at


async def get_access_token(app: FastAPI, *, force_refresh: bool = False) -> str:
    settings = get_settings()
    cache: MpesaOAuthCache = app.state.mpesa_oauth
    client: httpx.AsyncClient = app.state.mpesa_http_client
    skew = settings.mpesa_oauth_token_refresh_skew_seconds

    if (
        not force_refresh
        and cache.access_token
        and time.time() < (cache.expires_at - skew)
    ):
        return cache.access_token

    assert cache.refresh_lock is not None
    async with cache.refresh_lock:
        if (
            not force_refresh
            and cache.access_token
            and time.time() < (cache.expires_at - skew)
        ):
            return cache.access_token

        access_token, expires_at = await fetch_oauth_token(client, settings)
        cache.access_token = access_token
        cache.expires_at = expires_at
        return access_token


async def initiate_stk_push(
    app: FastAPI,
    *,
    phone_number: str,
    amount_kes: int,
    account_reference: str,
    transaction_desc: str,
) -> dict[str, Any]:
    settings = get_settings()
    if not settings.mpesa_callback_url:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="MPESA_CALLBACK_URL is not configured",
        )

    token = await get_access_token(app)
    stk_password, timestamp = stk_password_and_timestamp(settings.mpesa_shortcode, settings.mpesa_passkey)
    shortcode_int = int(settings.mpesa_shortcode)
    phone_int = int(phone_number)

    payload = {
        "BusinessShortCode": shortcode_int,
        "Password": stk_password,
        "Timestamp": timestamp,
        "TransactionType": settings.mpesa_transaction_type,
        "Amount": int(amount_kes),
        "PartyA": phone_int,
        "PartyB": shortcode_int,
        "PhoneNumber": phone_int,
        "CallBackURL": settings.mpesa_callback_url.rstrip("/"),
        "AccountReference": account_reference,
        "TransactionDesc": transaction_desc,
    }

    client: httpx.AsyncClient = app.state.mpesa_http_client
    response = await client.post(
        settings.mpesa_stk_push_url,
        json=payload,
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
    )

    if response.status_code == 401:
        token = await get_access_token(app, force_refresh=True)
        response = await client.post(
            settings.mpesa_stk_push_url,
            json=payload,
            headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        )

    if response.status_code != 200:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Safaricom STK Push failed: HTTP {response.status_code} — {response.text}",
        )

    return response.json()
