package com.fintrack.transaction.controller;

import com.fintrack.transaction.model.Transaction;
import com.fintrack.transaction.model.TransactionStatus;
import com.fintrack.transaction.service.TransactionService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@RestController
@RequestMapping("/api/transactions")
@RequiredArgsConstructor
@Tag(name = "Transactions", description = "Transaction ingestion and search API")
@CrossOrigin(origins = {"http://localhost:4200", "${app.cors.allowed-origins}"})
public class TransactionController {

    private final TransactionService service;

    // ── Create transaction (from upstream payment systems) ─────────────────
    @PostMapping
    @Operation(summary = "Ingest a new transaction")
    public ResponseEntity<Transaction> create(
            @Valid @RequestBody CreateTransactionDto dto,
            @RequestHeader("Idempotency-Key") String idempotencyKey) {

        Transaction tx = service.create(
                TransactionService.CreateTransactionRequest.builder()
                        .accountId(dto.accountId())
                        .counterpartyId(dto.counterpartyId())
                        .amount(dto.amount())
                        .currency(dto.currency())
                        .build(),
                idempotencyKey);

        return ResponseEntity.status(HttpStatus.CREATED).body(tx);
    }

    // ── Search transactions (analyst dashboard) ────────────────────────────
    @GetMapping
    @PreAuthorize("hasAnyRole('ANALYST', 'COMPLIANCE', 'ADMIN')")
    @Operation(summary = "Search transactions with filters")
    public ResponseEntity<Page<Transaction>> search(
            @RequestParam(required = false) String accountId,
            @RequestParam(required = false) TransactionStatus status,
            @RequestParam(required = false) BigDecimal minAmount,
            @RequestParam(required = false) BigDecimal maxAmount,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant to,
            @RequestParam(required = false) Integer minRiskScore,
            @RequestParam(defaultValue = "0")  int page,
            @RequestParam(defaultValue = "20") int size) {

        return ResponseEntity.ok(service.search(
                TransactionService.SearchRequest.builder()
                        .accountId(accountId).status(status)
                        .minAmount(minAmount).maxAmount(maxAmount)
                        .from(from).to(to)
                        .minRiskScore(minRiskScore)
                        .page(page).size(size)
                        .build()));
    }

    // ── Get single transaction ─────────────────────────────────────────────
    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('ANALYST', 'COMPLIANCE', 'ADMIN')")
    @Operation(summary = "Get transaction detail by ID")
    public ResponseEntity<Transaction> getById(@PathVariable UUID id) {
        return ResponseEntity.ok(service.findById(id));
    }

    // ── Dashboard summary ──────────────────────────────────────────────────
    @GetMapping("/summary")
    @PreAuthorize("hasAnyRole('ANALYST', 'COMPLIANCE', 'ADMIN')")
    @Operation(summary = "Dashboard KPI summary")
    public ResponseEntity<TransactionService.DashboardSummary> summary() {
        return ResponseEntity.ok(service.getDashboardSummary());
    }

    // ── DTO ────────────────────────────────────────────────────────────────
    public record CreateTransactionDto(
        @NotBlank String accountId,
        @NotBlank String counterpartyId,
        @NotNull @DecimalMin("0.01") BigDecimal amount,
        @NotBlank @Size(min = 3, max = 3) String currency
    ) {}
}
