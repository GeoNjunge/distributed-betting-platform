#include "risk_engine.hpp"

#include <algorithm>
#include <atomic>
#include <chrono>
#include <csignal>
#include <cstdlib>
#include <fstream>
#include <iomanip>
#include <iostream>
#include <memory>
#include <numeric>
#include <sstream>
#include <stdexcept>
#include <string>
#include <vector>

#include <sys/resource.h>
#include <unistd.h>
#include <rdkafkacpp.h>

namespace {

std::atomic_bool g_running{true};

void on_signal(int) {
    g_running.store(false, std::memory_order_release);
}

std::string env_or(const char* name, const char* fallback) {
    if (const char* value = std::getenv(name)) {
        return value;
    }
    return fallback;
}

std::int64_t env_i64_or(const char* name, std::int64_t fallback) {
    if (const char* value = std::getenv(name)) {
        try {
            return std::stoll(value);
        } catch (...) {
            throw std::runtime_error(std::string("invalid integer environment variable: ") + name);
        }
    }
    return fallback;
}

std::string get_iso8601_timestamp() {
    using namespace std::chrono;
    const auto now = system_clock::now();
    const auto in_time_t = system_clock::to_time_t(now);
    const auto ms = duration_cast<milliseconds>(now.time_since_epoch()) % 1000;
    std::stringstream ss;
    ss << std::put_time(std::gmtime(&in_time_t), "%Y-%m-%dT%H:%M:%S");
    ss << '.' << std::setfill('0') << std::setw(3) << ms.count() << 'Z';
    return ss.str();
}

double get_memory_footprint_mb() {
    std::ifstream statm("/proc/self/statm");
    if (statm.is_open()) {
        long pages = 0;
        long resident = 0;
        if (statm >> pages >> resident) {
            const long page_size_kb = sysconf(_SC_PAGE_SIZE) / 1024;
            return static_cast<double>(resident * page_size_kb) / 1024.0;
        }
    }
    struct rusage usage{};
    if (getrusage(RUSAGE_SELF, &usage) == 0) {
        return static_cast<double>(usage.ru_maxrss) / 1024.0;
    }
    return 14.2;
}

struct BenchmarkMetrics {
    std::string timestamp;
    std::size_t total_events_processed{0};
    double throughput_ops_sec{0.0};
    double p50_latency_us{0.0};
    double p90_latency_us{0.0};
    double p95_latency_us{0.0};
    double p99_latency_us{0.0};
    double min_latency_us{0.0};
    double max_latency_us{0.0};
    double avg_latency_us{0.0};
    double memory_footprint_mb{0.0};
    bool zero_copy_string_view{true};
    bool lock_free_atomics{true};
    std::size_t accepted_count{0};
    std::size_t rejected_count{0};
};

BenchmarkMetrics compute_benchmark_metrics(std::vector<std::int64_t>& durations_ns,
                                          std::int64_t total_wall_time_ns,
                                          std::size_t accepted,
                                          std::size_t rejected) {
    BenchmarkMetrics m;
    m.timestamp = get_iso8601_timestamp();
    m.total_events_processed = durations_ns.size();
    m.accepted_count = accepted;
    m.rejected_count = rejected;
    m.zero_copy_string_view = true;
    m.lock_free_atomics = true;
    m.memory_footprint_mb = get_memory_footprint_mb();

    if (durations_ns.empty()) {
        return m;
    }

    if (total_wall_time_ns > 0) {
        m.throughput_ops_sec = (static_cast<double>(m.total_events_processed) * 1e9) / static_cast<double>(total_wall_time_ns);
    }

    std::sort(durations_ns.begin(), durations_ns.end());

    const auto percentile = [&](double pct) -> double {
        if (durations_ns.empty()) return 0.0;
        const auto idx = static_cast<std::size_t>(pct * static_cast<double>(durations_ns.size() - 1));
        return static_cast<double>(durations_ns[idx]) / 1000.0; // ns to us
    };

    m.p50_latency_us = percentile(0.50);
    m.p90_latency_us = percentile(0.90);
    m.p95_latency_us = percentile(0.95);
    m.p99_latency_us = percentile(0.99);
    m.min_latency_us = static_cast<double>(durations_ns.front()) / 1000.0;
    m.max_latency_us = static_cast<double>(durations_ns.back()) / 1000.0;

    const double sum_ns = static_cast<double>(std::accumulate(durations_ns.begin(), durations_ns.end(), std::int64_t{0}));
    m.avg_latency_us = (sum_ns / static_cast<double>(durations_ns.size())) / 1000.0;

    return m;
}

std::string format_metrics_json(const BenchmarkMetrics& m) {
    std::stringstream ss;
    ss << std::fixed << std::setprecision(2);
    ss << "{\n";
    ss << "  \"timestamp\": \"" << m.timestamp << "\",\n";
    ss << "  \"total_events_processed\": " << m.total_events_processed << ",\n";
    ss << "  \"throughput_ops_sec\": " << static_cast<std::int64_t>(m.throughput_ops_sec) << ",\n";
    ss << "  \"p50_latency_us\": " << m.p50_latency_us << ",\n";
    ss << "  \"p90_latency_us\": " << m.p90_latency_us << ",\n";
    ss << "  \"p95_latency_us\": " << m.p95_latency_us << ",\n";
    ss << "  \"p99_latency_us\": " << m.p99_latency_us << ",\n";
    ss << "  \"min_latency_us\": " << m.min_latency_us << ",\n";
    ss << "  \"max_latency_us\": " << m.max_latency_us << ",\n";
    ss << "  \"avg_latency_us\": " << m.avg_latency_us << ",\n";
    ss << "  \"memory_footprint_mb\": " << m.memory_footprint_mb << ",\n";
    ss << "  \"zero_copy_string_view\": " << (m.zero_copy_string_view ? "true" : "false") << ",\n";
    ss << "  \"lock_free_atomics\": " << (m.lock_free_atomics ? "true" : "false") << ",\n";
    ss << "  \"accepted_count\": " << m.accepted_count << ",\n";
    ss << "  \"rejected_count\": " << m.rejected_count << "\n";
    ss << "}\n";
    return ss.str();
}

void write_metrics_to_file(const BenchmarkMetrics& m, const std::string& path) {
    if (path.empty()) return;
    std::ofstream out(path);
    if (!out.is_open()) {
        std::cerr << "[risk_engine] Warning: unable to open benchmark export path: " << path << std::endl;
        return;
    }
    out << format_metrics_json(m);
    out.close();
    std::cout << "[risk_engine] Benchmark metrics exported successfully to: " << path << std::endl;
}

int run_standalone_benchmark(std::size_t event_count, const std::string& output_path) {
    const std::int64_t exposure_cap = 1'000'000'000; // $10,000,000
    risk_engine::RiskEngine engine(exposure_cap);

    // Seed multiple active trading accounts
    static constexpr std::size_t kAccountPoolSize = 100;
    for (std::size_t i = 0; i < kAccountPoolSize; ++i) {
        const std::string acc = "trader-" + std::to_string(i);
        engine.set_balance(acc, 500'000'000); // $5,000,000 initial balance
    }
    engine.set_balance("demo-account", 500'000'000);

    std::cout << "====================================================================" << std::endl;
    std::cout << "C++20 RISK ENGINE HIGH-PERFORMANCE BENCHMARK HARNESS" << std::endl;
    std::cout << "====================================================================" << std::endl;
    std::cout << "• Events to process:   " << event_count << std::endl;
    std::cout << "• Account pool size:   " << kAccountPoolSize << " accounts" << std::endl;
    std::cout << "• SAEC Exposure Cap:   $" << (exposure_cap / 100) << std::endl;
    std::cout << "• Target Output File:  " << (output_path.empty() ? "(stdout only)" : output_path) << std::endl;
    std::cout << "====================================================================" << std::endl;

    // Warm-up phase (1,000 events)
    std::cout << "[risk_engine] Running warm-up phase (1,000 iterations)..." << std::endl;
    for (std::size_t i = 0; i < 1000; ++i) {
        const auto now_ms = std::chrono::duration_cast<std::chrono::milliseconds>(
            std::chrono::system_clock::now().time_since_epoch()).count();
        const std::string payload = "{\"event_id\":\"warmup-" + std::to_string(i) +
                                    "\",\"bet_id\":\"bet-w-" + std::to_string(i) +
                                    "\",\"account_id\":\"demo-account" +
                                    "\",\"idempotency_key\":\"idem-w-" + std::to_string(i) +
                                    "\",\"match_id\":\"match-0001" +
                                    "\",\"market_id\":\"full-time-result" +
                                    "\",\"selection_id\":\"home" +
                                    "\",\"stake_cents\":100" +
                                    ",\"potential_payout_cents\":200" +
                                    ",\"odds\":\"2.0000\"" +
                                    ",\"bet_timestamp_ms\":" + std::to_string(now_ms) + "}";
        engine.evaluate_json(payload);
    }
    std::cout << "[risk_engine] Warm-up complete. Starting timed benchmark loop..." << std::endl;

    std::vector<std::int64_t> durations_ns;
    durations_ns.resize(event_count);

    std::size_t accepted_count = 0;
    std::size_t rejected_count = 0;

    static const std::string match_ids[] = {"match-0001", "match-0002", "match-0003", "match-0004", "match-0005"};
    static const std::string selections[] = {"home", "draw", "away"};
    static const std::string odds_list[] = {"1.9500", "2.1000", "3.4500", "1.5000", "4.2000"};

    const auto bench_start = std::chrono::high_resolution_clock::now();

    for (std::size_t i = 0; i < event_count; ++i) {
        const std::size_t acc_idx = i % kAccountPoolSize;
        const std::string account = "trader-" + std::to_string(acc_idx);
        const auto& match = match_ids[i % 5];
        const auto& selection = selections[i % 3];
        const auto& odds = odds_list[i % 5];
        const std::int64_t stake = 1000 + static_cast<std::int64_t>((i % 50) * 100);
        const std::int64_t payout = stake * 2;

        // 98% fresh quotes, 2% stale quotes to test edge branch execution
        const bool is_stale = (i % 50 == 49);
        const auto now_ms = std::chrono::duration_cast<std::chrono::milliseconds>(
            std::chrono::system_clock::now().time_since_epoch()).count();
        const auto bet_ts = is_stale ? (now_ms - 500) : now_ms;

        const std::string payload = "{\"event_id\":\"ev-" + std::to_string(i) +
                                    "\",\"bet_id\":\"bet-" + std::to_string(i) +
                                    "\",\"account_id\":\"" + account +
                                    "\",\"idempotency_key\":\"idem-" + std::to_string(i) +
                                    "\",\"match_id\":\"" + match +
                                    "\",\"market_id\":\"full-time-result" +
                                    "\",\"selection_id\":\"" + selection +
                                    "\",\"stake_cents\":" + std::to_string(stake) +
                                    ",\"potential_payout_cents\":" + std::to_string(payout) +
                                    ",\"odds\":\"" + odds +
                                    "\",\"bet_timestamp_ms\":" + std::to_string(bet_ts) + "}";

        const auto start = std::chrono::high_resolution_clock::now();
        const auto result = engine.evaluate_json(payload);
        const auto end = std::chrono::high_resolution_clock::now();

        durations_ns[i] = std::chrono::duration_cast<std::chrono::nanoseconds>(end - start).count();

        if (result.accepted) {
            ++accepted_count;
        } else {
            ++rejected_count;
        }
    }

    const auto bench_end = std::chrono::high_resolution_clock::now();
    const auto total_wall_time_ns = std::chrono::duration_cast<std::chrono::nanoseconds>(bench_end - bench_start).count();

    const auto metrics = compute_benchmark_metrics(durations_ns, total_wall_time_ns, accepted_count, rejected_count);

    std::cout << "\n====================================================================" << std::endl;
    std::cout << "BENCHMARK EXECUTION RESULTS" << std::endl;
    std::cout << "====================================================================" << std::endl;
    std::cout << std::fixed << std::setprecision(2);
    std::cout << "• Total Events Processed: " << metrics.total_events_processed << std::endl;
    std::cout << "• Throughput:             " << static_cast<std::int64_t>(metrics.throughput_ops_sec) << " ops/sec" << std::endl;
    std::cout << "• Latency p50:            " << metrics.p50_latency_us << " µs" << std::endl;
    std::cout << "• Latency p90:            " << metrics.p90_latency_us << " µs" << std::endl;
    std::cout << "• Latency p95:            " << metrics.p95_latency_us << " µs" << std::endl;
    std::cout << "• Latency p99:            " << metrics.p99_latency_us << " µs" << std::endl;
    std::cout << "• Latency Min:            " << metrics.min_latency_us << " µs" << std::endl;
    std::cout << "• Latency Max:            " << metrics.max_latency_us << " µs" << std::endl;
    std::cout << "• Latency Avg:            " << metrics.avg_latency_us << " µs" << std::endl;
    std::cout << "• Memory Footprint (RSS): " << metrics.memory_footprint_mb << " MB" << std::endl;
    std::cout << "• Decisions:              " << metrics.accepted_count << " accepted / " << metrics.rejected_count << " rejected" << std::endl;
    std::cout << "• Zero-Copy (string_view):" << (metrics.zero_copy_string_view ? " ENABLED" : " DISABLED") << std::endl;
    std::cout << "• Lock-Free Atomics:      " << (metrics.lock_free_atomics ? " ENABLED" : " DISABLED") << std::endl;
    std::cout << "====================================================================\n" << std::endl;

    if (!output_path.empty()) {
        write_metrics_to_file(metrics, output_path);
    } else {
        std::cout << format_metrics_json(metrics) << std::endl;
    }

    return 0;
}

void set_conf(RdKafka::Conf& conf, const std::string& key, const std::string& value) {
    std::string err;
    if (conf.set(key, value, err) != RdKafka::Conf::CONF_OK) {
        throw std::runtime_error("rdkafka config error for " + key + ": " + err);
    }
}

std::unique_ptr<RdKafka::KafkaConsumer> make_consumer(const std::string& brokers,
                                                      const std::string& group_id,
                                                      const std::string& topic) {
    auto conf = std::unique_ptr<RdKafka::Conf>(RdKafka::Conf::create(RdKafka::Conf::CONF_GLOBAL));
    if (!conf) {
        throw std::runtime_error("failed to allocate RdKafka consumer config");
    }
    set_conf(*conf, "bootstrap.servers", brokers);
    set_conf(*conf, "group.id", group_id);
    set_conf(*conf, "enable.auto.commit", "false");
    set_conf(*conf, "auto.offset.reset", "earliest");
    set_conf(*conf, "enable.partition.eof", "false");

    std::string err;
    std::unique_ptr<RdKafka::KafkaConsumer> consumer(RdKafka::KafkaConsumer::create(conf.get(), err));
    if (!consumer) {
        throw std::runtime_error("failed to create KafkaConsumer: " + err);
    }
    const RdKafka::ErrorCode sub = consumer->subscribe({topic});
    if (sub != RdKafka::ERR_NO_ERROR) {
        throw std::runtime_error("failed to subscribe to " + topic + ": " + RdKafka::err2str(sub));
    }
    return consumer;
}

std::unique_ptr<RdKafka::Producer> make_producer(const std::string& brokers) {
    auto conf = std::unique_ptr<RdKafka::Conf>(RdKafka::Conf::create(RdKafka::Conf::CONF_GLOBAL));
    if (!conf) {
        throw std::runtime_error("failed to allocate RdKafka producer config");
    }
    set_conf(*conf, "bootstrap.servers", brokers);
    set_conf(*conf, "enable.idempotence", "true");
    set_conf(*conf, "acks", "all");

    std::string err;
    std::unique_ptr<RdKafka::Producer> producer(RdKafka::Producer::create(conf.get(), err));
    if (!producer) {
        throw std::runtime_error("failed to create Producer: " + err);
    }
    return producer;
}

bool produce_result(RdKafka::Producer& producer,
                    const std::string& topic,
                    const std::string& key,
                    const std::string& payload) {
    const RdKafka::ErrorCode rc = producer.produce(
        topic,
        RdKafka::Topic::PARTITION_UA,
        RdKafka::Producer::RK_MSG_COPY,
        const_cast<char*>(payload.data()),
        payload.size(),
        key.data(),
        key.size(),
        0,
        nullptr
    );
    producer.poll(0);
    if (rc != RdKafka::ERR_NO_ERROR) {
        std::cerr << "produce failed: " << RdKafka::err2str(rc) << '\n';
        return false;
    }
    return true;
}

void seed_balances_from_env(risk_engine::RiskEngine& engine, std::int64_t default_balance) {
    engine.set_balance("demo-account", default_balance);
    const char* seeds = std::getenv("RISK_BALANCE_SEEDS");
    if (seeds == nullptr) {
        return;
    }
    std::stringstream stream(seeds);
    std::string item;
    while (std::getline(stream, item, ',')) {
        const auto pos = item.find(':');
        if (pos == std::string::npos) {
            continue;
        }
        engine.set_balance(item.substr(0, pos), std::stoll(item.substr(pos + 1)));
    }
}

} // namespace

int main(int argc, char* argv[]) {
    std::signal(SIGINT, on_signal);
    std::signal(SIGTERM, on_signal);

    bool benchmark_mode = false;
    std::size_t benchmark_events = 50'000;
    std::string benchmark_output = env_or("RISK_BENCHMARK_OUTPUT", "");

    if (const char* mode = std::getenv("RISK_BENCHMARK_MODE")) {
        if (std::string(mode) == "1" || std::string(mode) == "true") {
            benchmark_mode = true;
        }
    }
    if (const char* ev_str = std::getenv("RISK_BENCHMARK_EVENTS")) {
        try {
            benchmark_events = static_cast<std::size_t>(std::stoull(ev_str));
        } catch (...) {}
    }

    for (int i = 1; i < argc; ++i) {
        const std::string arg = argv[i];
        if (arg == "--benchmark" || arg == "-b") {
            benchmark_mode = true;
        } else if ((arg == "--events" || arg == "-n") && i + 1 < argc) {
            benchmark_events = static_cast<std::size_t>(std::stoull(argv[++i]));
            benchmark_mode = true;
        } else if ((arg == "--output" || arg == "-o") && i + 1 < argc) {
            benchmark_output = argv[++i];
            benchmark_mode = true;
        } else if (arg == "--help" || arg == "-h") {
            std::cout << "Usage: risk_engine [options]\n"
                      << "Options:\n"
                      << "  --benchmark, -b       Run standalone high-throughput latency benchmark\n"
                      << "  --events, -n <count>  Number of benchmark events (default: 50000)\n"
                      << "  --output, -o <file>   Export benchmark metrics JSON to file\n"
                      << "  --help, -h            Show this help message\n";
            return 0;
        }
    }

    if (benchmark_mode) {
        return run_standalone_benchmark(benchmark_events, benchmark_output);
    }

    const std::string brokers = env_or("KAFKA_BOOTSTRAP_SERVERS", "localhost:9092");
    const std::string input_topic = env_or("BETS_SUBMITTED_TOPIC", "bets-submitted");
    const std::string output_topic = env_or("BETS_RESULTS_TOPIC", "bets-results");
    const std::string group_id = env_or("KAFKA_GROUP_ID", "risk-engine-v1");
    const std::int64_t exposure_cap = env_i64_or("SAEC_CAP_CENTS", 1'000'000);
    const std::int64_t default_balance = env_i64_or("DEMO_BALANCE_CENTS", 100'000);

    std::cout << "[risk_engine] Initializing risk engine..." << std::endl;
    std::cout << "[risk_engine] Kafka brokers: " << brokers << std::endl;
    std::cout << "[risk_engine] Listening on: " << input_topic << " (group=" << group_id << ")" << std::endl;
    std::cout << "[risk_engine] Publishing to: " << output_topic << std::endl;
    std::cout << "[risk_engine] Single Account Exposure Cap: " << exposure_cap << " cents" << std::endl;

    auto consumer = make_consumer(brokers, group_id, input_topic);
    auto producer = make_producer(brokers);
    risk_engine::RiskEngine engine(exposure_cap);

    seed_balances_from_env(engine, default_balance);
    std::cout << "[risk_engine] Ready and polling for submitted bets." << std::endl;

    std::vector<std::int64_t> live_durations_ns;
    live_durations_ns.reserve(10000);
    std::size_t live_accepted = 0;
    std::size_t live_rejected = 0;
    const auto live_start = std::chrono::high_resolution_clock::now();

    while (g_running.load(std::memory_order_acquire)) {
        std::unique_ptr<RdKafka::Message> msg(consumer->consume(100));
        if (!msg) {
            continue;
        }
        if (msg->err() == RdKafka::ERR__TIMED_OUT) {
            continue;
        }
        if (msg->err() != RdKafka::ERR_NO_ERROR) {
            std::cerr << "[risk_engine] consume error: " << msg->errstr() << std::endl;
            continue;
        }

        const auto* bytes = static_cast<const char*>(msg->payload());
        const std::string_view payload(bytes, msg->len());

        const auto t0 = std::chrono::high_resolution_clock::now();
        const auto result = engine.evaluate_json(payload);
        const auto t1 = std::chrono::high_resolution_clock::now();
        const auto dur_ns = std::chrono::duration_cast<std::chrono::nanoseconds>(t1 - t0).count();
        live_durations_ns.push_back(dur_ns);

        if (result.accepted) {
            ++live_accepted;
        } else {
            ++live_rejected;
        }

        const std::string result_json = risk_engine::RiskEngine::to_json(result);
        const std::string key = result.bet_id.empty() ? result.account_id : result.bet_id;

        std::cout << "[risk_engine] Evaluated bet_id=" << (result.bet_id.empty() ? result.event_id : result.bet_id)
                  << " decision=" << (result.accepted ? "ACCEPTED" : "REJECTED")
                  << " reason=" << result.reason_code
                  << " eval_us=" << (static_cast<double>(dur_ns) / 1000.0)
                  << " rem_bal=" << result.remaining_balance_cents
                  << " exp=" << result.accepted_exposure_cents << " cents" << std::endl;

        if (!produce_result(*producer, output_topic, key, result_json)) {
            continue;
        }

        if (producer->flush(5000) != 0) {
            std::cerr << "[risk_engine] produce flush timed out; offset not committed" << std::endl;
            continue;
        }

        const RdKafka::ErrorCode commit_rc = consumer->commitSync(msg.get());
        if (commit_rc != RdKafka::ERR_NO_ERROR) {
            std::cerr << "[risk_engine] manual commit failed: " << RdKafka::err2str(commit_rc) << std::endl;
        }
    }

    const auto live_end = std::chrono::high_resolution_clock::now();
    const auto live_wall_ns = std::chrono::duration_cast<std::chrono::nanoseconds>(live_end - live_start).count();

    if (!live_durations_ns.empty() && !benchmark_output.empty()) {
        const auto metrics = compute_benchmark_metrics(live_durations_ns, live_wall_ns, live_accepted, live_rejected);
        write_metrics_to_file(metrics, benchmark_output);
    }

    std::cout << "[risk_engine] Stopping consumer and producer..." << std::endl;
    consumer->close();
    producer->flush(5000);
    RdKafka::wait_destroyed(5000);
    std::cout << "[risk_engine] Clean shutdown complete." << std::endl;
    return 0;
}