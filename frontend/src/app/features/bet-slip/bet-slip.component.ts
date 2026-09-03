import { Component, EventEmitter, Output, computed } from '@angular/core';
import { CurrencyPipe, NgClass, NgIf } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { AuthService } from '../../core/services/auth.service';
import { BetSlipService } from '../../core/services/bet-slip.service';
import { TracingService } from '../../core/services/tracing.service';

@Component({
  selector: 'app-bet-slip',
  standalone: true,
  imports: [CurrencyPipe, FormsModule, NgClass, NgIf],
  template: `
    <aside class="sticky top-4 rounded-2xl border border-slate-800 bg-slate-900/90 p-5 shadow-2xl backdrop-blur-md">
      <div class="flex items-center justify-between pb-3 border-b border-slate-800">
        <div>
          <span class="text-[10px] font-bold uppercase tracking-widest text-emerald-400">Order Slip</span>
          <h2 class="text-lg font-extrabold text-white">Execution Ticket</h2>
        </div>
        <span class="rounded-md bg-emerald-950/60 px-2 py-0.5 text-[10px] font-mono text-emerald-300 border border-emerald-800/60">
          STP / Direct Kafka
        </span>
      </div>

      @if (state().selection; as selection) {
        <div class="mt-4 rounded-xl bg-slate-950/70 p-3.5 text-xs text-slate-200 border border-slate-800/80">
          <div class="flex justify-between items-center"><span class="text-slate-400">Match ID</span><strong class="font-mono text-cyan-300">{{ selection.matchId }}</strong></div>
          <div class="mt-2 flex justify-between items-center"><span class="text-slate-400">Selection</span><strong class="text-white">{{ selection.selectionId }}</strong></div>
          <div class="mt-2 flex justify-between items-center"><span class="text-slate-400">Dec Odds</span><strong class="text-emerald-400 text-sm font-bold">{{ selection.odds }}</strong></div>
        </div>

        <label class="mt-4 grid gap-1.5 text-xs font-semibold text-slate-300">
          Stake Amount ($ USD)
          <div class="relative">
            <span class="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400 font-bold">$</span>
            <input
              class="w-full rounded-xl border border-slate-700 bg-slate-950 py-2.5 pl-7 pr-3 font-mono text-sm text-white outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/20"
              type="number"
              min="0.01"
              step="1"
              [ngModel]="state().stakeDollars"
              (ngModelChange)="betSlip.updateStake($event)"
            />
          </div>
        </label>

        <!-- Quick Stake Chips -->
        <div class="mt-2 flex gap-1.5">
          @for (amt of [10, 25, 50, 100]; track amt) {
            <button
              type="button"
              (click)="betSlip.updateStake(amt)"
              class="flex-1 rounded-lg border border-slate-700 bg-slate-800/60 py-1 text-[11px] font-medium text-slate-300 transition hover:bg-slate-700 hover:text-white"
            >
              +\${{ amt }}
            </button>
          }
        </div>

        <dl class="mt-4 grid gap-1.5 rounded-xl bg-slate-950/50 p-3 text-xs text-slate-300 border border-slate-800/60">
          <div class="flex justify-between"><dt class="text-slate-400">Stake in Cents</dt><dd class="font-mono font-bold text-white">{{ betSlip.stakeCents() }} ¢</dd></div>
          <div class="flex justify-between"><dt class="text-slate-400">Est. Payout</dt><dd class="font-mono font-extrabold text-emerald-300">{{ betSlip.potentialPayout() | currency:'USD' }}</dd></div>
        </dl>

        <button
          class="mt-4 w-full rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 py-3 font-bold text-slate-950 shadow-lg shadow-emerald-950/30 transition hover:from-emerald-400 hover:to-teal-400 active:scale-98 disabled:cursor-not-allowed disabled:opacity-40"
          [disabled]="!auth.isAuthenticated() || state().status === 'PENDING'"
          (click)="onSubmitBet()"
        >
          {{ state().status === 'PENDING' ? 'Ingesting via Kafka...' : 'Submit Order' }}
        </button>
        <button
          class="mt-2 w-full rounded-xl border border-slate-800 py-2 text-xs font-semibold text-slate-400 hover:bg-slate-800 hover:text-white transition"
          (click)="betSlip.clear()"
        >
          Clear Order
        </button>
      } @else {
        <div class="mt-4 rounded-xl border border-dashed border-slate-800 p-6 text-center text-xs text-slate-400">
          <svg class="mx-auto h-8 w-8 text-slate-600 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
          </svg>
          Select an outcome from live matches to configure an order ticket.
        </div>
      }

      <p *ngIf="!auth.isAuthenticated()" class="mt-4 flex items-center gap-2 text-xs font-medium text-amber-300 bg-amber-950/40 p-2.5 rounded-xl border border-amber-800/40">
        <svg class="h-4 w-4 text-amber-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
        </svg>
        <span>Login or register to execute orders against the C++ Risk Engine.</span>
      </p>

      <div *ngIf="state().message" class="mt-4 rounded-xl p-3.5 text-xs border" [ngClass]="statusClasses()">
        <div class="flex items-center justify-between">
          <strong>{{ state().status }}</strong>
          <span *ngIf="state().status === 'ACCEPTED'" class="inline-flex items-center gap-1 text-[10px] font-mono opacity-80">
            <svg class="h-3 w-3 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" />
            </svg>
            <span>Persisted</span>
          </span>
        </div>
        <p class="mt-1">{{ state().message }}</p>
        <div *ngIf="state().eventId" class="mt-2.5 pt-2 border-t border-white/10 flex flex-col gap-1.5">
          <span class="font-mono text-[10px] break-all opacity-80">Trace ID: {{ state().eventId }}</span>
          <button
            type="button"
            (click)="onInspectTrace(state().eventId!)"
            class="inline-flex items-center justify-center gap-1.5 rounded-lg bg-cyan-950/80 px-3 py-1.5 text-xs font-bold text-cyan-300 border border-cyan-700/60 transition hover:bg-cyan-900"
          >
            <svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
            </svg>
            <span>Inspect in Request Tracer</span>
          </button>
        </div>
      </div>
    </aside>
  `
})
export class BetSlipComponent {
  @Output() viewTrace = new EventEmitter<string>();

  readonly state = this.betSlip.state;
  readonly canSubmit = computed(() => this.auth.isAuthenticated() && !!this.state().selection && this.state().status !== 'PENDING');

  constructor(
    readonly betSlip: BetSlipService,
    readonly auth: AuthService,
    readonly tracingService: TracingService
  ) {}

  onSubmitBet(): void {
    this.betSlip.submit();
  }

  onInspectTrace(betId: string): void {
    this.tracingService.traceBet(betId);
    this.viewTrace.emit(betId);
  }

  statusClasses(): Record<string, boolean> {
    const status = this.state().status;
    return {
      'bg-cyan-950/50 text-cyan-200 border-cyan-800/60': status === 'PENDING',
      'bg-emerald-950/60 text-emerald-200 border-emerald-800/60': status === 'ACCEPTED',
      'bg-rose-950/60 text-rose-200 border-rose-800/60': status === 'REJECTED' || status === 'ERROR'
    };
  }
}
