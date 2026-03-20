package com.fintrack.transaction.service;

import com.fintrack.transaction.model.Transaction;
import com.fintrack.transaction.model.TransactionStatus;
import com.fintrack.transaction.repository.TransactionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Component
@RequiredArgsConstructor
@Slf4j
public class RuleEngine {

    private final TransactionRepository repository;

    // Clock for testability
    private final Clock clock = Clock.systemUTC();

    // ── Configurable thresholds (NO HARDCODING) ──────────────────────────
    @Value("${rules.aml.threshold:10000}")
    private BigDecimal amlThreshold;

    @Value("${rules.velocity.max-per-hour:20}")
    private int velocityMaxPerHour;

    @Value("${rules.risk.flag-threshold:50}")
    private int flagThreshold;

    @Value("${rules.risk.aml-score:40}")
    private int amlRiskScore;

    @Value("${rules.risk.velocity-score:30}")
    private int velocityRiskScore;

    @Value("${rules.risk.duplicate-score:60}")
    private int duplicateRiskScore;

    @Value("${rules.risk.structuring-score:35}")
    private int structuringRiskScore;

    public RuleResult evaluate(Transaction tx) {

        List<String> triggeredRules = new ArrayList<>();
        int riskScore = 0;

        Instant now = Instant.now(clock);

        // ── Rule 1: AML Threshold (>= $10,000) ────────────────────────────
        if (tx.getAmount().compareTo(amlThreshold) >= 0) {
            triggeredRules.add("AML_THRESHOLD");
            riskScore += amlRiskScore;
            log.info("AML threshold triggered for tx={} amount={}", tx.getId(), tx.getAmount());
        }

        // ── Rule 2: Structuring Detection (just below threshold) ──────────
        BigDecimal structuringFloor = amlThreshold.multiply(BigDecimal.valueOf(0.85));

        if (tx.getAmount().compareTo(structuringFloor) >= 0
                && tx.getAmount().compareTo(amlThreshold) < 0) {

            long recentNearThreshold = repository.countByAccountIdSince(
                    tx.getAccountId(),
                    now.minusSeconds(86400)); // last 24 hours

            if (recentNearThreshold >= 3) {
                triggeredRules.add("STRUCTURING_SUSPECTED");
                riskScore += structuringRiskScore;
                log.info("Structuring suspected for accountId={}", tx.getAccountId());
            }
        }

        // ── Rule 3: Velocity Check (per hour) ─────────────────────────────
        long recentCount = repository.countByAccountIdSince(
                tx.getAccountId(),
                now.minusSeconds(3600));

        if (recentCount > velocityMaxPerHour) {
            triggeredRules.add("VELOCITY_LIMIT");
            riskScore += velocityRiskScore;
            log.info("Velocity exceeded for accountId={} count={}", tx.getAccountId(), recentCount);
        }

        // ── Rule 4: Duplicate Detection ───────────────────────────────────
        boolean isDuplicate = repository.existsByIdempotencyKeyAndStatusIn(
                tx.getIdempotencyKey(),
                List.of(TransactionStatus.CLEARED, TransactionStatus.REVIEWED));

        if (isDuplicate) {
            triggeredRules.add("DUPLICATE_DETECTED");
            riskScore += duplicateRiskScore;
            log.warn("Duplicate transaction detected for key={}", tx.getIdempotencyKey());
        }

        // ── Final Status Determination (CRITICAL FIX) ─────────────────────

        TransactionStatus status;

        // 🔥 Regulatory rule: AML must always be flagged
        if (triggeredRules.contains("AML_THRESHOLD")) {
            status = TransactionStatus.FLAGGED;
        }
        // Risk-based flagging
        else if (riskScore >= flagThreshold) {
            status = TransactionStatus.FLAGGED;
        }
        // Medium risk → review (optional improvement)
        else if (riskScore >= (flagThreshold / 2)) {
            status = TransactionStatus.REVIEWED;
        }
        // Low risk → continue processing
        else {
            status = TransactionStatus.ENRICHING;
        }

        return RuleResult.builder()
                .riskScore(Math.min(riskScore, 100)) // cap at 100
                .status(status)
                .triggeredRules(triggeredRules)
                .requiresCompliance(!triggeredRules.isEmpty())
                .build();
    }

    // ── Result Object ────────────────────────────────────────────────────
    @lombok.Builder
    @lombok.Data
    public static class RuleResult {
        private int riskScore;
        private TransactionStatus status;
        private List<String> triggeredRules;
        private boolean requiresCompliance;
    }
}