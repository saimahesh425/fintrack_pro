package com.fintrack.ai.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

/**
 * Vector search service.
 * Local: simple keyword matching (no external dependencies)
 * AWS:   replace with OpenSearch kNN client
 */
@Service
@Slf4j
public class VectorSearchService {

    // Sample transaction data for local development
    private static final List<String> SAMPLE_TRANSACTIONS = Arrays.asList(
        "TX-001: Amount $15,000 USD | Account ACC-100 | Counterparty CORP-XYZ | Status FLAGGED | Risk 85 | Rule AML_THRESHOLD",
        "TX-002: Amount $500 USD   | Account ACC-200 | Counterparty IND-ABC  | Status CLEARED | Risk 10",
        "TX-003: Amount $9,800 USD | Account ACC-100 | Counterparty CORP-DEF | Status FLAGGED | Risk 65 | Rule STRUCTURING_SUSPECTED",
        "TX-004: Amount $1,200 USD | Account ACC-300 | Counterparty CORP-GHI | Status CLEARED | Risk 15",
        "TX-005: Amount $250,000 USD | Account ACC-400 | Counterparty INTL-JKL | Status FLAGGED | Risk 95 | Rules AML_THRESHOLD,VELOCITY_LIMIT",
        "TX-006: Amount $3,500 USD | Account ACC-200 | Counterparty CORP-MNO | Status REVIEWED | Risk 25",
        "TX-007: Amount $8,900 USD | Account ACC-100 | Counterparty CORP-PQR | Status FLAGGED | Risk 70 | Rule STRUCTURING_SUSPECTED",
        "TX-008: Amount $450 USD   | Account ACC-500 | Counterparty IND-STU  | Status CLEARED | Risk 5",
        "TX-009: Amount $50,000 USD | Account ACC-400 | Counterparty CORP-VWX | Status FLAGGED | Risk 90 | Rule AML_THRESHOLD",
        "TX-010: Amount $2,100 USD | Account ACC-300 | Counterparty CORP-YZA | Status CLEARED | Risk 20"
    );

    /**
     * Semantic/keyword search — returns matching transaction summaries.
     * In production: replace with OpenSearch kNN vector search.
     */
    public List<String> search(String query, int topK) {
        log.info("Searching for: {} (top {})", query, topK);
        return keywordSearch(query, topK);
    }

    /**
     * Simple keyword matching for local development.
     */
    public List<String> keywordSearch(String query, int topK) {
        String lowerQuery = query.toLowerCase();
        List<String> results = new ArrayList<>();

        for (String tx : SAMPLE_TRANSACTIONS) {
            if (isRelevant(tx.toLowerCase(), lowerQuery)) {
                results.add(tx);
            }
            if (results.size() >= topK) break;
        }

        // If no specific matches, return all flagged transactions
        if (results.isEmpty()) {
            SAMPLE_TRANSACTIONS.stream()
                    .filter(tx -> tx.contains("FLAGGED"))
                    .limit(topK)
                    .forEach(results::add);
        }

        log.info("Found {} relevant transactions for query: {}", results.size(), query);
        return results;
    }

    private boolean isRelevant(String transaction, String query) {
        // Extract keywords from query
        String[] keywords = query.split("\\s+");
        int matchCount = 0;
        for (String keyword : keywords) {
            if (keyword.length() > 3 && transaction.contains(keyword)) {
                matchCount++;
            }
        }
        // Also match on common intent words
        if (query.contains("high risk") || query.contains("flagged") || query.contains("suspicious")) {
            return transaction.contains("flagged") || transaction.contains("risk 7")
                    || transaction.contains("risk 8") || transaction.contains("risk 9");
        }
        if (query.contains("aml") || query.contains("threshold") || query.contains("large")) {
            return transaction.contains("aml_threshold");
        }
        if (query.contains("structuring")) {
            return transaction.contains("structuring");
        }
        return matchCount >= 1;
    }
}
