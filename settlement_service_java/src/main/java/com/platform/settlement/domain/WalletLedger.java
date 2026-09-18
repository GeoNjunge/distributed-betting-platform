package com.platform.settlement.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(
        name = "wallet_ledger",
        uniqueConstraints = @UniqueConstraint(name = "uq_wallet_ledger_idempotency_key", columnNames = "idempotency_key")
)
public class WalletLedger {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false, updatable = false)
    private UUID userId;

    @Column(name = "amount_cents", nullable = false, updatable = false)
    private long amountCents;

    @Enumerated(EnumType.STRING)
    @Column(name = "type", nullable = false, updatable = false)
    private LedgerType type;

    @Column(name = "reference_id", nullable = false, updatable = false, length = 128)
    private String referenceId;

    @Column(name = "idempotency_key", nullable = false, updatable = false, length = 128)
    private String idempotencyKey;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    protected WalletLedger() {
    }

    public WalletLedger(
            UUID userId,
            long amountCents,
            LedgerType type,
            String referenceId,
            String idempotencyKey
    ) {
        this.userId = userId;
        this.amountCents = amountCents;
        this.type = type;
        this.referenceId = referenceId;
        this.idempotencyKey = idempotencyKey;
    }

    public Long getId() {
        return id;
    }

    public UUID getUserId() {
        return userId;
    }

    public long getAmountCents() {
        return amountCents;
    }

    public LedgerType getType() {
        return type;
    }

    public String getReferenceId() {
        return referenceId;
    }

    public String getIdempotencyKey() {
        return idempotencyKey;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
