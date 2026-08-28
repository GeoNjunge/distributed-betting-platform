export interface OddsTick {
  match_id: string;
  market_id: string;
  selection_id: string;
  sequence: number;
  timestamp_ms: number;
  decimal_odds: string | number;
}

export type PriceDirection = 'up' | 'down' | 'flat';

export interface MarketSelectionView {
  key: string;
  matchId: string;
  marketId: string;
  selectionId: string;
  sequence: number;
  timestampMs: number;
  odds: number;
  previousOdds?: number;
  direction: PriceDirection;
  updatedAt: number;
}
