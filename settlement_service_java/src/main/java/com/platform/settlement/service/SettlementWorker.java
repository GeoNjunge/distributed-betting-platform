package com.platform.settlement.service;

import com.platform.settlement.model.BetResultEvent;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
public class SettlementWorker {

    private static final Logger log = LoggerFactory.getLogger(SettlementWorker.class);

    private final SettlementService settlementService;

    public SettlementWorker(SettlementService settlementService) {
        this.settlementService = settlementService;
    }

    @KafkaListener(topics = "${app.kafka.bets-results-topic}")
    @Transactional
    public void onBetResult(BetResultEvent event) {
        try {
            settlementService.processBetResult(event);
        } catch (InsufficientFundsException ex) {
            log.warn("Rolling back bets-results event bet_id={}: {}", event.betId(), ex.getMessage());
            throw ex;
        } catch (DataIntegrityViolationException ex) {
            log.info("Duplicate bets-results event rolled back bet_id={} idempotency_key={}",
                    event.betId(), event.idempotencyKey());
            throw ex;
        }
    }
}
