package com.fintrack.ai.service;

import io.github.resilience4j.circuitbreaker.annotation.CircuitBreaker;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Flux;

import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
public class AIQueryService {

    private final WebClient openAiClient;
    private final VectorSearchService vectorSearch;

    @Value("${ai.openai.model:gpt-4o-mini}")
    private String model;

    @Value("${ai.openai.enabled:true}")
    private boolean aiEnabled;

    // ── Main RAG query pipeline ──────────────────────────────────────────
    @CircuitBreaker(name = "openai", fallbackMethod = "keywordFallback")
    public Flux<String> query(String naturalLanguageQuery) {
        if (!aiEnabled) {
            return keywordFallback(naturalLanguageQuery, new RuntimeException("AI disabled"));
        }

        log.info("Processing AI query: {}", naturalLanguageQuery);

        // Step 1: Search for relevant transactions
        List<String> relevantTransactions = vectorSearch.search(naturalLanguageQuery, 10);

        // Step 2: Build RAG prompt
        String prompt = buildRagPrompt(naturalLanguageQuery, relevantTransactions);

        // Step 3: Stream from OpenAI
        return streamFromOpenAI(prompt);
    }

    // ── OpenAI streaming call ────────────────────────────────────────────
    private Flux<String> streamFromOpenAI(String prompt) {
        Map<String, Object> requestBody = Map.of(
            "model",  model,
            "stream", true,
            "messages", List.of(
                Map.of("role", "system", "content",
                    "You are a financial compliance analyst assistant. " +
                    "Answer questions about transactions based ONLY on the data provided. " +
                    "Never fabricate transaction details. Be concise and factual."),
                Map.of("role", "user", "content", prompt)
            ),
            "max_tokens",  1024,
            "temperature", 0.1    // Low temperature = factual responses
        );

        return openAiClient.post()
                .uri("/chat/completions")
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(requestBody)
                .retrieve()
                .bodyToFlux(String.class)
                .filter(chunk -> !chunk.equals("[DONE]"))
                .map(this::extractToken)
                .filter(token -> token != null && !token.isEmpty())
                .doOnError(e -> log.error("OpenAI streaming error: {}", e.getMessage()));
    }

    // ── RAG prompt builder ───────────────────────────────────────────────
    private String buildRagPrompt(String query, List<String> transactions) {
        StringBuilder sb = new StringBuilder();
        sb.append("RELEVANT TRANSACTIONS:\n");
        for (int i = 0; i < transactions.size(); i++) {
            sb.append(i + 1).append(". ").append(transactions.get(i)).append("\n");
        }
        sb.append("\nQUESTION: ").append(query);
        sb.append("\nANSWER (based only on the transactions above):");
        return sb.toString();
    }

    // ── Extract token from SSE chunk ────────────────────────────────────
    private String extractToken(String chunk) {
        try {
            // Parse "data: {...}" SSE format
            if (chunk.startsWith("data: ")) {
                String json = chunk.substring(6);
                // Simple token extraction — use Jackson in production
                int idx = json.indexOf("\"content\":\"");
                if (idx >= 0) {
                    int start = idx + 11;
                    int end = json.indexOf("\"", start);
                    return end > start ? json.substring(start, end) : "";
                }
            }
        } catch (Exception e) {
            log.debug("Token parse error: {}", e.getMessage());
        }
        return "";
    }

    // ── Circuit breaker fallback — keyword search when AI unavailable ────
    public Flux<String> keywordFallback(String query, Exception ex) {
        log.warn("AI unavailable, using keyword fallback: {}", ex.getMessage());
        List<String> results = vectorSearch.keywordSearch(query, 10);
        String response = "[AI analysis temporarily unavailable — showing keyword search results]\n\n"
                + String.join("\n", results);
        return Flux.just(response);
    }
}
