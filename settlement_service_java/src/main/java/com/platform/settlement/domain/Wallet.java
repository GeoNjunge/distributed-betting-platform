package com.platform.settlement.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "wallets")
public class Wallet {

    @Id
    @Column(name = "user_id", nullable = false, updatable = false)
    private UUID userId;

    @Column(name = "balance_cents", nullable = false)
    private long balanceCents;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    protected Wallet() {
    }

    public Wallet(UUID userId, long balanceCents) {
        this.userId = userId;
        this.balanceCents = balanceCents;
    }

    public UUID getUserId() {
        return userId;
    }

    public long getBalanceCents() {
        return balanceCents;
    }

    public void setBalanceCents(long balanceCents) {
        this.balanceCents = balanceCents;
        this.updatedAt = Instant.now();
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }
}
