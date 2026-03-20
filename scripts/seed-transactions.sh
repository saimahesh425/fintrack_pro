#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# seed-transactions.sh
# Seeds FinTrack with realistic test transactions covering all rule scenarios
# Usage: chmod +x seed-transactions.sh && ./seed-transactions.sh
# ─────────────────────────────────────────────────────────────────────────────

BASE_URL="http://localhost:8081/api/transactions"
TOTAL=0
FLAGGED=0

echo "🌱 Seeding FinTrack with test transactions..."
echo ""

post_tx() {
    local account="$1"
    local counterparty="$2"
    local amount="$3"
    local currency="$4"
    local label="$5"
    local key=$(uuidgen 2>/dev/null || cat /proc/sys/kernel/random/uuid)

    response=$(curl -s -X POST "$BASE_URL" \
        -H "Content-Type: application/json" \
        -H "Idempotency-Key: $key" \
        -d "{\"accountId\":\"$account\",\"counterpartyId\":\"$counterparty\",\"amount\":$amount,\"currency\":\"$currency\"}")

    status=$(echo "$response" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
    risk=$(echo "$response" | grep -o '"riskScore":[0-9]*' | cut -d':' -f2)
    TOTAL=$((TOTAL + 1))
    if [ "$status" = "FLAGGED" ]; then FLAGGED=$((FLAGGED + 1)); fi
    echo "  [$label] Amount: \$$amount $currency | Status: $status | Risk: $risk"
}

echo "── Normal transactions (should CLEAR) ──────────────────────"
post_tx "ACC-100" "CORP-RETAIL" "250.00"   "USD" "Small retail payment"
post_tx "ACC-101" "CORP-ONLINE" "89.99"    "USD" "Online purchase"
post_tx "ACC-102" "IND-CLIENT"  "1500.00"  "EUR" "Service invoice"
post_tx "ACC-103" "CORP-VENDOR" "3200.00"  "GBP" "Vendor payment"
post_tx "ACC-104" "IND-PARTNER" "450.50"   "USD" "Consulting fee"

echo ""
echo "── AML threshold triggers (should FLAG) ────────────────────"
post_tx "ACC-200" "CORP-LARGE"  "15000.00"  "USD" "AML threshold breach"
post_tx "ACC-201" "INTL-CORP"   "50000.00"  "USD" "Large international transfer"
post_tx "ACC-202" "CORP-BIG"    "250000.00" "USD" "Very large transaction"
post_tx "ACC-203" "CORP-MEDIUM" "12500.00"  "EUR" "Above EUR threshold"

echo ""
echo "── Structuring suspected (just below threshold) ─────────────"
post_tx "ACC-300" "CORP-STRUCT" "9800.00"  "USD" "Near-threshold 1"
post_tx "ACC-300" "CORP-STRUCT" "9750.00"  "USD" "Near-threshold 2"
post_tx "ACC-300" "CORP-STRUCT" "9900.00"  "USD" "Near-threshold 3"

echo ""
echo "── High volume account (velocity check) ─────────────────────"
for i in $(seq 1 5); do
    post_tx "ACC-400" "CORP-VELOCITY" "$((100 + i * 50)).00" "USD" "Velocity tx $i"
done

echo ""
echo "── Compliance sensitive transactions ────────────────────────"
post_tx "ACC-500" "INTL-OFFSHORE" "75000.00"  "USD" "Offshore transfer"
post_tx "ACC-501" "CORP-WATCHLIST" "25000.00" "USD" "Watchlist counterparty"
post_tx "ACC-502" "INTL-HIGHRISK"  "18000.00" "GBP" "High-risk jurisdiction"

echo ""
echo "─────────────────────────────────────────────────────────────"
echo "✅ Seeding complete!"
echo "   Total transactions: $TOTAL"
echo "   Flagged:            $FLAGGED"
echo ""
echo "📊 View dashboard:     http://localhost:4200"
echo "📋 Swagger UI:         http://localhost:8081/swagger-ui.html"
echo "🔍 Kafka UI:           http://localhost:8090"
echo "💾 H2 Console:         http://localhost:8081/h2-console"
