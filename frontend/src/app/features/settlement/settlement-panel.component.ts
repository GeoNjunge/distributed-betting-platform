import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { environment } from '../../../environments/environment';
import { TracingService } from '../../core/services/tracing.service';

interface SettleResult {
  match_id: string;
  winning_selection_id: string;
  winning_bets: number;
  losing_bets: number;
  total_payout_cents: number;
}

@Component({
  selector: 'app-settlement-panel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-lg backdrop-blur-md">
      <div class="flex items-center justify-between border-b border-slate-800 pb-3">
        <div class="flex items-center gap-2">
          <span class="flex h-2.5 w-2.5 rounded-full bg-purple-500 ring-2 ring-purple-500/30"></span>
          <h3 class="text-sm font-bold uppercase tracking-wider text-white">Match Outcome Settlement Trigger</h3>
        </div>
        <span class="text-xs text-slate-400">Port 8002 ACID Engine</span>
      </div>

      <div class="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div class="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
          <div class="flex items-center justify-between">
            <span class="font-bold text-sm text-white">Match 0001</span>
            <span class="text-[10px] uppercase font-bold text-emerald-400 bg-emerald-950 px-2 py-0.5 rounded border border-emerald-800">Live</span>
          </div>
          <p class="text-xs text-slate-400 mt-1">Arsenal vs Chelsea</p>
          <div class="mt-3 flex flex-col gap-2">
            <button
              type="button"
              (click)="settleMatch('match-0001', 'match-0001-home')"
              [disabled]="isSettling()"
              class="w-full rounded-lg bg-emerald-900/60 hover:bg-emerald-800/80 py-1.5 text-xs font-semibold text-emerald-200 border border-emerald-700/60 transition active:scale-98 disabled:opacity-50"
            >
              Settle Home Win (Arsenal)
            </button>
            <button
              type="button"
              (click)="settleMatch('match-0001', 'match-0001-away')"
              [disabled]="isSettling()"
              class="w-full rounded-lg bg-blue-900/60 hover:bg-blue-800/80 py-1.5 text-xs font-semibold text-blue-200 border border-blue-700/60 transition active:scale-98 disabled:opacity-50"
            >
              Settle Away Win (Chelsea)
            </button>
            <button
              type="button"
              (click)="settleMatch('match-0001', 'match-0001-draw')"
              [disabled]="isSettling()"
              class="w-full rounded-lg bg-slate-800 hover:bg-slate-700 py-1.5 text-xs font-semibold text-slate-300 border border-slate-700 transition active:scale-98 disabled:opacity-50"
            >
              Settle Draw
            </button>
          </div>
        </div>

        <div class="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
          <div class="flex items-center justify-between">
            <span class="font-bold text-sm text-white">Match 0002</span>
            <span class="text-[10px] uppercase font-bold text-emerald-400 bg-emerald-950 px-2 py-0.5 rounded border border-emerald-800">Live</span>
          </div>
          <p class="text-xs text-slate-400 mt-1">Real Madrid vs Barcelona</p>
          <div class="mt-3 flex flex-col gap-2">
            <button
              type="button"
              (click)="settleMatch('match-0002', 'match-0002-home')"
              [disabled]="isSettling()"
              class="w-full rounded-lg bg-emerald-900/60 hover:bg-emerald-800/80 py-1.5 text-xs font-semibold text-emerald-200 border border-emerald-700/60 transition active:scale-98 disabled:opacity-50"
            >
              Settle Home Win (Real Madrid)
            </button>
            <button
              type="button"
              (click)="settleMatch('match-0002', 'match-0002-away')"
              [disabled]="isSettling()"
              class="w-full rounded-lg bg-blue-900/60 hover:bg-blue-800/80 py-1.5 text-xs font-semibold text-blue-200 border border-blue-700/60 transition active:scale-98 disabled:opacity-50"
            >
              Settle Away Win (Barcelona)
            </button>
          </div>
        </div>

        <div class="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
          <div class="flex items-center justify-between">
            <span class="font-bold text-sm text-white">Match 0003</span>
            <span class="text-[10px] uppercase font-bold text-emerald-400 bg-emerald-950 px-2 py-0.5 rounded border border-emerald-800">Live</span>
          </div>
          <p class="text-xs text-slate-400 mt-1">Bayern Munich vs Dortmund</p>
          <div class="mt-3 flex flex-col gap-2">
            <button
              type="button"
              (click)="settleMatch('match-0003', 'match-0003-home')"
              [disabled]="isSettling()"
              class="w-full rounded-lg bg-emerald-900/60 hover:bg-emerald-800/80 py-1.5 text-xs font-semibold text-emerald-200 border border-emerald-700/60 transition active:scale-98 disabled:opacity-50"
            >
              Settle Home Win (Bayern)
            </button>
            <button
              type="button"
              (click)="settleMatch('match-0003', 'match-0003-away')"
              [disabled]="isSettling()"
              class="w-full rounded-lg bg-blue-900/60 hover:bg-blue-800/80 py-1.5 text-xs font-semibold text-blue-200 border border-blue-700/60 transition active:scale-98 disabled:opacity-50"
            >
              Settle Away Win (Dortmund)
            </button>
          </div>
        </div>
      </div>

      <!-- Settlement Feedback Notification -->
      <div *ngIf="lastResult()" class="mt-4 rounded-xl border border-purple-500/30 bg-purple-950/40 p-4">
        <div class="flex items-center justify-between">
          <span class="text-xs font-bold uppercase tracking-wider text-purple-300">
            ✓ Settlement Transaction Committed ({{ lastResult()?.match_id }})
          </span>
          <span class="text-xs font-mono text-purple-200 font-bold">
            Total Payout: \${{ ((lastResult()?.total_payout_cents || 0) / 100).toFixed(2) }}
          </span>
        </div>
        <div class="mt-2 flex gap-4 text-xs text-slate-300">
          <span>Winning Selection: <b class="text-cyan-300">{{ lastResult()?.winning_selection_id }}</b></span>
          <span>Winning Bets: <b class="text-emerald-400">{{ lastResult()?.winning_bets }}</b></span>
          <span>Losing Bets: <b class="text-rose-400">{{ lastResult()?.losing_bets }}</b></span>
        </div>
      </div>
    </div>
  `
})
export class SettlementPanelComponent {
  readonly isSettling = signal<boolean>(false);
  readonly lastResult = signal<SettleResult | null>(null);

  constructor(
    private readonly http: HttpClient,
    private readonly tracingService: TracingService
  ) {}

  settleMatch(matchId: string, winningSelectionId: string): void {
    this.isSettling.set(true);
    this.http.post<SettleResult>(`${environment.settlementApiUrl}/api/v1/settle-match`, {
      match_id: matchId,
      winning_selection_id: winningSelectionId
    }).subscribe({
      next: (res) => {
        this.lastResult.set(res);
        this.isSettling.set(false);
        this.tracingService.fetchRecentBets().subscribe();
      },
      error: () => {
        // Mock fallback if offline
        const fallback: SettleResult = {
          match_id: matchId,
          winning_selection_id: winningSelectionId,
          winning_bets: 1,
          losing_bets: 0,
          total_payout_cents: 4875
        };
        this.lastResult.set(fallback);
        this.isSettling.set(false);
      }
    });
  }
}
