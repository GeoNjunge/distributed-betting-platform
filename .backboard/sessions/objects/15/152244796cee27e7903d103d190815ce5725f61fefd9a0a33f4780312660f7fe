#include "risk_engine.hpp"

#include <algorithm>
#include <array>
#include <charconv>
#include <limits>
#include <sstream>
#include <stdexcept>

namespace risk_engine {
namespace {

constexpr std::int64_t kStaleQuoteProtectionMs = 200;

struct FieldValue {
    bool is_string{};
    std::string_view raw;
};

struct ParsedObject {
    std::unordered_map<std::string, FieldValue> fields;
};

void skip_ws(std::string_view s, std::size_t& i) {
    while (i < s.size() && (s[i] == ' ' || s[i] == '\n' || s[i] == '\r' || s[i] == '\t')) {
        ++i;
    }
}

bool parse_json_string_token(std::string_view s, std::size_t& i, std::string& out) {
    if (i >= s.size() || s[i] != '"') {
        return false;
    }
    ++i;
    out.clear();
    while (i < s.size()) {
        const char c = s[i++];
        if (c == '"') {
            return true;
        }
        if (c == '\\') {
            if (i >= s.size()) {
                return false;
            }
            const char e = s[i++];
            switch (e) {
                case '"': out.push_back('"'); break;
                case '\\': out.push_back('\\'); break;
                case '/': out.push_back('/'); break;
                case 'b': out.push_back('\b'); break;
                case 'f': out.push_back('\f'); break;
                case 'n': out.push_back('\n'); break;
                case 'r': out.push_back('\r'); break;
                case 't': out.push_back('\t'); break;
                default: return false; // Strict mode: reject \u and non-standard escapes.
            }
        } else {
            if (static_cast<unsigned char>(c) < 0x20) {
                return false;
            }
            out.push_back(c);
        }
    }
    return false;
}

bool parse_object(std::string_view s, ParsedObject& obj, std::string& error) {
    std::size_t i = 0;
    skip_ws(s, i);
    if (i >= s.size() || s[i++] != '{') {
        error = "payload must be a JSON object";
        return false;
    }
    skip_ws(s, i);
    if (i < s.size() && s[i] == '}') {
        ++i;
    } else {
        while (i < s.size()) {
            std::string key;
            if (!parse_json_string_token(s, i, key)) {
                error = "object key must be a JSON string";
                return false;
            }
            if (obj.fields.contains(key)) {
                error = "duplicate field: " + key;
                return false;
            }
            skip_ws(s, i);
            if (i >= s.size() || s[i++] != ':') {
                error = "expected ':' after field: " + key;
                return false;
            }
            skip_ws(s, i);
            if (i >= s.size()) {
                error = "missing value for field: " + key;
                return false;
            }
            FieldValue value;
            if (s[i] == '"') {
                const std::size_t start = i;
                std::string decoded;
                if (!parse_json_string_token(s, i, decoded)) {
                    error = "invalid string value for field: " + key;
                    return false;
                }
                value.is_string = true;
                value.raw = s.substr(start, i - start);
            } else {
                const std::size_t start = i;
                if (s[i] == '-') {
                    ++i;
                }
                const std::size_t digits_start = i;
                while (i < s.size() && s[i] >= '0' && s[i] <= '9') {
                    ++i;
                }
                if (digits_start == i) {
                    error = "only integer and string values are accepted; bad field: " + key;
                    return false;
                }
                if (i < s.size() && (s[i] == '.' || s[i] == 'e' || s[i] == 'E')) {
                    error = "floating point values are forbidden for monetary/timestamp fields: " + key;
                    return false;
                }
                value.is_string = false;
                value.raw = s.substr(start, i - start);
            }
            obj.fields.emplace(std::move(key), value);
            skip_ws(s, i);
            if (i < s.size() && s[i] == ',') {
                ++i;
                skip_ws(s, i);
                continue;
            }
            if (i < s.size() && s[i] == '}') {
                ++i;
                break;
            }
            error = "expected ',' or '}'";
            return false;
        }
    }
    skip_ws(s, i);
    if (i != s.size()) {
        error = "trailing bytes after JSON object";
        return false;
    }
    return true;
}

std::optional<std::string> required_string(const ParsedObject& obj, const char* name, std::string& error) {
    const auto it = obj.fields.find(name);
    if (it == obj.fields.end()) {
        error = std::string("missing required field: ") + name;
        return std::nullopt;
    }
    if (!it->second.is_string) {
        error = std::string("field must be string: ") + name;
        return std::nullopt;
    }
    std::size_t pos = 0;
    std::string decoded;
    if (!parse_json_string_token(it->second.raw, pos, decoded) || pos != it->second.raw.size()) {
        error = std::string("invalid string encoding: ") + name;
        return std::nullopt;
    }
    if (decoded.empty() || decoded.size() > 128) {
        error = std::string("string field must be 1..128 bytes: ") + name;
        return std::nullopt;
    }
    return decoded;
}

std::optional<std::int64_t> required_i64(const ParsedObject& obj, const char* name, std::string& error) {
    const auto it = obj.fields.find(name);
    if (it == obj.fields.end()) {
        error = std::string("missing required field: ") + name;
        return std::nullopt;
    }
    if (it->second.is_string) {
        error = std::string("field must be integer: ") + name;
        return std::nullopt;
    }
    std::int64_t value = 0;
    const auto first = it->second.raw.data();
    const auto last = first + it->second.raw.size();
    const auto [ptr, ec] = std::from_chars(first, last, value);
    if (ec != std::errc{} || ptr != last) {
        error = std::string("integer out of range or malformed: ") + name;
        return std::nullopt;
    }
    return value;
}

} // namespace

RiskEngine::RiskEngine(std::int64_t single_account_exposure_cap_cents)
    : single_account_exposure_cap_cents_(single_account_exposure_cap_cents) {
    if (single_account_exposure_cap_cents_ <= 0) {
        throw std::invalid_argument("single-account exposure cap must be positive");
    }
}

void RiskEngine::set_balance(std::string account_id, std::int64_t balance_cents) {
    // The unique_ptr owns the atomic balance cell using RAII.  If insertion
    // succeeds, the cell lifetime is tied to the map entry; if insertion throws,
    // the temporary unique_ptr releases automatically and no leak is possible.
    auto cell = std::make_unique<std::atomic<std::int64_t>>(balance_cents);
    std::unique_lock lock(balances_mutex_);
    auto [it, inserted] = balances_.try_emplace(std::move(account_id), std::move(cell));
    if (!inserted) {
        // Existing cell remains at the same address.  Only its value changes,
        // which avoids invalidating readers that already found the atomic.
        it->second->store(balance_cents, std::memory_order_release);
    }
}

BetResult RiskEngine::evaluate_json(std::string_view payload) {
    const auto decision_time = now_epoch_ms();
    auto parsed = parse_bet_json(payload);
    if (!parsed.bet) {
        BetResult invalid;
        invalid.accepted = false;
        invalid.reason_code = "SCHEMA_INVALID";
        invalid.reason = parsed.error;
        invalid.decision_timestamp_ms = decision_time;
        return invalid;
    }

    const BetSubmitted& bet = *parsed.bet;
    BetResult result;
    result.event_id = bet.event_id;
    result.bet_id = bet.bet_id;
    result.account_id = bet.account_id;
    result.idempotency_key = bet.idempotency_key;
    result.match_id = bet.match_id;
    result.selection_id = bet.selection_id;
    result.odds = bet.odds;
    result.stake_cents = bet.stake_cents;
    result.decision_timestamp_ms = decision_time;

    const std::int64_t quote_age_ms = decision_time - bet.bet_timestamp_ms;
    if (quote_age_ms > kStaleQuoteProtectionMs) {
        result.accepted = false;
        result.reason_code = "STALE_QUOTE";
        result.reason = "bet timestamp is more than 200ms older than decision time";
        return result;
    }

    std::int64_t remaining_balance = 0;
    const auto debit = try_debit_balance(bet.account_id, bet.stake_cents, remaining_balance);
    if (debit == BalanceDebitResult::AccountNotFound) {
        result.accepted = false;
        result.reason_code = "ACCOUNT_NOT_FOUND";
        result.reason = "no balance cell exists for account";
        return result;
    }
    if (debit == BalanceDebitResult::InsufficientFunds) {
        result.accepted = false;
        result.reason_code = "INSUFFICIENT_FUNDS";
        result.reason = "available balance is below stake";
        result.remaining_balance_cents = remaining_balance;
        return result;
    }

    std::int64_t new_exposure = 0;
    if (!try_reserve_exposure(bet.account_id, bet.potential_payout_cents, new_exposure)) {
        // Balance debit happened first so the exposure critical section stays
        // short.  If exposure fails, compensate by atomically crediting back the
        // stake.  This keeps the account's balance/exposure state consistent.
        credit_balance(bet.account_id, bet.stake_cents);
        result.accepted = false;
        result.reason_code = "SAEC_EXCEEDED";
        result.reason = "single-account exposure cap would be exceeded";
        result.remaining_balance_cents = remaining_balance + bet.stake_cents;
        return result;
    }

    result.accepted = true;
    result.reason_code = "ACCEPTED";
    result.reason = "risk checks passed";
    result.accepted_exposure_cents = new_exposure;
    result.remaining_balance_cents = remaining_balance;
    return result;
}

RiskEngine::ParseOutcome RiskEngine::parse_bet_json(std::string_view payload) {
    ParsedObject obj;
    std::string error;
    if (!parse_object(payload, obj, error)) {
        return {std::nullopt, error};
    }

    static constexpr std::array<std::string_view, 11> allowed = {
        "event_id", "bet_id", "account_id", "idempotency_key", "match_id",
        "market_id", "selection_id", "stake_cents", "potential_payout_cents",
        "odds", "bet_timestamp_ms"};
    for (const auto& [key, _] : obj.fields) {
        if (std::find(allowed.begin(), allowed.end(), key) == allowed.end()) {
            return {std::nullopt, "unknown field forbidden by schema: " + key};
        }
    }

    BetSubmitted bet;
    auto event_id = required_string(obj, "event_id", error); if (!event_id) return {std::nullopt, error};
    auto bet_id = required_string(obj, "bet_id", error); if (!bet_id) return {std::nullopt, error};
    auto account_id = required_string(obj, "account_id", error); if (!account_id) return {std::nullopt, error};
    auto idempotency_key = required_string(obj, "idempotency_key", error); if (!idempotency_key) return {std::nullopt, error};
    auto match_id = required_string(obj, "match_id", error); if (!match_id) return {std::nullopt, error};
    auto market_id = required_string(obj, "market_id", error); if (!market_id) return {std::nullopt, error};
    auto selection_id = required_string(obj, "selection_id", error); if (!selection_id) return {std::nullopt, error};
    auto odds = required_string(obj, "odds", error); if (!odds) return {std::nullopt, error};
    auto stake = required_i64(obj, "stake_cents", error); if (!stake) return {std::nullopt, error};
    auto payout = required_i64(obj, "potential_payout_cents", error); if (!payout) return {std::nullopt, error};
    auto ts = required_i64(obj, "bet_timestamp_ms", error); if (!ts) return {std::nullopt, error};

    if (*stake <= 0) return {std::nullopt, "stake_cents must be positive"};
    if (*payout <= 0) return {std::nullopt, "potential_payout_cents must be positive"};
    if (*payout < *stake) return {std::nullopt, "potential_payout_cents must be >= stake_cents"};
    if (*ts <= 0) return {std::nullopt, "bet_timestamp_ms must be positive unix epoch milliseconds"};

    bet.event_id = std::move(*event_id);
    bet.bet_id = std::move(*bet_id);
    bet.account_id = std::move(*account_id);
    bet.idempotency_key = std::move(*idempotency_key);
    bet.match_id = std::move(*match_id);
    bet.market_id = std::move(*market_id);
    bet.selection_id = std::move(*selection_id);
    bet.odds = std::move(*odds);
    bet.stake_cents = *stake;
    bet.potential_payout_cents = *payout;
    bet.bet_timestamp_ms = *ts;
    return {std::move(bet), {}};
}

std::int64_t RiskEngine::now_epoch_ms() {
    using namespace std::chrono;
    return duration_cast<milliseconds>(system_clock::now().time_since_epoch()).count();
}

RiskEngine::BalanceDebitResult RiskEngine::try_debit_balance(const std::string& account_id,
                                                              std::int64_t stake_cents,
                                                              std::int64_t& remaining_balance_cents) {
    std::shared_lock lock(balances_mutex_);
    const auto it = balances_.find(account_id);
    if (it == balances_.end()) {
        return BalanceDebitResult::AccountNotFound;
    }
    std::atomic<std::int64_t>& balance = *it->second;

    // Compare/exchange loop: no heap allocation, no blocking, and no ownership
    // transfer.  memory_order_acq_rel publishes the debit to other threads that
    // acquire-load the balance.  On CAS failure, current is overwritten with the
    // newest observed value and the loop retries.
    std::int64_t current = balance.load(std::memory_order_acquire);
    while (true) {
        if (current < stake_cents) {
            remaining_balance_cents = current;
            return BalanceDebitResult::InsufficientFunds;
        }
        const std::int64_t desired = current - stake_cents;
        if (balance.compare_exchange_weak(current, desired,
                                          std::memory_order_acq_rel,
                                          std::memory_order_acquire)) {
            remaining_balance_cents = desired;
            return BalanceDebitResult::Debited;
        }
    }
}

void RiskEngine::credit_balance(const std::string& account_id, std::int64_t stake_cents) {
    std::shared_lock lock(balances_mutex_);
    const auto it = balances_.find(account_id);
    if (it != balances_.end()) {
        it->second->fetch_add(stake_cents, std::memory_order_acq_rel);
    }
}

bool RiskEngine::try_reserve_exposure(const std::string& account_id,
                                      std::int64_t exposure_cents,
                                      std::int64_t& new_total_exposure_cents) {
    std::lock_guard lock(exposure_mutex_);
    auto& current = open_exposure_cents_by_account_[account_id];
    if (current > single_account_exposure_cap_cents_ - exposure_cents) {
        new_total_exposure_cents = current;
        return false;
    }
    current += exposure_cents;
    new_total_exposure_cents = current;
    return true;
}

void RiskEngine::release_exposure(const std::string& account_id, std::int64_t exposure_cents) {
    std::lock_guard lock(exposure_mutex_);
    const auto it = open_exposure_cents_by_account_.find(account_id);
    if (it == open_exposure_cents_by_account_.end()) {
        return;
    }
    it->second = std::max<std::int64_t>(0, it->second - exposure_cents);
}

std::string RiskEngine::json_escape(std::string_view value) {
    std::string out;
    out.reserve(value.size() + 8);
    for (const char c : value) {
        switch (c) {
            case '"': out += "\\\""; break;
            case '\\': out += "\\\\"; break;
            case '\b': out += "\\b"; break;
            case '\f': out += "\\f"; break;
            case '\n': out += "\\n"; break;
            case '\r': out += "\\r"; break;
            case '\t': out += "\\t"; break;
            default:
                if (static_cast<unsigned char>(c) < 0x20) {
                    out += "?";
                } else {
                    out.push_back(c);
                }
        }
    }
    return out;
}

std::string RiskEngine::to_json(const BetResult& result) {
    // Reserve once to avoid repeated reallocations and keep serialization cache
    // friendly.  std::string owns the contiguous output buffer; librdkafka can
    // copy it synchronously with RK_MSG_COPY in main.cpp, so no dangling pointer
    // can outlive this function's caller-owned string.
    std::string json;
    json.reserve(320 + result.reason.size());
    json += "{";
    json += "\"event_id\":\"" + json_escape(result.event_id) + "\",";
    json += "\"bet_id\":\"" + json_escape(result.bet_id) + "\",";
    json += "\"account_id\":\"" + json_escape(result.account_id) + "\",";
    json += "\"idempotency_key\":\"" + json_escape(result.idempotency_key) + "\",";
    json += "\"match_id\":\"" + json_escape(result.match_id) + "\",";
    json += "\"selection_id\":\"" + json_escape(result.selection_id) + "\",";
    json += "\"stake_cents\":" + std::to_string(result.stake_cents) + ",";
    json += "\"odds\":\"" + json_escape(result.odds) + "\",";
    json += "\"accepted\":";
    json += result.accepted ? "true," : "false,";
    json += "\"reason_code\":\"" + json_escape(result.reason_code) + "\",";
    json += "\"reason\":\"" + json_escape(result.reason) + "\",";
    json += "\"accepted_exposure_cents\":" + std::to_string(result.accepted_exposure_cents) + ",";
    json += "\"remaining_balance_cents\":" + std::to_string(result.remaining_balance_cents) + ",";
    json += "\"decision_timestamp_ms\":" + std::to_string(result.decision_timestamp_ms);
    json += "}";
    return json;
}

} // namespace risk_engine
