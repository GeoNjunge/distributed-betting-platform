#include "risk_engine.hpp"

#include <atomic>
#include <csignal>
#include <cstdlib>
#include <iostream>
#include <memory>
#include <stdexcept>
#include <string>
#include <sstream>

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

int main() {
    std::signal(SIGINT, on_signal);
    std::signal(SIGTERM, on_signal);

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
        const auto result = engine.evaluate_json(payload);
        const std::string result_json = risk_engine::RiskEngine::to_json(result);
        const std::string key = result.bet_id.empty() ? result.account_id : result.bet_id;

        std::cout << "[risk_engine] Evaluated bet_id=" << (result.bet_id.empty() ? result.event_id : result.bet_id)
                  << " decision=" << (result.accepted ? "ACCEPTED" : "REJECTED")
                  << " reason=" << result.reason_code
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

    std::cout << "[risk_engine] Stopping consumer and producer..." << std::endl;
    consumer->close();
    producer->flush(5000);
    RdKafka::wait_destroyed(5000);
    std::cout << "[risk_engine] Clean shutdown complete." << std::endl;
    return 0;
}