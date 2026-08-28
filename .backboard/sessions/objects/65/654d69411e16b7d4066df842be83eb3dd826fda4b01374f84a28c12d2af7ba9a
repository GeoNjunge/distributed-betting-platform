import { HttpClient } from '@angular/common/http';
import { Injectable, computed, signal } from '@angular/core';
import { finalize } from 'rxjs';

import { environment } from '../../../environments/environment';
import { BetSlipSelection, BetSlipState, BetSubmissionRequest, BetSubmissionResponse } from '../models/bet.model';

@Injectable({ providedIn: 'root' })
export class BetSlipService {
  private readonly stateSignal = signal<BetSlipState>({ stakeDollars: 10, status: 'EMPTY' });
  readonly state = this.stateSignal.asReadonly();
  readonly stakeCents = computed(() => Math.round((this.stateSignal().stakeDollars || 0) * 100));
  readonly potentialPayout = computed(() => {
    const selection = this.stateSignal().selection;
    return selection ? this.stateSignal().stakeDollars * selection.odds : 0;
  });

  constructor(private readonly http: HttpClient) {}

  select(selection: BetSlipSelection): void {
    this.stateSignal.update((state) => ({
      ...state,
      selection,
      status: 'EMPTY',
      message: undefined,
      eventId: undefined,
      idempotencyKey: undefined
    }));
  }

  updateStake(value: number): void {
    this.stateSignal.update((state) => ({ ...state, stakeDollars: Number.isFinite(value) ? value : 0 }));
  }

  clear(): void {
    this.stateSignal.set({ stakeDollars: 10, status: 'EMPTY' });
  }

  submit(): void {
    const state = this.stateSignal();
    if (!state.selection || this.stakeCents() <= 0) {
      this.stateSignal.update((current) => ({ ...current, status: 'ERROR', message: 'Select odds and enter a valid stake.' }));
      return;
    }

    const request: BetSubmissionRequest = {
      match_id: state.selection.matchId,
      market_id: state.selection.marketId,
      selection_id: state.selection.selectionId,
      stake: state.stakeDollars.toFixed(2),
      potential_payout: this.potentialPayout().toFixed(2),
      timestamp: new Date().toISOString()
    };

    this.stateSignal.update((current) => ({ ...current, status: 'PENDING', message: 'Submitting bet to risk engine...' }));
    this.http.post<BetSubmissionResponse>(`${environment.ingressApiUrl}/api/v1/bets`, request, { withCredentials: true })
      .pipe(finalize(() => undefined))
      .subscribe({
        next: (response) => {
          this.stateSignal.update((current) => ({
            ...current,
            status: 'ACCEPTED',
            message: 'Bet submitted and accepted for processing.',
            eventId: response.event_id,
            idempotencyKey: response.idempotency_key
          }));
        },
        error: (error) => {
          this.stateSignal.update((current) => ({
            ...current,
            status: 'REJECTED',
            message: error?.error?.detail ?? 'Bet was rejected or could not be submitted.'
          }));
        }
      });
  }
}
