import { MarketSelectionView } from './odds-tick.model';

export type BetExecutionStatus = 'EMPTY' | 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'ERROR';

export interface BetSlipSelection extends MarketSelectionView {}

export interface BetSubmissionRequest {
  match_id: string;
  market_id: string;
  selection_id: string;
  stake: string;
  potential_payout: string;
  timestamp: string;
}

export interface BetSubmissionResponse {
  event_id: string;
  idempotency_key: string;
  topic: string;
  status: string;
}

export interface BetSlipState {
  selection?: BetSlipSelection;
  stakeDollars: number;
  status: BetExecutionStatus;
  message?: string;
  eventId?: string;
  idempotencyKey?: string;
}
