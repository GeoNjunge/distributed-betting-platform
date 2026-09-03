import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';

import { SystemStatusService } from '../../core/services/system-status.service';

@Component({
  selector: 'app-metrics-banner',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <div
        *ngFor="let m of systemStatus.metrics()"
        class="group relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-lg backdrop-blur-md transition-all hover:border-slate-700 hover:shadow-cyan-950/20"
      >
        <div class="flex items-center justify-between">
          <span class="text-xs font-semibold uppercase tracking-wider text-slate-400">{{ m.name }}</span>
          <span
            class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
            [ngClass]="{
              'bg-emerald-950 text-emerald-400 border border-emerald-800/80': m.status === 'active' || m.status === 'healthy',
              'bg-amber-950 text-amber-400 border border-amber-800/80': m.status === 'pending',
              'bg-rose-950 text-rose-400 border border-rose-800/80': m.status === 'degraded'
            }"
          >
            <span
              class="h-1.5 w-1.5 rounded-full"
              [ngClass]="{
                'bg-emerald-400 animate-pulse': m.status === 'active' || m.status === 'healthy',
                'bg-amber-400': m.status === 'pending',
                'bg-rose-400': m.status === 'degraded'
              }"
            ></span>
            {{ m.status }}
          </span>
        </div>

        <div class="mt-3 flex items-baseline gap-2">
          <span class="text-2xl font-extrabold tracking-tight text-white group-hover:text-cyan-300 transition-colors">
            {{ m.value }}
          </span>
          <span *ngIf="m.unit" class="text-xs font-medium text-slate-400">{{ m.unit }}</span>
        </div>

        <div class="mt-2 flex items-center justify-between text-xs text-slate-400">
          <span>{{ m.change }}</span>
          <span
            *ngIf="m.trend === 'up'"
            class="inline-flex items-center gap-1 font-semibold text-emerald-400"
          >
            <svg class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 10.5 12 3m0 0 7.5 7.5M12 3v18" />
            </svg>
            <span>Live</span>
          </span>
          <span
            *ngIf="m.trend === 'down'"
            class="inline-flex items-center gap-1 font-semibold text-cyan-400"
          >
            <svg class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 13.5 12 21m0 0-7.5-7.5M12 21V3" />
            </svg>
            <span>Sub-ms</span>
          </span>
        </div>
      </div>
    </div>
  `
})
export class MetricsBannerComponent {
  constructor(readonly systemStatus: SystemStatusService) {}
}
