package com.fintrack.websocket.relay;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.kafka.support.Acknowledgment;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;

import java.util.Map;

@Component
@RequiredArgsConstructor
@Slf4j
public class KafkaToWebSocketRelay {

    private final SimpMessagingTemplate messagingTemplate;
    private final ObjectMapper objectMapper;

    // ── Relay transaction events → Angular /topic/transactions ────────────
    @KafkaListener(
        topics = "transaction-events",
        groupId = "websocket-relay-transactions",
        concurrency = "2"
    )
    public void relayTransactionEvent(String payload, Acknowledgment ack) {
        try {
            Map<?, ?> event = objectMapper.readValue(payload, Map.class);
            messagingTemplate.convertAndSend("/topic/transactions", event);
            log.debug("Relayed transaction event to WebSocket");
            ack.acknowledge();
        } catch (Exception e) {
            log.error("Failed to relay transaction event: {}", e.getMessage());
            ack.acknowledge(); // Acknowledge to avoid DLQ for parse errors
        }
    }

    // ── Relay compliance events → Angular /topic/compliance-alerts ────────
    @KafkaListener(
        topics = "compliance-events",
        groupId = "websocket-relay-compliance",
        concurrency = "1"
    )
    public void relayComplianceEvent(String payload, Acknowledgment ack) {
        try {
            Map<?, ?> event = objectMapper.readValue(payload, Map.class);
            messagingTemplate.convertAndSend("/topic/compliance-alerts", event);
            log.info("Relayed compliance alert to WebSocket");
            ack.acknowledge();
        } catch (Exception e) {
            log.error("Failed to relay compliance event: {}", e.getMessage());
            ack.acknowledge();
        }
    }

    // ── Relay audit events → Angular /topic/audit ─────────────────────────
    @KafkaListener(
        topics = "audit-events",
        groupId = "websocket-relay-audit",
        concurrency = "1"
    )
    public void relayAuditEvent(String payload, Acknowledgment ack) {
        try {
            Map<?, ?> event = objectMapper.readValue(payload, Map.class);
            messagingTemplate.convertAndSend("/topic/audit", event);
            ack.acknowledge();
        } catch (Exception e) {
            log.error("Failed to relay audit event: {}", e.getMessage());
            ack.acknowledge();
        }
    }
}
