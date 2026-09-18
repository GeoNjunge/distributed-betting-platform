package com.platform.settlement.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.platform.settlement.domain.BetStatus;
import com.platform.settlement.domain.LedgerType;
import com.platform.settlement.domain.User;
import com.platform.settlement.domain.Wallet;
import com.platform.settlement.model.BetResultEvent;
import com.platform.settlement.repository.BetRepository;
import com.platform.settlement.repository.UserRepository;
import com.platform.settlement.repository.WalletLedgerRepository;
import com.platform.settlement.repository.WalletRepository;
import java.math.BigDecimal;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@SpringBootTest
@Testcontainers
@ActiveProfiles("test")
class SettlementWorkerIntegrationTest {

    @Container
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine")
            .withDatabaseName("settlement_test")
            .withUsername("postgres")
            .withPassword("postgres");

    @DynamicPropertySource
    static void registerDataSource(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", postgres::getJdbcUrl);
        registry.add("spring.datasource.username", postgres::getUsername);
        registry.add("spring.datasource.password", postgres::getPassword);
        registry.add("spring.kafka.bootstrap-servers", () -> "localhost:9092");
    }

    @Autowired
    SettlementService settlementService;

    @Autowired
    UserRepository userRepository;

    @Autowired
    WalletRepository walletRepository;

    @Autowired
    BetRepository betRepository;

    @Autowired
    WalletLedgerRepository walletLedgerRepository;

    private UUID userId;
    private UUID betId;

    @BeforeEach
    void setUp() {
        userId = UUID.randomUUID();
        betId = UUID.randomUUID();
        userRepository.save(new User(userId, "user-test"));
        walletRepository.save(new Wallet(userId, 10_000L));
    }

    @Test
    void happyPath_acceptedBet_debitsWalletAndWritesLedger() {
        BetResultEvent event = acceptedEvent("happy-path-key", 2_500L);

        boolean processed = settlementService.processBetResult(event);

        assertThat(processed).isTrue();
        assertThat(walletRepository.findById(userId)).get().extracting(Wallet::getBalanceCents).isEqualTo(7_500L);
        assertThat(betRepository.findById(betId)).get()
                .satisfies(bet -> {
                    assertThat(bet.getStatus()).isEqualTo(BetStatus.ACCEPTED);
                    assertThat(bet.getIdempotencyKey()).isEqualTo("happy-path-key");
                });
        assertThat(walletLedgerRepository.findAll()).hasSize(1);
        assertThat(walletLedgerRepository.findAll().getFirst())
                .satisfies(entry -> {
                    assertThat(entry.getAmountCents()).isEqualTo(-2_500L);
                    assertThat(entry.getType()).isEqualTo(LedgerType.BET_STAKE);
                    assertThat(entry.getIdempotencyKey()).isEqualTo("happy-path-key");
                });
    }

    @Test
    void duplicateMessage_isSuppressedByIdempotencyKey() {
        BetResultEvent event = acceptedEvent("duplicate-key", 1_000L);

        assertThat(settlementService.processBetResult(event)).isTrue();
        assertThat(settlementService.processBetResult(event)).isFalse();

        assertThat(walletRepository.findById(userId)).get().extracting(Wallet::getBalanceCents).isEqualTo(9_000L);
        assertThat(betRepository.count()).isEqualTo(1);
        assertThat(walletLedgerRepository.count()).isEqualTo(1);
    }

    @Test
    void rejectedBet_persistsWithoutWalletMutation() {
        BetResultEvent event = rejectedEvent("rejected-key");

        boolean processed = settlementService.processBetResult(event);

        assertThat(processed).isTrue();
        assertThat(walletRepository.findById(userId)).get().extracting(Wallet::getBalanceCents).isEqualTo(10_000L);
        assertThat(betRepository.findById(betId)).get()
                .satisfies(bet -> {
                    assertThat(bet.getStatus()).isEqualTo(BetStatus.REJECTED);
                    assertThat(bet.getRejectionReason()).isEqualTo("INSUFFICIENT_FUNDS");
                });
        assertThat(walletLedgerRepository.count()).isZero();
    }

    @Test
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    void insufficientFunds_rollsBackWalletDebitAndBetInsert() {
        BetResultEvent event = acceptedEvent("rollback-key", 50_000L);

        assertThatThrownBy(() -> settlementService.processBetResult(event))
                .isInstanceOf(InsufficientFundsException.class);

        assertThat(walletRepository.findById(userId)).get().extracting(Wallet::getBalanceCents).isEqualTo(10_000L);
        assertThat(betRepository.count()).isZero();
        assertThat(walletLedgerRepository.count()).isZero();
    }

    private BetResultEvent acceptedEvent(String idempotencyKey, long stakeCents) {
        return new BetResultEvent(
                "evt-" + idempotencyKey,
                betId,
                userId,
                idempotencyKey,
                "match-1",
                "selection-home",
                stakeCents,
                new BigDecimal("2.1500"),
                true,
                "ACCEPTED",
                "accepted by risk engine",
                stakeCents,
                10_000L - stakeCents,
                1_700_000_000_000L
        );
    }

    private BetResultEvent rejectedEvent(String idempotencyKey) {
        return new BetResultEvent(
                "evt-" + idempotencyKey,
                betId,
                userId,
                idempotencyKey,
                "match-1",
                "selection-away",
                1_000L,
                new BigDecimal("1.9000"),
                false,
                "INSUFFICIENT_FUNDS",
                "INSUFFICIENT_FUNDS",
                0L,
                10_000L,
                1_700_000_000_000L
        );
    }
}
