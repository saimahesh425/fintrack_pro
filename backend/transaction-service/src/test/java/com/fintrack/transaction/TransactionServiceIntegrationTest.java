package com.fintrack.transaction;

import com.fintrack.transaction.model.Transaction;
import com.fintrack.transaction.model.TransactionStatus;
import com.fintrack.transaction.service.TransactionService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.domain.Page;
import org.springframework.test.context.ActiveProfiles;

import java.math.BigDecimal;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@ActiveProfiles("test")
class TransactionServiceIntegrationTest {

    @Autowired
    private TransactionService service;

    // ── Create and retrieve ───────────────────────────────────────────────
    @Test
    void createTransaction_shouldPersistAndEvaluateRules() {
        String idempotencyKey = UUID.randomUUID().toString();

        TransactionService.CreateTransactionRequest req =
            TransactionService.CreateTransactionRequest.builder()
                .accountId("ACC-TEST-001")
                .counterpartyId("CORP-TEST")
                .amount(new BigDecimal("500.00"))
                .currency("USD")
                .build();

        Transaction tx = service.create(req, idempotencyKey);

        assertThat(tx.getId()).isNotNull();
        assertThat(tx.getStatus()).isIn(
            TransactionStatus.ENRICHING, TransactionStatus.CLEARED, TransactionStatus.FLAGGED
        );
        assertThat(tx.getRiskScore()).isBetween(0, 100);
    }

    // ── AML threshold rule fires ──────────────────────────────────────────
    @Test
    void createTransaction_aboveAmlThreshold_shouldBeFlagged() {
        String idempotencyKey = UUID.randomUUID().toString();

        Transaction tx = service.create(
            TransactionService.CreateTransactionRequest.builder()
                .accountId("ACC-AML-001")
                .counterpartyId("CORP-HIGH")
                .amount(new BigDecimal("15000.00"))   // Above $10,000 threshold
                .currency("USD")
                .build(),
            idempotencyKey
        );

        assertThat(tx.getStatus()).isEqualTo(TransactionStatus.FLAGGED);
        assertThat(tx.getRiskScore()).isGreaterThanOrEqualTo(40);
    }

    // ── Idempotency — same key returns same transaction ───────────────────
    @Test
    void createTransaction_sameIdempotencyKey_shouldReturnSameRecord() {
        String key = UUID.randomUUID().toString();
        TransactionService.CreateTransactionRequest req =
            TransactionService.CreateTransactionRequest.builder()
                .accountId("ACC-IDEM-001")
                .counterpartyId("CORP-TEST")
                .amount(new BigDecimal("100.00"))
                .currency("USD")
                .build();

        Transaction first  = service.create(req, key);
        Transaction second = service.create(req, key);   // Same key

        assertThat(first.getId()).isEqualTo(second.getId());
    }

    // ── Search with filters ───────────────────────────────────────────────
    @Test
    void search_withStatusFilter_shouldReturnMatchingTransactions() {
        // Create a flagged transaction first
        service.create(
            TransactionService.CreateTransactionRequest.builder()
                .accountId("ACC-SEARCH-001")
                .counterpartyId("CORP-BIG")
                .amount(new BigDecimal("50000.00"))
                .currency("USD")
                .build(),
            UUID.randomUUID().toString()
        );

        Page<Transaction> results = service.search(
            TransactionService.SearchRequest.builder()
                .minAmount(new BigDecimal("10000.00"))
                .page(0).size(10)
                .build()
        );

        assertThat(results.getContent()).isNotEmpty();
        assertThat(results.getContent())
            .allMatch(t -> t.getAmount().compareTo(new BigDecimal("10000.00")) >= 0);
    }
}
