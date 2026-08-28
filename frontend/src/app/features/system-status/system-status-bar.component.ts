import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';

import { SystemStatusService } from '../../core/services/system-status.service';

@Component({
  selector: 'app-system-status-bar',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="rounded-xl border border-slate-800/80 bg-slate-950/70 p-3 backdrop-blur-md">
      <div class="flex flex-wrap items-center justify-between gap-3 text-xs">
        <div class="flex items-center gap-2">
          <span class="text-[11px] font-bold uppercase tracking-wider text-slate-400">Cluster Telemetry:</span>
        </div>

        <div class="flex flex-wrap items-center gap-2 sm:gap-4 font-mono">
          <!-- Kafka Indicator -->
          <div class="flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900/80 px-2.5 py-1">
            <span
              class="h-2 w-2 rounded-full"
              [ngClass]="systemStatus.kafkaConnected() ? 'bg-emerald-400 animate-pulse ring-2 ring-emerald-500/30' : 'bg-rose-500'"
            ></span>
            <span class="font-semibold text-slate-300">Kafka :9092</span>
            <span class="text-[10px] text-cyan-400">({{ systemStatus.health().active_topics.length }} topics)</span>
          </div>

          <!-- Postgres Indicator -->
          <div class="flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900/80 px-2.5 py-1">
            <span
              class="h-2 w-2 rounded-full"
              [ngClass]="systemStatus.postgresConnected() ? 'bg-emerald-400 ring-2 ring-emerald-500/30' : 'bg-rose-500'"
            ></span>
            <span class="font-semibold text-slate-300">PostgreSQL :5432</span>
            <span class="text-[10px] text-cyan-400">({{ systemStatus.health().postgres_latency_ms.toFixed(1) }}ms)</span>
          </div>

          <!-- Ingress Gateway -->
          <div class="flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900/80 px-2.5 py-1">
            <span class="h-2 w-2 rounded-full bg-emerald-400"></span>
            <span class="font-semibold text-slate-300">Ingress :8000</span>
          </div>

          <!-- Odds WebSocket -->
          <div class="flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900/80 px-2.5 py-1">
            <span
              class="h-2 w-2 rounded-full"
              [ngClass]="systemStatus.wsConnected() ? 'bg-cyan-400 animate-pulse ring-2 ring-cyan-500/30' : 'bg-amber-500'"
            ></span>
            <span class="font-semibold text-slate-300">Odds Stream :8001</span>
            <span *ngIf="systemStatus.wsConnected()" class="text-[10px] text-emerald-400 font-bold">
              {{ systemStatus.ticksPerSec() }} ticks/s
            </span>
          </div>

          <!-- Settlement Core -->
          <div class="flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900/80 px-2.5 py-1">
            <span class="h-2 w-2 rounded-full bg-purple-400"></span>
            <span class="font-semibold text-slate-300">Settlement :8002</span>
          </div>
        </div>

        <button
          type="button"
          (click)="systemStatus.refreshNow()"
          class="text-xs text-slate-400 hover:text-white transition"
          title="Poll status now"
        >
          ↺ Sync
        </button>
      </div>
    </div>
  `
})
export class SystemStatusBarComponent {
  constructor(readonly systemStatus: SystemStatusService) {}
}
