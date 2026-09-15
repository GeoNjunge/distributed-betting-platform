import { Component, EventEmitter, Output, computed } from '@angular/core';
import { CurrencyPipe, NgClass, NgIf } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { AuthService } from '../../core/services/auth.service';
import { BetSlipService } from '../../core/services/bet-slip.service';
import { AuthModalService } from '../../core/services/auth-modal.service';
import { TracingService } from '../../core/services/tracing.service';

@Component({
  selector: 'app-bet-slip',
  standalone: true,
  imports: [CurrencyPipe, FormsModule, NgClass, NgIf],
  template: `
    <aside class="sticky top-20 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-colors dark:border-slate-800 dark:bg-slate-900">
      
      <!-- Slip Header -->
      <div class="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
        <div class="flex items-center gap-2">
          <div class="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400">
            <svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <h2 class="text-sm font-extrabold text-slate-900 dark:text-white">Quick Bet Slip</h2>
        </div>

        @if (state().selection) {
          <button
            type="button"
            (click)="betSlip.clear()"
            class="text-[11px] font-semibold text-slate-400 transition hover:text-rose-500"
          >
            Clear
          </button>
        }
      </div>

      <!-- Active Selection or Empty State -->
      @if (state().selection; as selection) {
        
        <!-- Selection Summary Card -->
        <div class="mt-4 rounded-xl border border-slate-200/90 bg-slate-50 p-3.5 text-xs transition-colors dark:border-slate-800 dark:bg-slate-950/70">
          <div class="flex items-center justify-between">
            <span class="font-bold text-slate-900 dark:text-white">{{ formatSelectionTitle(selection.selectionId) }}</span>
            <span class="rounded-md bg-emerald-500/10 px-2 py-0.5 font-mono text-xs font-black text-emerald-600 dark:text-emerald-400">
              {{ selection.odds }}
            </span>
          </div>
          <div class="mt-1 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
            <span>Match: {{ selection.matchId }}</span>
            <span class="font-mono">STP</span>
          </div>
        </div>

        <!-- POST-AUTHENTICATION FLOW: Full Stake & Submission Interface -->
        @if (auth.isAuthenticated()) {
          <div class="mt-4 space-y-4">
            <!-- Stake Input -->
            <label class="grid gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
              <span>Stake Amount ($ USD)</span>
              <div class="relative">
                <span class="absolute inset-y-0 left-0 flex items-center pl-3 font-bold text-slate-400">$</span>
                <input
                  class="w-full rounded-xl border border-slate-200 bg-white py-2 pl-7 pr-3 font-mono text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  type="number"
                  min="0.01"
                  step="1"
                  [ngModel]="state().stakeDollars"
                  (ngModelChange)="betSlip.updateStake($event)"
                />
              </div>
            </label>

            <!-- Quick Stake Buttons -->
            <div class="flex gap-1.5">
              @for (amt of [10, 25, 50, 100]; track amt) {
                <button
                  type="button"
                  (click)="betSlip.updateStake(amt)"
                  class="flex-1 rounded-lg border border-slate-200 bg-slate-50 py-1 text-[11px] font-bold text-slate-700 transition hover:bg-slate-100 hover:text-slate-900 dark:border-slate-800 dark:bg-slate-800/80 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white"
                >
                  +\${{ amt }}
                </button>
              }
            </div>

            <!-- Payout Computation -->
            <div class="rounded-xl border border-slate-100 bg-slate-50/60 p-3 text-xs text-slate-600 dark:border-slate-800/60 dark:bg-slate-950/40 dark:text-slate-300">
              <div class="flex justify-between">
                <span>Total Stake</span>
                <span class="font-mono font-bold text-slate-900 dark:text-white">\${{ state().stakeDollars }}</span>
              </div>
              <div class="mt-1 flex justify-between">
                <span>Est. Return</span>
                <span class="font-mono font-extrabold text-emerald-600 dark:text-emerald-400">
                  {{ betSlip.potentialPayout() | currency:'USD' }}
                </span>
              </div>
            </div>

            <!-- Authenticated Primary Submission Button -->
            <button
              class="w-full rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white shadow-md shadow-emerald-600/20 transition hover:bg-emerald-500 active:scale-98 disabled:cursor-not-allowed disabled:opacity-40"
              [disabled]="state().status === 'PENDING' || betSlip.stakeCents() <= 0"
              (click)="onSubmitBet()"
            >
              {{ state().status === 'PENDING' ? 'Placing Bet...' : 'Place Bet' }}
            </button>
          </div>
        } @else {
          <!-- UNAUTHENTICATED STATE: Odds are visible, but submission is gated -->
          <div class="mt-4 rounded-xl border border-amber-200 bg-amber-50/70 p-4 text-center transition-colors dark:border-amber-900/40 dark:bg-amber-950/20">
            <div class="mx-auto flex h-9 w-9 items-center justify-center rounded-full bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400">
              <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h3 class="mt-2 text-xs font-bold text-amber-900 dark:text-amber-200">Authentication Required</h3>
            <p class="mt-1 text-[11px] text-amber-700 dark:text-amber-300">
              Sign in or create an account to configure your stake and submit tickets.
            </p>

            <button
              type="button"
              (click)="authModal.open('login')"
              class="mt-3 w-full rounded-xl bg-emerald-600 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-emerald-500 active:scale-98"
            >
              Log In to Place Bet
            </button>
          </div>
        }

      } @else {
        <!-- Empty State Prompt -->
        <div class="mt-4 rounded-xl border border-dashed border-slate-200 p-6 text-center text-xs text-slate-400 dark:border-slate-800 dark:text-slate-500">
          <svg class="mx-auto mb-2 h-7 w-7 text-slate-300 dark:text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
          </svg>
          <span class="block font-medium">Your slip is currently empty</span>
          <span class="mt-0.5 block text-[11px]">Click any live odd to start building your ticket</span>
        </div>
      }

      <!-- Order Status Feedback (when submitted) -->
      @if (state().message) {
        <div class="mt-4 rounded-xl border p-3.5 text-xs transition-colors" [ngClass]="statusClasses()">
          <div class="flex items-center justify-between font-bold">
            <span>{{ state().status === 'ACCEPTED' ? '✓ Bet Confirmed' : state().status }}</span>
          </div>
          <p class="mt-1">{{ state().message }}</p>

          @if (state().eventId) {
            <div class="mt-2.5 flex flex-col gap-1.5 border-t border-slate-200/50 pt-2 dark:border-slate-800">
              <span class="font-mono text-[10px] break-all opacity-75">Trace ID: {{ state().eventId }}</span>
              <button
                type="button"
                (click)="onInspectTrace(state().eventId!)"
                class="inline-flex items-center justify-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
              >
                <span>Inspect Trace in Telemetry</span>
                <span class="font-mono">&rarr;</span>
              </button>
            </div>
          }
        </div>
      }

    </aside>
  `
})
export class BetSlipComponent {
  @Output() viewTrace = new EventEmitter<string>();

  readonly state = this.betSlip.state;

  constructor(
    readonly betSlip: BetSlipService,
    readonly auth: AuthService,
    readonly authModal: AuthModalService,
    readonly tracingService: TracingService
  ) {}

  formatSelectionTitle(selectionId: string): string {
    return selectionId
      .replace(/^match-\d+-/, '')
      .replace(/-/g, ' ')
      .toUpperCase();
  }

  onSubmitBet(): void {
    if (!this.auth.isAuthenticated()) {
      this.authModal.open('login');
      return;
    }
    this.betSlip.submit();
  }

  onInspectTrace(betId: string): void {
    this.tracingService.traceBet(betId);
    this.viewTrace.emit(betId);
  }

  statusClasses(): Record<string, boolean> {
    const status = this.state().status;
    return {
      'bg-cyan-50 text-cyan-800 border-cyan-200 dark:bg-cyan-950/50 dark:text-cyan-200 dark:border-cyan-800/60': status === 'PENDING',
      'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-200 dark:border-emerald-800/60': status === 'ACCEPTED',
      'bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/60 dark:text-rose-200 dark:border-rose-800/60': status === 'REJECTED' || status === 'ERROR'
    };
  }
}
