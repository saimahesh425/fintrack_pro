package com.fintrack.transaction.repository;

import com.fintrack.transaction.model.Transaction;
import com.fintrack.transaction.model.TransactionStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface TransactionRepository extends JpaRepository<Transaction, UUID> {

    Optional<Transaction> findByIdempotencyKey(String idempotencyKey);

    // Search with dynamic filters
    @Query("""
        SELECT t FROM Transaction t
        WHERE (:accountId    IS NULL OR t.accountId    = :accountId)
        AND   (:status       IS NULL OR t.status       = :status)
        AND   (:minAmount    IS NULL OR t.amount       >= :minAmount)
        AND   (:maxAmount    IS NULL OR t.amount       <= :maxAmount)
        AND   (:from         IS NULL OR t.createdAt    >= :from)
        AND   (:to           IS NULL OR t.createdAt    <= :to)
        AND   (:minRisk      IS NULL OR t.riskScore    >= :minRisk)
        ORDER BY t.createdAt DESC
        """)
    Page<Transaction> search(
            @Param("accountId")  String accountId,
            @Param("status")     TransactionStatus status,
            @Param("minAmount")  BigDecimal minAmount,
            @Param("maxAmount")  BigDecimal maxAmount,
            @Param("from")       Instant from,
            @Param("to")         Instant to,
            @Param("minRisk")    Integer minRisk,
            Pageable pageable);

    // Velocity check — count recent transactions for an account
    @Query("""
        SELECT COUNT(t) FROM Transaction t
        WHERE t.accountId = :accountId
        AND t.createdAt >= :since
        """)
    long countByAccountIdSince(
            @Param("accountId") String accountId,
            @Param("since")     Instant since);

    // Duplicate detection
    boolean existsByIdempotencyKeyAndStatusIn(
            String idempotencyKey,
            List<TransactionStatus> statuses);

    // Flagged transactions for compliance dashboard
    List<Transaction> findByStatusOrderByCreatedAtDesc(TransactionStatus status);

    // High risk transactions
    @Query("SELECT t FROM Transaction t WHERE t.riskScore >= :threshold ORDER BY t.riskScore DESC")
    List<Transaction> findHighRisk(@Param("threshold") int threshold, Pageable pageable);
}
