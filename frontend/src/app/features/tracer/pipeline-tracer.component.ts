import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { PipelineStageTrace, RecentBetItem } from '../../core/models/trace.model';
import { TracingService } from '../../core/services/tracing.service';

@Component({
  selector: 'app-pipeline-tracer',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="space-y-6">
      <!-- Tracer Header & Query Bar -->
      <div class="rounded-2xl border border-slate-800 bg-slate-900/90 p-6 shadow-2xl backdrop-blur-md">
        <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div class="flex items-center gap-3">
              <span class="flex h-3 w-3 rounded-full bg-emerald-500 ring-4 ring-emerald-500/20"></span>
              <h2 class="text-xl font-bold tracking-tight text-white">Pipeline Request Tracer</h2>
              <span class="rounded-md border border-cyan-500/30 bg-cyan-950/60 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider text-cyan-300">
                End-to-End Observability
              </span>
            </div>
            <p class="mt-1 text-sm text-slate-400">
              Correlate bet transactions across FastAPI Ingress &rarr; Kafka Outbox &rarr; C++ Risk Engine &rarr; PostgreSQL ACID Ledger &rarr; WebSocket Broadcast.
            </p>
          </div>

          <!-- Quick Scenario Selector Chips -->
          <div class="flex flex-wrap items-center gap-2">
            <span class="text-xs font-medium uppercase tracking-wider text-slate-400">Sample Scenarios:</span>
            <button
              type="button"
              (click)="selectScenario('accepted')"
              class="inline-flex items-center gap-1.5 rounded-lg border border-emerald-700/50 bg-emerald-950/40 px-3 py-1 text-xs font-medium text-emerald-300 transition hover:bg-emerald-900/60 hover:text-emerald-200 active:scale-95"
            >
              <svg class="h-3.5 w-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" />
              </svg>
              <span>Happy Path (Accepted)</span>
            </button>
            <button
              type="button"
              (click)="selectScenario('stale')"
              class="inline-flex items-center gap-1.5 rounded-lg border border-amber-700/50 bg-amber-950/40 px-3 py-1 text-xs font-medium text-amber-300 transition hover:bg-amber-900/60 hover:text-amber-200 active:scale-95"
            >
              <svg class="h-3.5 w-3.5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
              </svg>
              <span>Stale Quote (>200ms)</span>
            </button>
            <button
              type="button"
              (click)="selectScenario('saec')"
              class="inline-flex items-center gap-1.5 rounded-lg border border-rose-700/50 bg-rose-950/40 px-3 py-1 text-xs font-medium text-rose-300 transition hover:bg-rose-900/60 hover:text-rose-200 active:scale-95"
            >
              <svg class="h-3.5 w-3.5 text-rose-400" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
              <span>SAEC Limit Exceeded</span>
            </button>
          </div>
        </div>

        <!-- Search Input Bar -->
        <div class="mt-6 flex flex-col gap-3 sm:flex-row">
          <div class="relative flex-1">
            <div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
              <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              [(ngModel)]="searchQuery"
              (keyup.enter)="onSearch()"
              placeholder="Search by Bet ID, UUID, or Idempotency Key (e.g. dd3e8d4a-...)"
              class="w-full rounded-xl border border-slate-700 bg-slate-950/80 py-2.5 pl-10 pr-4 font-mono text-sm text-slate-100 placeholder-slate-500 transition focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
            />
          </div>
          <button
            type="button"
            (click)="onSearch()"
            [disabled]="tracingService.isLoading()"
            class="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-cyan-900/30 transition hover:from-cyan-500 hover:to-blue-500 active:scale-98 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span *ngIf="tracingService.isLoading()" class="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></span>
            <span>{{ tracingService.isLoading() ? 'Tracing...' : 'Trace Request' }}</span>
          </button>
          <button
            type="button"
            (click)="refreshRecent()"
            title="Refresh recent bets"
            class="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800/80 px-4 py-2.5 text-sm font-medium text-slate-300 transition hover:bg-slate-700 active:scale-95"
          >
            <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
            </svg>
            <span>Refresh</span>
          </button>
        </div>

        <!-- Recent Bets Dropdown Chips -->
        <div *ngIf="tracingService.recentBets().length > 0" class="mt-4 flex flex-wrap items-center gap-2">
          <span class="text-xs text-slate-400 font-medium">Recent Bets in DB:</span>
          <button
            *ngFor="let b of tracingService.recentBets().slice(0, 5)"
            (click)="selectRecentBet(b)"
            type="button"
            class="group inline-flex items-center gap-1.5 rounded-lg border border-slate-700/80 bg-slate-800/60 px-2.5 py-1 font-mono text-xs text-slate-300 transition hover:border-cyan-500/50 hover:bg-slate-800 hover:text-white"
          >
            <span
              class="h-1.5 w-1.5 rounded-full"
              [ngClass]="{
                'bg-emerald-400': b.status === 'ACCEPTED' || b.status === 'WON',
                'bg-rose-400': b.status === 'REJECTED' || b.status === 'LOST',
                'bg-amber-400': b.status === 'PENDING'
              }"
            ></span>
            <span>{{ b.bet_id.substring(0, 8) }}...</span>
            <span class="text-[10px] text-slate-500">(\${{ (b.stake_cents / 100).toFixed(2) }})</span>
          </button>
        </div>
      </div>

      <!-- Main Tracing Details Layout -->
      <div *ngIf="currentTrace() as trace" class="space-y-6">
        <!-- Trace Summary Card -->
        <div class="grid grid-cols-1 gap-4 rounded-2xl border border-slate-800 bg-slate-900/70 p-5 backdrop-blur-md sm:grid-cols-2 lg:grid-cols-4">
          <div class="flex flex-col gap-1 border-b border-slate-800/60 pb-3 sm:border-b-0 sm:border-r sm:pr-4 sm:pb-0">
            <span class="text-xs uppercase tracking-wider text-slate-400 font-semibold">Correlation / Bet ID</span>
            <div class="flex items-center gap-2">
              <span class="truncate font-mono text-xs font-semibold text-cyan-300">{{ trace.bet_id }}</span>
              <button
                type="button"
                (click)="copyToClipboard(trace.bet_id)"
                class="inline-flex items-center text-slate-400 hover:text-white transition"
                title="Copy Bet ID"
              >
                <svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 0 1-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 0 1 1.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 0 0-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 0 1-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 0 0-3.375-3.375h-1.5a1.125 1.125 0 0 1-1.125-1.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H9.75" />
                </svg>
              </button>
            </div>
            <span class="text-[11px] font-mono text-slate-500">Key: {{ trace.idempotency_key }}</span>
          </div>

          <div class="flex flex-col gap-1 border-b border-slate-800/60 pb-3 sm:border-b-0 sm:border-r sm:pr-4 sm:pb-0">
            <span class="text-xs uppercase tracking-wider text-slate-400 font-semibold">Risk Engine Decision</span>
            <div class="flex items-center gap-2">
              <span
                class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold"
                [ngClass]="{
                  'bg-emerald-950/80 text-emerald-300 border border-emerald-700/60': trace.status === 'ACCEPTED' || trace.status === 'WON',
                  'bg-rose-950/80 text-rose-300 border border-rose-700/60': trace.status === 'REJECTED' || trace.status === 'LOST',
                  'bg-amber-950/80 text-amber-300 border border-amber-700/60': trace.status === 'PENDING'
                }"
              >
                {{ trace.status }}
              </span>
              <span *ngIf="trace.rejection_reason" class="text-xs font-medium text-rose-400">
                ({{ trace.rejection_reason }})
              </span>
            </div>
            <span class="text-[11px] text-slate-400">Match: {{ trace.match_id }} ({{ trace.selection_id }})</span>
          </div>

          <div class="flex flex-col gap-1 border-b border-slate-800/60 pb-3 sm:border-b-0 sm:border-r sm:pr-4 sm:pb-0">
            <span class="text-xs uppercase tracking-wider text-slate-400 font-semibold">Financials & Stake</span>
            <div class="flex items-baseline gap-2">
              <span class="text-base font-bold text-white">\${{ (trace.stake_cents / 100).toFixed(2) }}</span>
              <span class="text-xs text-slate-400">&#64; {{ trace.odds }}</span>
            </div>
            <span class="text-[11px] text-slate-400">
              Potential Payout: \${{ ((trace.stake_cents / 100) * +trace.odds).toFixed(2) }}
            </span>
          </div>

          <div class="flex flex-col gap-1">
            <span class="text-xs uppercase tracking-wider text-slate-400 font-semibold">End-to-End Latency</span>
            <div class="flex items-baseline gap-2">
              <span class="text-lg font-extrabold text-cyan-400">{{ trace.total_latency_ms.toFixed(2) }} ms</span>
              <span class="rounded bg-cyan-950/80 px-1.5 py-0.5 text-[10px] font-bold text-cyan-300 border border-cyan-800/50">
                6 Hops Verified
              </span>
            </div>
            <span class="text-[11px] text-slate-400">{{ trace.created_at | date:'HH:mm:ss.SSS UTC' }}</span>
          </div>
        </div>

        <!-- Latency Waterfall Visualizer -->
        <div class="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 backdrop-blur-md">
          <div class="flex items-center justify-between mb-3">
            <h3 class="text-sm font-bold uppercase tracking-wider text-slate-300">Hop Latency Waterfall Breakdown</h3>
            <span class="text-xs text-slate-400">Total Pipeline Latency: {{ trace.total_latency_ms.toFixed(2) }} ms</span>
          </div>
          <div class="space-y-2">
            <div *ngFor="let stage of trace.stages" class="group flex items-center gap-3 text-xs">
              <div class="w-48 truncate font-medium text-slate-300 group-hover:text-cyan-300">{{ stage.name }}</div>
              <div class="flex-1 rounded-full bg-slate-800/80 p-0.5">
                <div
                  class="h-2 rounded-full transition-all duration-500"
                  [style.width.%]="calcPercentage(stage.duration_ms, trace.total_latency_ms)"
                  [ngClass]="{
                    'bg-cyan-500': stage.status === 'COMPLETED' || stage.status === 'ACCEPTED',
                    'bg-rose-500': stage.status === 'REJECTED' || stage.status === 'FAILED',
                    'bg-purple-500': stage.status === 'SETTLED'
                  }"
                ></div>
              </div>
              <div class="w-16 text-right font-mono font-semibold text-slate-200">{{ stage.duration_ms.toFixed(2) }} ms</div>
            </div>
          </div>
        </div>

        <!-- Step-by-Step Lifecycle DAG Grid -->
        <div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <!-- Left 2 Cols: Interactive Lifecycle Stage Cards -->
          <div class="space-y-4 lg:col-span-2">
            <h3 class="text-sm font-bold uppercase tracking-wider text-slate-400">Distributed Hop Sequence</h3>
            
            <div class="space-y-3">
              <div
                *ngFor="let stage of trace.stages; let idx = index"
                (click)="onSelectStage(stage)"
                class="cursor-pointer rounded-xl border transition-all duration-200 p-4"
                [ngClass]="{
                  'border-cyan-500 bg-cyan-950/20 shadow-lg shadow-cyan-950/30 ring-1 ring-cyan-500/30': selectedStage()?.stage_id === stage.stage_id,
                  'border-slate-800 bg-slate-900/60 hover:border-slate-700 hover:bg-slate-800/50': selectedStage()?.stage_id !== stage.stage_id
                }"
              >
                <div class="flex items-start justify-between">
                  <div class="flex items-start gap-3">
                    <div
                      class="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-xs font-bold"
                      [ngClass]="{
                        'bg-emerald-950 text-emerald-300 border border-emerald-700/60': stage.status === 'COMPLETED' || stage.status === 'ACCEPTED',
                        'bg-rose-950 text-rose-300 border border-rose-700/60': stage.status === 'REJECTED' || stage.status === 'FAILED',
                        'bg-purple-950 text-purple-300 border border-purple-700/60': stage.status === 'SETTLED',
                        'bg-slate-800 text-slate-300 border border-slate-700': stage.status === 'ACTIVE' || stage.status === 'PENDING'
                      }"
                    >
                      {{ idx + 1 }}
                    </div>
                    <div>
                      <div class="flex items-center gap-2">
                        <h4 class="font-bold text-sm text-white">{{ stage.name }}</h4>
                        <span
                          class="rounded-full px-2 py-0.5 text-[10px] font-bold"
                          [ngClass]="{
                            'bg-emerald-950 text-emerald-400 border border-emerald-800': stage.status === 'COMPLETED' || stage.status === 'ACCEPTED',
                            'bg-rose-950 text-rose-400 border border-rose-800': stage.status === 'REJECTED' || stage.status === 'FAILED',
                            'bg-purple-950 text-purple-400 border border-purple-800': stage.status === 'SETTLED',
                            'bg-blue-950 text-blue-400 border border-blue-800': stage.status === 'ACTIVE'
                          }"
                        >
                          {{ stage.status }}
                        </span>
                      </div>
                      <p class="text-xs text-slate-400">{{ stage.service }}</p>
                    </div>
                  </div>
                  <div class="text-right">
                    <div class="font-mono text-xs font-bold text-cyan-400">{{ stage.duration_ms.toFixed(2) }} ms</div>
                    <span class="text-[10px] text-slate-500">Hop Latency</span>
                  </div>
                </div>

                <!-- Stage Badges -->
                <div *ngIf="stage.badges.length > 0" class="mt-3 flex flex-wrap gap-1.5 pt-2 border-t border-slate-800/60">
                  <span
                    *ngFor="let badge of stage.badges"
                    class="rounded-md bg-slate-800/80 px-2 py-0.5 text-[11px] font-medium text-slate-300 border border-slate-700/50"
                  >
                    {{ badge }}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <!-- Right Col: Active Stage Inspector Drawer -->
          <div class="space-y-4">
            <h3 class="text-sm font-bold uppercase tracking-wider text-slate-400">Hop Inspector & Metadata</h3>
            
            <div *ngIf="selectedStage() as activeStage" class="rounded-2xl border border-slate-800 bg-slate-900/90 p-5 shadow-xl backdrop-blur-md">
              <div class="flex items-center justify-between border-b border-slate-800 pb-3">
                <div>
                  <h4 class="text-sm font-bold text-white">{{ activeStage.name }}</h4>
                  <span class="text-xs text-cyan-400 font-mono">{{ activeStage.service }}</span>
                </div>
                <span class="rounded-full bg-slate-800 px-2 py-0.5 text-xs font-bold text-slate-300">
                  {{ activeStage.duration_ms.toFixed(2) }} ms
                </span>
              </div>

              <!-- Key-Value Properties -->
              <div class="mt-4 space-y-2">
                <span class="text-[11px] font-bold uppercase tracking-wider text-slate-400">Context Parameters:</span>
                <div class="space-y-1 rounded-xl bg-slate-950/80 p-3 font-mono text-xs text-slate-300 border border-slate-800/60">
                  <div *ngFor="let entry of getDetailEntries(activeStage.details)" class="flex justify-between py-0.5">
                    <span class="text-slate-400">{{ entry.key }}:</span>
                    <span class="font-semibold text-cyan-300 text-right">{{ entry.val }}</span>
                  </div>
                </div>
              </div>

              <!-- Raw Payload / JSON Inspector -->
              <div class="mt-4 space-y-2">
                <div class="flex items-center justify-between">
                  <span class="text-[11px] font-bold uppercase tracking-wider text-slate-400">Hop Telemetry Schema:</span>
                  <button
                    type="button"
                    (click)="copyToClipboard(getJsonString(activeStage))"
                    class="text-xs text-cyan-400 hover:text-cyan-300 transition"
                  >
                    Copy JSON
                  </button>
                </div>
                <pre class="max-h-56 overflow-auto rounded-xl bg-slate-950 p-3 font-mono text-[11px] leading-relaxed text-slate-300 border border-slate-800">{{ getJsonString(activeStage) }}</pre>
              </div>
            </div>

            <!-- Audit Ledger Info Card (PostgreSQL) -->
            <div *ngIf="trace.ledger_entries && trace.ledger_entries.length > 0" class="rounded-2xl border border-slate-800 bg-slate-900/90 p-5 shadow-xl">
              <h4 class="text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">PostgreSQL Wallet Ledger Audit</h4>
              <div class="space-y-2">
                <div *ngFor="let item of trace.ledger_entries" class="flex items-center justify-between rounded-lg bg-slate-950/60 p-2.5 text-xs border border-slate-800">
                  <div>
                    <span class="font-bold text-white">{{ item.type }}</span>
                    <div class="text-[10px] text-slate-400 font-mono">{{ item.id }}</div>
                  </div>
                  <span
                    class="font-mono font-bold"
                    [ngClass]="item.amount_cents < 0 ? 'text-rose-400' : 'text-emerald-400'"
                  >
                    {{ item.amount_cents < 0 ? '-' : '+' }}\${{ (Math.abs(item.amount_cents) / 100).toFixed(2) }}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  `
})
export class PipelineTracerComponent implements OnInit {
  searchQuery = 'dd3e8d4a-951f-5c9c-b6ea-25ee499f1acd';
  readonly Math = Math;

  readonly currentTrace = this.tracingService.currentTrace;
  readonly selectedStage = this.tracingService.selectedStage;

  constructor(readonly tracingService: TracingService) {}

  ngOnInit(): void {
    this.tracingService.fetchRecentBets().subscribe();
  }

  onSearch(): void {
    if (this.searchQuery) {
      this.tracingService.traceBet(this.searchQuery);
    }
  }

  refreshRecent(): void {
    this.tracingService.fetchRecentBets().subscribe();
  }

  selectRecentBet(b: RecentBetItem): void {
    this.searchQuery = b.bet_id;
    this.tracingService.traceBet(b.bet_id);
  }

  selectScenario(scenario: 'accepted' | 'stale' | 'saec'): void {
    this.tracingService.loadSampleTrace(scenario);
    const trace = this.tracingService.currentTrace();
    if (trace) {
      this.searchQuery = trace.bet_id;
    }
  }

  onSelectStage(stage: PipelineStageTrace): void {
    this.tracingService.selectStage(stage);
  }

  calcPercentage(duration: number, total: number): number {
    if (!total || total <= 0) return 10;
    return Math.max(8, Math.min(100, Math.round((duration / total) * 100)));
  }

  getDetailEntries(details: Record<string, any>): Array<{ key: string; val: string }> {
    if (!details) return [];
    return Object.entries(details).map(([key, val]) => ({
      key,
      val: typeof val === 'object' ? JSON.stringify(val) : String(val)
    }));
  }

  getJsonString(obj: any): string {
    return JSON.stringify(obj, null, 2);
  }

  copyToClipboard(text: string): void {
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(text);
    }
  }
}
