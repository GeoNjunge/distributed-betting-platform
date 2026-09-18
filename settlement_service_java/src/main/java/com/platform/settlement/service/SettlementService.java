package com.platform.settlement.service;

import com.platform.settlement.domain.Bet;
import com.platform.settlement.domain.BetStatus;
import com.platform.settlement.domain.LedgerType;
import com.platform.settlement.domain.User;
import com.platform.settlement.domain.Wallet;
import com.platform.settlement.domain.WalletLedger;
import com.platform.settlement.model.BetResultEvent;
import com.platform.settlement.repository.BetRepository;
import com.platform.settlement.repository.UserRepository;
import com.platform.settlement.repository.WalletLedgerRepository;
import com.platform.settlement.repository.WalletRepository;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class SettlementService {

    private static final Logger log = LoggerFactory.getLogger(SettlementService.class);
    private static final long DEFAULT_WALLET_SEED_CENTS = 100_000L;

    private final BetRepository betRepository;
    private final WalletRepository walletRepository;
    private final WalletLedgerRepository walletLedgerRepository;
    private final UserRepository userRepository;

    public SettlementService(
            BetRepository betRepository,
            WalletRepository walletRepository,
            WalletLedgerRepository walletLedgerRepository,
            UserRepository userRepository
    ) {
        this.betRepository = betRepository;
        this.walletRepository = walletRepository;
        this.walletLedgerRepository = walletLedgerRepository;
        this.userRepository = userRepository;
    }

    /**
     * @return {@code true} when a new bet row was written; {@code false} for duplicate events
     */
    @Transactional
    public boolean processBetResult(BetResultEvent event) {
        if (isDuplicate(event.idempotencyKey())) {
            log.info("Duplicate bets-results event skipped idempotency_key={}", event.idempotencyKey());
            return false;
        }

        ensureUserAndWallet(event.accountId());

        BetStatus status = resolveStatus(event);
        if (status == BetStatus.ACCEPTED) {
            acceptBet(event);
        } else {
            persistRejectedBet(event);
        }
        return true;
    }

    private boolean isDuplicate(String idempotencyKey) {
        return betRepository.existsByIdempotencyKey(idempotencyKey)
                || walletLedgerRepository.existsByIdempotencyKey(idempotencyKey);
    }

    private BetStatus resolveStatus(BetResultEvent event) {
        if (event.accepted() && "ACCEPTED".equals(event.reasonCode())) {
            return BetStatus.ACCEPTED;
        }
        return BetStatus.REJECTED;
    }

    private void ensureUserAndWallet(UUID userId) {
        if (!userRepository.existsById(userId)) {
            userRepository.save(new User(userId, "user-" + userId.toString().substring(0, 8)));
        }
        if (!walletRepository.existsById(userId)) {
            walletRepository.save(new Wallet(userId, DEFAULT_WALLET_SEED_CENTS));
        }
    }

    private void acceptBet(BetResultEvent event) {
        Wallet wallet = walletRepository
                .findByUserIdForUpdate(event.accountId())
                .orElseThrow(() -> new IllegalStateException("Wallet missing for user_id=" + event.accountId()));

        if (wallet.getBalanceCents() < event.stakeCents()) {
            throw new InsufficientFundsException(
                    "insufficient wallet balance for user_id=" + event.accountId()
            );
        }

        wallet.setBalanceCents(wallet.getBalanceCents() - event.stakeCents());
        walletRepository.save(wallet);

        betRepository.save(new Bet(
                event.betId(),
                event.accountId(),
                event.idempotencyKey(),
                event.matchId(),
                event.selectionId(),
                event.stakeCents(),
                event.odds(),
                BetStatus.ACCEPTED,
                null
        ));
        walletLedgerRepository.save(new WalletLedger(
                event.accountId(),
                -event.stakeCents(),
                LedgerType.BET_STAKE,
                event.betId().toString(),
                event.idempotencyKey()
        ));

        log.info("Persisted ACCEPTED bet_id={} stake_cents={}", event.betId(), event.stakeCents());
    }

    private void persistRejectedBet(BetResultEvent event) {
        String rejectionReason = event.reason() != null && !event.reason().isBlank()
                ? event.reason()
                : event.reasonCode();

        betRepository.save(new Bet(
                event.betId(),
                event.accountId(),
                event.idempotencyKey(),
                event.matchId(),
                event.selectionId(),
                event.stakeCents(),
                event.odds(),
                BetStatus.REJECTED,
                rejectionReason
        ));

        log.info("Persisted REJECTED bet_id={} reason={}", event.betId(), event.reasonCode());
    }
}
