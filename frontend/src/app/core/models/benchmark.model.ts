export interface BenchmarkData {
  timestamp: string;
  total_events_processed: number;
  throughput_ops_sec: number;
  p50_latency_us: number;
  p90_latency_us: number;
  p95_latency_us: number;
  p99_latency_us: number;
  min_latency_us?: number;
  max_latency_us?: number;
  avg_latency_us?: number;
  memory_footprint_mb: number;
  zero_copy_string_view: boolean;
  lock_free_atomics: boolean;
  accepted_count?: number;
  rejected_count?: number;
}

export interface LiveBenchmarkSample {
  id: string;
  orderId: string;
  accountId: string;
  latencyUs: number;
  decision: 'ACCEPTED' | 'REJECTED';
  reasonCode: string;
  timestamp: string;
}

export interface TelemetryPoint {
  timeLabel: string;
  throughput: number;
  latencyUs: number;
}
