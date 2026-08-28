export type StageStatus = 'COMPLETED' | 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'FAILED' | 'SETTLED' | 'ACTIVE' | 'SKIPPED';

export interface PipelineStageTrace {
  stage_id: string;
  name: string;
  service: string;
  status: StageStatus | string;
  duration_ms: number;
  timestamp_iso: string;
  badges: string[];
  details: Record<string, any>;
}

export interface WalletLedgerRecord {
  id: string;
  type: string;
  amount_cents: number;
  reference_id: string;
  created_at: string;
}

export interface BetTrace {
  bet_id: string;
  idempotency_key: string;
  user_id: string;
  match_id: string;
  selection_id: string;
  stake_cents: number;
  odds: string;
  status: string;
  rejection_reason?: string | null;
  created_at: string;
  total_latency_ms: number;
  stages: PipelineStageTrace[];
  ledger_entries: WalletLedgerRecord[];
}

export interface RecentBetItem {
  bet_id: string;
  idempotency_key: string;
  user_id: string;
  match_id: string;
  selection_id: string;
  stake_cents: number;
  odds: string;
  status: string;
  rejection_reason?: string | null;
  created_at: string;
}
