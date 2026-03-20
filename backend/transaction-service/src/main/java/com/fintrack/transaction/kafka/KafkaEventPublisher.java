package com.fintrack.transaction.kafka;

import com.fintrack.transaction.model.Transaction;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.support.SendResult;
import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;

@Component
@RequiredArgsConstructor
@Slf4j
public class KafkaEventPublisher {

    private final KafkaTemplate<String, Object> kafkaTemplate;

    public static final String TOPIC_TRANSACTIONS  = "transaction-events";
    public static final String TOPIC_COMPLIANCE    = "compliance-events";
    public static final String TOPIC_AUDIT         = "audit-events";

    // Publish transaction update — WebSocket relay will forward to Angular
    public void publishTransactionEvent(Transaction tx) {
        CompletableFuture<SendResult<String, Object>> future =
                kafkaTemplate.send(TOPIC_TRANSACTIONS, tx.getId().toString(), tx);

        future.whenComplete((result, ex) -> {
            if (ex != null) {
                log.error("Failed to publish transaction event id={}: {}", tx.getId(), ex.getMessage());
            } else {
                log.debug("Transaction event published id={} partition={} offset={}",
                        tx.getId(),
                        result.getRecordMetadata().partition(),
                        result.getRecordMetadata().offset());
            }
        });
    }

    // Publish compliance event — CTR/SAR downstream processing
    public void publishComplianceEvent(Transaction tx, List<String> triggeredRules) {
        Map<String, Object> event = new HashMap<>();
        event.put("transactionId", tx.getId());
        event.put("accountId",     tx.getAccountId());
        event.put("amount",        tx.getAmount());
        event.put("currency",      tx.getCurrency());
        event.put("riskScore",     tx.getRiskScore());
        event.put("triggeredRules",triggeredRules);
        event.put("timestamp",     System.currentTimeMillis());

        kafkaTemplate.send(TOPIC_COMPLIANCE, tx.getId().toString(), event);
        log.info("Compliance event published for tx={} rules={}", tx.getId(), triggeredRules);
    }

    // Publish audit event
    public void publishAuditEvent(String transactionId, String action, String analyst) {
        Map<String, Object> event = new HashMap<>();
        event.put("transactionId", transactionId);
        event.put("action",        action);
        event.put("analyst",       analyst);
        event.put("timestamp",     System.currentTimeMillis());

        kafkaTemplate.send(TOPIC_AUDIT, transactionId, event);
    }
}
