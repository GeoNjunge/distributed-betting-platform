import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

import { AuthPanelComponent } from './features/auth/auth-panel.component';
import { BetSlipComponent } from './features/bet-slip/bet-slip.component';
import { MarketDisplayComponent } from './features/markets/market-display.component';
import { PipelineTracerComponent } from './features/tracer/pipeline-tracer.component';
import { SystemStatusBarComponent } from './features/system-status/system-status-bar.component';
import { MetricsBannerComponent } from './features/metrics/metrics-banner.component';
import { SettlementPanelComponent } from './features/settlement/settlement-panel.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    AuthPanelComponent,
    BetSlipComponent,
    MarketDisplayComponent,
    PipelineTracerComponent,
    SystemStatusBarComponent,
    MetricsBannerComponent,
    SettlementPanelComponent
  ],
  template: `
    <div class="min-h-screen bg-slate-950 text-slate-100 selection:bg-cyan-500 selection:text-slate-950">
      <!-- Top Ambient Background Glow -->
      <div class="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div class="absolute -left-[10%] -top-[15%] h-[500px] w-[600px] rounded-full bg-emerald-600/10 blur-[130px]"></div>
        <div class="absolute right-[5%] top-[10%] h-[450px] w-[500px] rounded-full bg-cyan-600/10 blur-[140px]"></div>
        <div class="absolute bottom-[5%] left-[20%] h-[400px] w-[500px] rounded-full bg-blue-600/10 blur-[150px]"></div>
      </div>

      <div class="relative z-10 flex min-h-screen flex-col">
        <!-- Main Top Navigation & System Telemetry -->
        <header class="border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md sticky top-0 z-50">
          <div class="mx-auto max-w-7xl px-4 py-3 sm:px-6 lg:px-8">
            <div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <!-- Brand & Core Title -->
              <div class="flex items-center gap-3">
                <div class="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-cyan-600 via-emerald-500 to-teal-400 p-0.5 shadow-lg shadow-cyan-900/30">
                  <div class="flex h-full w-full items-center justify-center rounded-[10px] bg-slate-950">
                    <span class="font-mono text-lg font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-emerald-400">Δ</span>
                  </div>
                </div>
                <div>
                  <div class="flex items-center gap-2">
                    <h1 class="text-base font-extrabold tracking-tight text-white sm:text-lg">Distributed Betting Platform</h1>
                    <span class="rounded bg-cyan-950/80 px-2 py-0.5 font-mono text-[10px] font-bold text-cyan-300 border border-cyan-800/50">
                      v2.4.0 High-Throughput
                    </span>
                  </div>
                  <p class="text-xs text-slate-400">
                    Ultra-low latency STP pipeline &bull; C++ Pre-Trade Risk &bull; Kafka Outbox &bull; PostgreSQL ACID Ledger
                  </p>
                </div>
              </div>

              <!-- View Switcher Tabs -->
              <div class="flex items-center gap-2 rounded-xl bg-slate-900/90 p-1 border border-slate-800">
                <button
                  type="button"
                  (click)="activeTab.set('trading')"
                  class="flex items-center gap-2 rounded-lg px-4 py-1.5 text-xs font-bold transition duration-150"
                  [ngClass]="activeTab() === 'trading' ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md' : 'text-slate-400 hover:text-white'"
                >
                  <span>⚡ Trading Desk</span>
                </button>
                <button
                  type="button"
                  (click)="activeTab.set('tracer')"
                  class="flex items-center gap-2 rounded-lg px-4 py-1.5 text-xs font-bold transition duration-150"
                  [ngClass]="activeTab() === 'tracer' ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-white'"
                >
                  <span class="flex h-2 w-2 rounded-full bg-cyan-400 animate-pulse"></span>
                  <span>🔍 Pipeline Request Tracer</span>
                </button>
              </div>
            </div>
          </div>
        </header>

        <!-- Main Content Body -->
        <main class="mx-auto flex-1 w-full max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
          <!-- Real-Time Infrastructure Status Bar -->
          <app-system-status-bar />

          <!-- Top Metrics Banner Cards -->
          <app-metrics-banner />

          <!-- Tab 1: Live Trading Desk -->
          <div *ngIf="activeTab() === 'trading'" class="space-y-6 animate-fadeIn">
            <div class="grid gap-6 lg:grid-cols-[1fr_360px]">
              <div class="space-y-6">
                <!-- User Authentication Panel -->
                <app-auth-panel />

                <!-- Live Odds Markets Display -->
                <app-market-display />

                <!-- Match Outcome Settlement Trigger -->
                <app-settlement-panel />
              </div>

              <!-- Sticky Order Execution Ticket -->
              <div>
                <app-bet-slip (viewTrace)="onSwitchToTrace($event)" />
              </div>
            </div>
          </div>

          <!-- Tab 2: Distributed Pipeline Request Tracer -->
          <div *ngIf="activeTab() === 'tracer'" class="animate-fadeIn">
            <app-pipeline-tracer />
          </div>
        </main>

        <!-- Footer -->
        <footer class="mt-auto border-t border-slate-900 bg-slate-950/60 py-4 text-center text-xs text-slate-500">
          <p>Distributed Betting Platform Architecture &bull; Ingress FastAPI (:8000) &bull; WebSocket Odds (:8001) &bull; Settlement API (:8002) &bull; Kafka (:9092) &bull; PostgreSQL (:5432)</p>
        </footer>
      </div>
    </div>
  `
})
export class AppComponent {
  readonly activeTab = signal<'trading' | 'tracer'>('trading');

  onSwitchToTrace(betId: string): void {
    this.activeTab.set('tracer');
  }
}
