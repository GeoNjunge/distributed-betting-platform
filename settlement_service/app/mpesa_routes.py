"""M-Pesa STK Push and callback HTTP routes."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select, update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.models import LedgerType, MpesaTransaction, MpesaTransactionStatus, User, Wallet, WalletLedger
from app.mpesa import initiate_stk_push
from app.schemas import MpesaCallbackAck, MpesaDepositRequest, MpesaStkPushResponse


router = APIRouter(prefix="/api/v1/mpesa", tags=["mpesa"])


def _metadata_value(metadata: list[dict[str, Any]] | None, name: str) -> str | None:
    if not metadata:
        return None
    for item in metadata:
        if item.get("Name") == name:
            value = item.get("Value")
            return str(value) if value is not None else None
    return None


@router.post("/stk-push", response_model=MpesaStkPushResponse)
async def stk_push_deposit(
    payload: MpesaDepositRequest,
    request: Request,
    session: AsyncSession = Depends(get_session),
) -> MpesaStkPushResponse:
    async with session.begin():
        await session.execute(
            pg_insert(User)
            .values(id=payload.user_id, username=f"user-{str(payload.user_id)[:8]}")
            .on_conflict_do_nothing(index_elements=["id"])
        )
        await session.execute(
            pg_insert(Wallet)
            .values(user_id=payload.user_id, balance_cents=0)
            .on_conflict_do_nothing(index_elements=["user_id"])
        )

    gateway = await initiate_stk_push(
        request.app,
        phone_number=payload.phone_number,
        amount_kes=payload.amount,
        account_reference=payload.account_reference,
        transaction_desc=payload.transaction_desc,
    )

    response_code = str(gateway.get("ResponseCode", ""))
    checkout_request_id = gateway.get("CheckoutRequestID")
    if response_code != "0" or not checkout_request_id:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail={
                "message": "Safaricom rejected STK Push",
                "response_code": response_code,
                "response_description": gateway.get("ResponseDescription"),
                "gateway": gateway,
            },
        )

    async with session.begin():
        session.add(
            MpesaTransaction(
                checkout_request_id=checkout_request_id,
                merchant_request_id=gateway.get("MerchantRequestID"),
                user_id=payload.user_id,
                phone_number=payload.phone_number,
                amount=payload.amount,
                status=MpesaTransactionStatus.PENDING,
            )
        )

    return MpesaStkPushResponse(
        checkout_request_id=checkout_request_id,
        merchant_request_id=gateway.get("MerchantRequestID"),
        customer_message=gateway.get("CustomerMessage"),
        response_code=response_code,
        response_description=str(gateway.get("ResponseDescription", "")),
        status=MpesaTransactionStatus.PENDING.value,
    )


@router.post("/callback", response_model=MpesaCallbackAck)
async def mpesa_stk_callback(
    body: dict[str, Any],
    session: AsyncSession = Depends(get_session),
) -> MpesaCallbackAck:
    try:
        stk_callback = body["Body"]["stkCallback"]
    except (KeyError, TypeError) as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid M-Pesa callback payload") from exc

    checkout_id = stk_callback.get("CheckoutRequestID")
    if not checkout_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Missing CheckoutRequestID")

    result_code = int(stk_callback.get("ResultCode", -1))
    result_desc = stk_callback.get("ResultDesc")

    async with session.begin():
        txn = await session.scalar(
            select(MpesaTransaction)
            .where(MpesaTransaction.checkout_request_id == checkout_id)
            .with_for_update()
            .limit(1)
        )
        if txn is None or txn.status != MpesaTransactionStatus.PENDING:
            return MpesaCallbackAck()

        txn.result_code = result_code
        txn.result_desc = result_desc

        if result_code == 0:
            metadata = stk_callback.get("CallbackMetadata", {}).get("Item")
            receipt = _metadata_value(metadata, "MpesaReceiptNumber")
            txn.mpesa_receipt_number = receipt
            txn.status = MpesaTransactionStatus.SUCCESS

            amount_cents = txn.amount * 100
            credit_result = await session.execute(
                update(Wallet)
                .where(Wallet.user_id == txn.user_id)
                .values(balance_cents=Wallet.balance_cents + amount_cents)
            )
            if credit_result.rowcount != 1:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Wallet not found for user_id={txn.user_id}",
                )

            session.add(
                WalletLedger(
                    user_id=txn.user_id,
                    amount_cents=amount_cents,
                    type=LedgerType.DEPOSIT,
                    reference_id=checkout_id,
                )
            )
        else:
            txn.status = MpesaTransactionStatus.FAILED

    return MpesaCallbackAck()
