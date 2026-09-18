package com.platform.settlement.repository;

import com.platform.settlement.domain.Bet;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface BetRepository extends JpaRepository<Bet, UUID> {

    boolean existsByIdempotencyKey(String idempotencyKey);
}
