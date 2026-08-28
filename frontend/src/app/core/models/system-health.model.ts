export type ConnectionHealth = 'CONNECTED' | 'DEGRADED' | 'DISCONNECTED';

export interface SystemHealth {
  postgres_status: ConnectionHealth;
  postgres_latency_ms: number;
  kafka_status: ConnectionHealth;
  kafka_brokers: string[];
  active_topics: string[];
  timestamp_iso: string;
}

export interface ServiceMetric {
  name: string;
  value: string | number;
  unit?: string;
  change?: string;
  trend?: 'up' | 'down' | 'neutral';
  status: 'active' | 'pending' | 'degraded' | 'healthy';
}
