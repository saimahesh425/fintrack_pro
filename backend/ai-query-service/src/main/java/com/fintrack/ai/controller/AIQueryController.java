package com.fintrack.ai.controller;

import com.fintrack.ai.service.AIQueryService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.http.codec.ServerSentEvent;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Flux;

import java.time.Duration;

@RestController
@RequestMapping("/api/ai")
@RequiredArgsConstructor
@Slf4j
@CrossOrigin(origins = {"http://localhost:4200", "${app.cors.allowed-origins}"})
public class AIQueryController {

    private final AIQueryService aiQueryService;

    // ── SSE streaming endpoint ──────────────────────────────────────────
    @GetMapping(value = "/query", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public Flux<ServerSentEvent<String>> query(
            @RequestParam String q,
            @RequestHeader(value = "Authorization", required = false) String auth) {

        log.info("AI query received: {}", q);

        return aiQueryService.query(q)
                .map(token -> ServerSentEvent.<String>builder()
                        .event("token")
                        .data(token)
                        .build())
                .concatWith(Flux.just(
                        ServerSentEvent.<String>builder()
                                .event("done")
                                .data("[DONE]")
                                .build()))
                .timeout(Duration.ofSeconds(60))
                .doOnError(e -> log.error("SSE stream error: {}", e.getMessage()));
    }

    // ── Health check ───────────────────────────────────────────────────
    @GetMapping("/health")
    public String health() {
        return "AI Query Service is running";
    }
}
