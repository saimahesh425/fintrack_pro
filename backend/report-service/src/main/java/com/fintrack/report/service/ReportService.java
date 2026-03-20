package com.fintrack.report.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import java.util.concurrent.CompletableFuture;

import java.io.StringWriter;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

@Service
@RequiredArgsConstructor
@Slf4j
public class ReportService {

    // In-memory job store for local dev — use Redis/DB in production
    private final Map<String, ReportJob> jobs = new ConcurrentHashMap<>();
    private final WebClient transactionServiceClient;

    // ── Request a new report (async) ──────────────────────────────────────
    public ReportJob requestReport(ReportRequest request) {
        String jobId = UUID.randomUUID().toString();
        ReportJob job = ReportJob.builder()
                .jobId(jobId)
                .type(request.getType())
                .status(JobStatus.PENDING)
                .requestedAt(Instant.now())
                .build();
        jobs.put(jobId, job);

        // Generate asynchronously
//        Thread.ofVirtual().start(() -> generateReport(jobId, request));

        new Thread(() -> generateReport(jobId, request)).start();

        log.info("Report job created jobId={} type={}", jobId, request.getType());
        return job;
    }

    // ── Get job status ────────────────────────────────────────────────────
    public Optional<ReportJob> getJob(String jobId) {
        return Optional.ofNullable(jobs.get(jobId));
    }

    // ── Generate report content ───────────────────────────────────────────
    private void generateReport(String jobId, ReportRequest request) {
        ReportJob job = jobs.get(jobId);
        try {
            job.setStatus(JobStatus.PROCESSING);

            // Fetch data from transaction service
            List<Map<String, Object>> transactions = fetchTransactions(request);

            String content;
            if ("CSV".equalsIgnoreCase(request.getFormat())) {
                content = generateCsv(transactions, request.getType());
                job.setFormat("text/csv");
                job.setFileName("report_" + request.getType().toLowerCase() + "_"
                        + DateTimeFormatter.ofPattern("yyyyMMdd")
                                .withZone(ZoneId.systemDefault())
                                .format(Instant.now()) + ".csv");
            } else {
                content = generateTextReport(transactions, request.getType());
                job.setFormat("text/plain");
                job.setFileName("report_" + request.getType().toLowerCase() + ".txt");
            }

            job.setContent(content);
            job.setStatus(JobStatus.READY);
            job.setCompletedAt(Instant.now());
            log.info("Report generated jobId={} rows={}", jobId, transactions.size());

        } catch (Exception e) {
            job.setStatus(JobStatus.FAILED);
            job.setErrorMessage(e.getMessage());
            log.error("Report generation failed jobId={}: {}", jobId, e.getMessage());
        }
    }

    // ── CSV generator ─────────────────────────────────────────────────────
    private String generateCsv(List<Map<String, Object>> transactions, String type) {
        StringWriter sw = new StringWriter();
        // Header
        sw.write("Transaction ID,Account ID,Counterparty,Amount,Currency,Status,Risk Score,Created At\n");
        DateTimeFormatter fmt = DateTimeFormatter.ISO_INSTANT;
        for (Map<String, Object> tx : transactions) {
            sw.write(String.format("\"%s\",\"%s\",\"%s\",\"%s\",\"%s\",\"%s\",\"%s\",\"%s\"\n",
                    tx.getOrDefault("id", ""),
                    tx.getOrDefault("accountId", ""),
                    tx.getOrDefault("counterpartyId", ""),
                    tx.getOrDefault("amount", ""),
                    tx.getOrDefault("currency", ""),
                    tx.getOrDefault("status", ""),
                    tx.getOrDefault("riskScore", ""),
                    tx.getOrDefault("createdAt", "")));
        }
        return sw.toString();
    }

    // ── Text report generator ─────────────────────────────────────────────
    private String generateTextReport(List<Map<String, Object>> transactions, String type) {
        StringBuilder sb = new StringBuilder();
        sb.append("=".repeat(60)).append("\n");
        sb.append("FinTrack Compliance Report — ").append(type).append("\n");
        sb.append("Generated: ").append(Instant.now()).append("\n");
        sb.append("Total transactions: ").append(transactions.size()).append("\n");
        sb.append("=".repeat(60)).append("\n\n");

        for (Map<String, Object> tx : transactions) {
            sb.append("ID:           ").append(tx.getOrDefault("id", "N/A")).append("\n");
            sb.append("Account:      ").append(tx.getOrDefault("accountId", "N/A")).append("\n");
            sb.append("Counterparty: ").append(tx.getOrDefault("counterpartyId", "N/A")).append("\n");
            sb.append("Amount:       ").append(tx.getOrDefault("amount", "N/A"))
              .append(" ").append(tx.getOrDefault("currency", "")).append("\n");
            sb.append("Status:       ").append(tx.getOrDefault("status", "N/A")).append("\n");
            sb.append("Risk Score:   ").append(tx.getOrDefault("riskScore", "N/A")).append("\n");
            sb.append("-".repeat(40)).append("\n");
        }
        return sb.toString();
    }

    // ── Fetch transactions from transaction-service ────────────────────────
    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> fetchTransactions(ReportRequest request) {
        try {
            String statusFilter = "AML_REPORT".equals(request.getType()) ? "FLAGGED" : "";
            return transactionServiceClient.get()
                    .uri(uriBuilder -> uriBuilder
                            .path("/api/transactions")
                            .queryParamIfPresent("status",
                                Optional.ofNullable(statusFilter.isEmpty() ? null : statusFilter))
                            .queryParam("size", 1000)
                            .build())
                    .retrieve()
                    .bodyToMono(Map.class)
                    .map(page -> (List<Map<String, Object>>) page.getOrDefault("content", List.of()))
                    .block();
        } catch (Exception e) {
            log.warn("Could not fetch from transaction service, using mock data: {}", e.getMessage());
            return getMockTransactions();
        }
    }

    private List<Map<String, Object>> getMockTransactions() {
        return List.of(
            Map.of("id","TX-001","accountId","ACC-100","counterpartyId","CORP-XYZ",
                   "amount","15000","currency","USD","status","FLAGGED","riskScore","85"),
            Map.of("id","TX-003","accountId","ACC-100","counterpartyId","CORP-DEF",
                   "amount","9800","currency","USD","status","FLAGGED","riskScore","65"),
            Map.of("id","TX-005","accountId","ACC-400","counterpartyId","INTL-JKL",
                   "amount","250000","currency","USD","status","FLAGGED","riskScore","95")
        );
    }

    // ── Data models ───────────────────────────────────────────────────────
    @lombok.Data @lombok.Builder
    public static class ReportJob {
        private String jobId;
        private String type;
        private JobStatus status;
        private String format;
        private String fileName;
        private String content;
        private String errorMessage;
        private Instant requestedAt;
        private Instant completedAt;
    }

    @lombok.Data
    public static class ReportRequest {
        private String type;    // AML_REPORT, SAR_REPORT, ACTIVITY_REPORT
        private String format;  // CSV, TEXT
        private Instant from;
        private Instant to;
    }

    public enum JobStatus { PENDING, PROCESSING, READY, FAILED }
}
