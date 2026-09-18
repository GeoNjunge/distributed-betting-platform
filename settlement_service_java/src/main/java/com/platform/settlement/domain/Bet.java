package com.platform.settlement.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(
        name = "bets",
        uniqueConstraints = @UniqueConstraint(name = "uq_bets_idempotency_key", columnNames = "idempotency_key")
)
public class Bet {

    @Id
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @Column(name = "user_id", nullable = false, updatable = false)
    private UUID userId;

    @Column(name = "idempotency_key", nullable = false, updatable = false, length = 128)
    private String idempotencyKey;

    @Column(name = "match_id", nullable = false, updatable = false, length = 128)
    private String matchId;

    @Column(name = "selection_id", nullable = false, updatable = false, length = 128)
    private String selectionId;

    @Column(name = "stake_cents", nullable = false, updatable = false)
    private long stakeCents;

    @Column(name = "odds", nullable = false, updatable = false, precision = 10, scale = 4)
    private BigDecimal odds;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    private BetStatus status;

    @Column(name = "rejection_reason")
    private String rejectionReason;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    protected Bet() {
    }

    public Bet(
            UUID id,
            UUID userId,
            String idempotencyKey,
            String matchId,
            String selectionId,
            long stakeCents,
            BigDecimal odds,
            BetStatus status,
            String rejectionReason
    ) {
        this.id = id;
        this.userId = userId;
        this.idempotencyKey = idempotencyKey;
        this.matchId = matchId;
        this.selectionId = selectionId;
        this.stakeCents = stakeCents;
        this.odds = odds;
        this.status = status;
        this.rejectionReason = rejectionReason;
    }

    public UUID getId() {
        return id;
    }

    public UUID getUserId() {
        return userId;
    }

    public String getIdempotencyKey() {
        return idempotencyKey;
    }

    public String getMatchId() {
        return matchId;
    }

    public String getSelectionId() {
        return selectionId;
    }

    public long getStakeCents() {
        return stakeCents;
    }

    public BigDecimal getOdds() {
        return odds;
    }

    public BetStatus getStatus() {
        return status;
    }

    public String getRejectionReason() {
        return rejectionReason;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
