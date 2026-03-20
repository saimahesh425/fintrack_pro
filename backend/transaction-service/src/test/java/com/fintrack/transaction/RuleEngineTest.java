package com.fintrack.transaction;

import com.fintrack.transaction.model.Transaction;
import com.fintrack.transaction.model.TransactionStatus;
import com.fintrack.transaction.repository.TransactionRepository;
import com.fintrack.transaction.service.RuleEngine;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class RuleEngineTest {

    @Mock
    private TransactionRepository repository;

    @InjectMocks
    private RuleEngine ruleEngine;

    @BeforeEach
    void setup() {
        // Inject threshold values (normally set via @Value from properties)
        ReflectionTestUtils.setField(ruleEngine, "amlThreshold",       new BigDecimal("10000"));
        ReflectionTestUtils.setField(ruleEngine, "velocityMaxPerHour", 20);
        ReflectionTestUtils.setField(ruleEngine, "flagThreshold",       50);
        ReflectionTestUtils.setField(ruleEngine, "amlRiskScore",        40);
        ReflectionTestUtils.setField(ruleEngine, "velocityRiskScore",   30);
        ReflectionTestUtils.setField(ruleEngine, "duplicateRiskScore",  60);
    }

    private Transaction buildTx(BigDecimal amount) {
        return Transaction.builder()
            .id(UUID.randomUUID())
            .accountId("ACC-001")
            .counterpartyId("CORP-001")
            .amount(amount)
            .currency("USD")
            .idempotencyKey(UUID.randomUUID().toString())
            .status(TransactionStatus.INGESTED)
            .build();
    }

    @Test
    void evaluate_lowRiskTransaction_shouldReturnEnriching() {
        when(repository.countByAccountIdSince(any(), any())).thenReturn(0L);
        when(repository.existsByIdempotencyKeyAndStatusIn(any(), any())).thenReturn(false);

        RuleEngine.RuleResult result = ruleEngine.evaluate(buildTx(new BigDecimal("500")));

        assertThat(result.getStatus()).isEqualTo(TransactionStatus.ENRICHING);
        assertThat(result.getRiskScore()).isEqualTo(0);
        assertThat(result.getTriggeredRules()).isEmpty();
        assertThat(result.isRequiresCompliance()).isFalse();
    }

    @Test
    void evaluate_aboveAmlThreshold_shouldFlag() {
        when(repository.countByAccountIdSince(any(), any())).thenReturn(0L);
        when(repository.existsByIdempotencyKeyAndStatusIn(any(), any())).thenReturn(false);

        RuleEngine.RuleResult result = ruleEngine.evaluate(buildTx(new BigDecimal("15000")));

        assertThat(result.getStatus()).isEqualTo(TransactionStatus.FLAGGED);
        assertThat(result.getTriggeredRules()).contains("AML_THRESHOLD");
        assertThat(result.getRiskScore()).isGreaterThanOrEqualTo(40);
        assertThat(result.isRequiresCompliance()).isTrue();
    }

    @Test
    void evaluate_velocityExceeded_shouldIncreaseRisk() {
        when(repository.countByAccountIdSince(any(), any())).thenReturn(25L); // > 20/hr
        when(repository.existsByIdempotencyKeyAndStatusIn(any(), any())).thenReturn(false);

        RuleEngine.RuleResult result = ruleEngine.evaluate(buildTx(new BigDecimal("200")));

        assertThat(result.getTriggeredRules()).contains("VELOCITY_LIMIT");
        assertThat(result.getRiskScore()).isGreaterThanOrEqualTo(30);
    }

    @Test
    void evaluate_duplicateTransaction_shouldFlagImmediately() {
        when(repository.countByAccountIdSince(any(), any())).thenReturn(0L);
        when(repository.existsByIdempotencyKeyAndStatusIn(any(), any())).thenReturn(true);

        RuleEngine.RuleResult result = ruleEngine.evaluate(buildTx(new BigDecimal("100")));

        assertThat(result.getStatus()).isEqualTo(TransactionStatus.FLAGGED);
        assertThat(result.getTriggeredRules()).contains("DUPLICATE_DETECTED");
        assertThat(result.getRiskScore()).isEqualTo(60);
    }

    @Test
    void evaluate_multipleRules_riskScoreShouldCapAt100() {
        when(repository.countByAccountIdSince(any(), any())).thenReturn(30L); // velocity
        when(repository.existsByIdempotencyKeyAndStatusIn(any(), any())).thenReturn(true); // duplicate

        // Also above AML threshold — all three rules fire
        RuleEngine.RuleResult result = ruleEngine.evaluate(buildTx(new BigDecimal("50000")));

        assertThat(result.getRiskScore()).isLessThanOrEqualTo(100);
        assertThat(result.getTriggeredRules()).hasSize(3);
    }
}
