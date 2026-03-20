package com.fintrack.transaction.service;

import com.fintrack.transaction.cache.CacheService;
import com.fintrack.transaction.exception.TransactionNotFoundException;
import com.fintrack.transaction.kafka.KafkaEventPublisher;
import com.fintrack.transaction.model.Transaction;
import com.fintrack.transaction.model.TransactionStatus;
import com.fintrack.transaction.repository.TransactionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class TransactionService {

    private final TransactionRepository repository;
    private final RuleEngine ruleEngine;
    @MockBean
    private KafkaEventPublisher kafkaPublisher;
    private final CacheService cacheService;   // ✅ replaced RedisTemplate

    // ── Create ─────────────────────────────────────────────────────────────
    @Transactional
    public Transaction create(CreateTransactionRequest req, String idempotencyKey) {

        // 1. Idempotency check
        String existingId = cacheService.get("idempotency:" + idempotencyKey);
        if (existingId != null) {
            log.info("Idempotent request detected for key={}", idempotencyKey);
            return repository.findById(UUID.fromString(existingId))
                    .orElseThrow(() -> new TransactionNotFoundException(existingId));
        }

        // 2. Save initial transaction
        Transaction tx = Transaction.builder()
                .accountId(req.getAccountId())
                .counterpartyId(req.getCounterpartyId())
                .amount(req.getAmount())
                .currency(req.getCurrency())
                .status(TransactionStatus.INGESTED)
                .idempotencyKey(idempotencyKey)
                .build();

        repository.save(tx);

        // 3. Store idempotency key
        cacheService.set(
                "idempotency:" + idempotencyKey,
                tx.getId().toString(),
                Duration.ofHours(24)
        );

        // 4. Rule evaluation
        RuleEngine.RuleResult result = ruleEngine.evaluate(tx);
        tx.setRiskScore(result.getRiskScore());
        tx.setStatus(result.getStatus());

        repository.save(tx);

        // 5. Publish events
        kafkaPublisher.publishTransactionEvent(tx);
        if (result.isRequiresCompliance()) {
            kafkaPublisher.publishComplianceEvent(tx, result.getTriggeredRules());
        }

        return tx;
    }

    // ── Search ─────────────────────────────────────────────────────────────
    public Page<Transaction> search(SearchRequest req) {
        return repository.search(
                req.getAccountId(),
                req.getStatus(),
                req.getMinAmount(),
                req.getMaxAmount(),
                req.getFrom(),
                req.getTo(),
                req.getMinRiskScore(),
                PageRequest.of(req.getPage(), req.getSize()));
    }

    // ── Get by ID ──────────────────────────────────────────────────────────
    public Transaction findById(UUID id) {
        cacheService.get("tx:" + id); // optional cache read
        return repository.findById(id)
                .orElseThrow(() -> new TransactionNotFoundException(id.toString()));
    }

    // ── Update AI summary ──────────────────────────────────────────────────
    @Transactional
    public void updateAiSummary(UUID id, String summary) {
        Transaction tx = findById(id);
        tx.setAiSummary(summary);
        tx.setStatus(TransactionStatus.REVIEWED);
        repository.save(tx);
        kafkaPublisher.publishTransactionEvent(tx);
    }

    // ── Dashboard ──────────────────────────────────────────────────────────
    public DashboardSummary getDashboardSummary() {
        long total = repository.count();
        long flagged = repository.findByStatusOrderByCreatedAtDesc(TransactionStatus.FLAGGED).size();

        return DashboardSummary.builder()
                .totalTransactions(total)
                .flaggedTransactions(flagged)
                .highRiskTransactions(repository.findHighRisk(70, PageRequest.of(0, 5)).size())
                .build();
    }

    // ── DTOs ───────────────────────────────────────────────────────────────
    @lombok.Builder @lombok.Data
    public static class CreateTransactionRequest {
        private String accountId;
        private String counterpartyId;
        private BigDecimal amount;
        private String currency;
    }

    @lombok.Builder @lombok.Data
    public static class SearchRequest {
        private String accountId;
        private TransactionStatus status;
        private BigDecimal minAmount;
        private BigDecimal maxAmount;
        private Instant from;
        private Instant to;
        private Integer minRiskScore;
        @lombok.Builder.Default private int page = 0;
        @lombok.Builder.Default private int size = 20;
    }

    @lombok.Builder @lombok.Data
    public static class DashboardSummary {
        private long totalTransactions;
        private long flaggedTransactions;
        private long highRiskTransactions;
    }
}