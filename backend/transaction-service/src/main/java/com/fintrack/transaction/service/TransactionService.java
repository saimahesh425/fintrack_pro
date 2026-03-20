package com.fintrack.transaction.service;

import com.fintrack.transaction.exception.TransactionNotFoundException;
import com.fintrack.transaction.kafka.KafkaEventPublisher;
import com.fintrack.transaction.model.Transaction;
import com.fintrack.transaction.model.TransactionStatus;
import com.fintrack.transaction.repository.TransactionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.redis.core.RedisTemplate;
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

    private final TransactionRepository  repository;
    private final RuleEngine             ruleEngine;
    private final KafkaEventPublisher    kafkaPublisher;
    private final RedisTemplate<String, String> redis;

    // ── Create ─────────────────────────────────────────────────────────────
    @Transactional
    public Transaction create(CreateTransactionRequest req, String idempotencyKey) {

        // 1. Idempotency check — return existing if already processed
        String existingId = redis.opsForValue().get("idempotency:" + idempotencyKey);
        if (existingId != null) {
            log.info("Idempotent request detected for key={}", idempotencyKey);
            return repository.findById(UUID.fromString(existingId))
                    .orElseThrow(() -> new TransactionNotFoundException(existingId));
        }

        // 2. Build and persist with INGESTED status
        Transaction tx = Transaction.builder()
                .accountId(req.getAccountId())
                .counterpartyId(req.getCounterpartyId())
                .amount(req.getAmount())
                .currency(req.getCurrency())
                .status(TransactionStatus.INGESTED)
                .idempotencyKey(idempotencyKey)
                .build();
        repository.save(tx);
        log.info("Transaction persisted id={} accountId={} amount={}", tx.getId(), tx.getAccountId(), tx.getAmount());

        // 3. Store idempotency key in Redis (24hr TTL)
        redis.opsForValue().set("idempotency:" + idempotencyKey,
                tx.getId().toString(), Duration.ofHours(24));

        // 4. Evaluate rules synchronously
        RuleEngine.RuleResult result = ruleEngine.evaluate(tx);
        tx.setRiskScore(result.getRiskScore());
        tx.setStatus(result.getStatus());
        repository.save(tx);
        log.info("Rules evaluated id={} riskScore={} status={} rules={}",
                tx.getId(), result.getRiskScore(), result.getStatus(), result.getTriggeredRules());

        // 5. Publish events AFTER commit (outside @Transactional boundary via kafkaPublisher)
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
        // Try Redis cache first (5min TTL for hot-path access)
        String cached = redis.opsForValue().get("tx:" + id);
        if (cached != null) {
            log.debug("Cache hit for tx={}", id);
        }
        return repository.findById(id)
                .orElseThrow(() -> new TransactionNotFoundException(id.toString()));
    }

    // ── Update AI summary (called by AIQueryService after enrichment) ──────
    @Transactional
    public void updateAiSummary(UUID id, String summary) {
        Transaction tx = findById(id);
        tx.setAiSummary(summary);
        tx.setStatus(TransactionStatus.REVIEWED);
        repository.save(tx);
        kafkaPublisher.publishTransactionEvent(tx); // Notify WebSocket relay
    }

    // ── Dashboard summary ──────────────────────────────────────────────────
    public DashboardSummary getDashboardSummary() {
        long total   = repository.count();
        long flagged = repository.findByStatusOrderByCreatedAtDesc(TransactionStatus.FLAGGED).size();
        return DashboardSummary.builder()
                .totalTransactions(total)
                .flaggedTransactions(flagged)
                .highRiskTransactions(repository.findHighRisk(70, PageRequest.of(0, 5)).size())
                .build();
    }

    // ── Inner request/response records ────────────────────────────────────
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
