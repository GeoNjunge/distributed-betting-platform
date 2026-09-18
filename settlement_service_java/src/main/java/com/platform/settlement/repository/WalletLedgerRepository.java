package com.platform.settlement.repository;

import com.platform.settlement.domain.WalletLedger;
import org.springframework.data.jpa.repository.JpaRepository;

public interface WalletLedgerRepository extends JpaRepository<WalletLedger, Long> {

    boolean existsByIdempotencyKey(String idempotencyKey);
}
