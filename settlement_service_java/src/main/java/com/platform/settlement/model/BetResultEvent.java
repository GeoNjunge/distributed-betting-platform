package com.platform.settlement.model;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.math.BigDecimal;
import java.util.UUID;

/**
 * Immutable Kafka payload from the C++ risk engine on topic {@code bets-results}.
 * Matches {@code risk_engine/schemas/bets-results.schema.json}.
 */
public record BetResultEvent(
        @JsonProperty("event_id") String eventId,
        @JsonProperty("bet_id") UUID betId,
        @JsonProperty("account_id") UUID accountId,
        @JsonProperty("idempotency_key") String idempotencyKey,
        @JsonProperty("match_id") String matchId,
        @JsonProperty("selection_id") String selectionId,
        @JsonProperty("stake_cents") long stakeCents,
        @JsonProperty("odds") BigDecimal odds,
        @JsonProperty("accepted") boolean accepted,
        @JsonProperty("reason_code") String reasonCode,
        @JsonProperty("reason") String reason,
        @JsonProperty("accepted_exposure_cents") long acceptedExposureCents,
        @JsonProperty("remaining_balance_cents") long remainingBalanceCents,
        @JsonProperty("decision_timestamp_ms") long decisionTimestampMs
) {
}
