package com.fintrack.transaction.model;

public enum TransactionStatus {
    INGESTED,       // Just received
    VALIDATING,     // Being checked
    ENRICHING,      // AI enrichment in progress
    PENDING_AI,     // AI unavailable — fallback state
    FLAGGED,        // Rule engine hit
    CLEARED,        // Clean — no issues
    REVIEWED        // Analyst has reviewed
}
