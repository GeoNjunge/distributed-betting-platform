#pragma once

#include <atomic>
#include <chrono>
#include <cstdint>
#include <memory>
#include <mutex>
#include <optional>
#include <shared_mutex>
#include <string>
#include <string_view>
#include <unordered_map>
#include <vector>

namespace risk_engine {

// BetSubmitted is the exact in-memory representation of one JSON event that
// arrives from Kafka topic `bets-submitted`.  The struct owns its strings so a
// Kafka message payload can be released immediately after parsing; no member is
// a raw pointer into librdkafka-owned memory.
struct BetSubmitted {
    std::string event_id;
    std::string bet_id;
    std::string account_id;
    std::string idempotency_key;
    std::string match_id;
    std::string market_id;
    std::string selection_id;
    std::string odds;
    std::int64_t stake_cents{};
    std::int64_t potential_payout_cents{};
    std::int64_t bet_timestamp_ms{};
};

// BetResult is serialized to JSON and written to topic `bets-results` after the
// risk decision is complete.  It is intentionally small and trivially movable;
// large strings are moved by std::string without manual memory management.
struct BetResult {
    std::string event_id;
    std::string bet_id;
    std::string account_id;
    std::string idempotency_key;
    std::string match_id;
    std::string selection_id;
    std::string odds;
    std::int64_t stake_cents{};
    bool accepted{};
    std::string reason_code;
    std::string reason;
    std::int64_t accepted_exposure_cents{};
    std::int64_t remaining_balance_cents{};
    std::int64_t decision_timestamp_ms{};
};

class RiskEngine {
public:
    explicit RiskEngine(std::int64_t single_account_exposure_cap_cents);

    // Non-copyable: copying would duplicate exposure/balance state and violate
    // risk accounting.  Moving is also disabled because atomics and mutexes have
    // stable addresses that worker code may rely on while the service runs.
    RiskEngine(const RiskEngine&) = delete;
    RiskEngine& operator=(const RiskEngine&) = delete;
    RiskEngine(RiskEngine&&) = delete;
    RiskEngine& operator=(RiskEngine&&) = delete;

    // Seeds or replaces a user's available balance.  The value is stored in an
    // atomic cell so hot-path debits can be performed with compare_exchange
    // instead of holding a coarse account-balance mutex.
    void set_balance(std::string account_id, std::int64_t balance_cents);

    // Parses, validates, and decides a bet in one call.  The payload is a
    // string_view to avoid copying Kafka bytes before validation; fields that
    // survive parsing are copied into owning std::strings in BetSubmitted.
    BetResult evaluate_json(std::string_view payload);

    // Converts a result to strict JSON matching schemas/bets-results.schema.json.
    static std::string to_json(const BetResult& result);

private:
    struct ParseOutcome {
        std::optional<BetSubmitted> bet;
        std::string error;
    };

    static ParseOutcome parse_bet_json(std::string_view payload);
    static std::int64_t now_epoch_ms();
    static std::string json_escape(std::string_view value);

    enum class BalanceDebitResult { Debited, InsufficientFunds, AccountNotFound };
    BalanceDebitResult try_debit_balance(const std::string& account_id,
                                         std::int64_t stake_cents,
                                         std::int64_t& remaining_balance_cents);
    void credit_balance(const std::string& account_id, std::int64_t stake_cents);
    bool try_reserve_exposure(const std::string& account_id,
                              std::int64_t exposure_cents,
                              std::int64_t& new_total_exposure_cents);
    void release_exposure(const std::string& account_id, std::int64_t exposure_cents);

    const std::int64_t single_account_exposure_cap_cents_;

    // Balance map design:
    // - unordered_map provides O(1) expected lookup and stores keys contiguously
    //   within bucket nodes managed by RAII.
    // - each mapped value is a unique_ptr<atomic<int64_t>>.  The unique_ptr gives
    //   stable heap storage for the atomic cell even if unordered_map rehashes;
    //   no raw owning pointer is exposed.
    // - shared_mutex protects the map's structure only.  Once an atomic cell is
    //   found, the debit loop is lock-free with respect to the balance value.
    mutable std::shared_mutex balances_mutex_;
    std::unordered_map<std::string, std::unique_ptr<std::atomic<std::int64_t>>> balances_;

    // Exposure updates require a check-then-add invariant across each account's
    // cumulative open exposure, so a small mutex protects this map.  The critical
    // section is deliberately narrow: hash lookup, integer addition, and store.
    mutable std::mutex exposure_mutex_;
    std::unordered_map<std::string, std::int64_t> open_exposure_cents_by_account_;
};

} // namespace risk_engine
