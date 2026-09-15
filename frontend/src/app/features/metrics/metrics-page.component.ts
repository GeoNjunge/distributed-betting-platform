import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

import { SystemStatusBarComponent } from '../system-status/system-status-bar.component';
import { MetricsBannerComponent } from '../metrics/metrics-banner.component';
import { PipelineTracerComponent } from '../tracer/pipeline-tracer.component';
import { BenchmarkDashboardComponent } from '../benchmark/benchmark-dashboard.component';
import { SettlementPanelComponent } from '../settlement/settlement-panel.component';

type TelemetryTab = 'overview' | 'tracer' | 'benchmarks' | 'settlement';

@Component({
  selector: 'app-metrics-page',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    SystemStatusBarComponent,
    MetricsBannerComponent,
    PipelineTracerComponent,
    BenchmarkDashboardComponent,
    SettlementPanelComponent
  ],
  template: `
    <div class="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 space-y-6">
      
      <!-- Top Action Bar & Route Header -->
      <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-5 dark:border-slate-800">
        <div>
          <div class="flex items-center gap-2">
            <a
              routerLink="/"
              class="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 transition hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300"
            >
              <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back to Sportsbook
            </a>
            <span class="text-slate-400 dark:text-slate-600">/</span>
            <span class="rounded bg-slate-100 px-2 py-0.5 font-mono text-[11px] font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
              STP Telemetry Desk
            </span>
          </div>
          <h1 class="mt-2 text-2xl font-black tracking-tight text-slate-900 dark:text-white">
            System Telemetry & Architecture Diagnostics
          </h1>
          <p class="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            Real-time verification of C++ Risk Engine, Kafka transactional outbox, and PostgreSQL ledger health.
          </p>
        </div>

        <!-- Telemetry Tab Navigation -->
        <div class="flex items-center rounded-xl bg-slate-100 p-1 dark:bg-slate-800/80">
          <button
            type="button"
            (click)="activeTab.set('overview')"
            [ngClass]="activeTab() === 'overview' ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white' : 'text-slate-600 dark:text-slate-400'"
            class="rounded-lg px-3 py-1.5 text-xs font-bold transition"
          >
            Overview
          </button>
          <button
            type="button"
            (click)="activeTab.set('tracer')"
            [ngClass]="activeTab() === 'tracer' ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white' : 'text-slate-600 dark:text-slate-400'"
            class="rounded-lg px-3 py-1.5 text-xs font-bold transition"
          >
            Trace Inspector
          </button>
          <button
            type="button"
            (click)="activeTab.set('benchmarks')"
            [ngClass]="activeTab() === 'benchmarks' ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white' : 'text-slate-600 dark:text-slate-400'"
            class="rounded-lg px-3 py-1.5 text-xs font-bold transition"
          >
            Stress Benchmarks
          </button>
          <button
            type="button"
            (click)="activeTab.set('settlement')"
            [ngClass]="activeTab() === 'settlement' ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white' : 'text-slate-600 dark:text-slate-400'"
            class="rounded-lg px-3 py-1.5 text-xs font-bold transition"
          >
            Settlement Simulator
          </button>
        </div>
      </div>

      <!-- Telemetry Components by Selected Tab -->
      @if (activeTab() === 'overview') {
        <div class="space-y-6">
          <app-system-status-bar></app-system-status-bar>
          <app-metrics-banner></app-metrics-banner>
          <div class="grid gap-6 lg:grid-cols-2">
            <app-pipeline-tracer></app-pipeline-tracer>
            <app-benchmark-dashboard></app-benchmark-dashboard>
          </div>
        </div>
      }

      @if (activeTab() === 'tracer') {
        <div class="space-y-6">
          <app-pipeline-tracer></app-pipeline-tracer>
        </div>
      }

      @if (activeTab() === 'benchmarks') {
        <div class="space-y-6">
          <app-benchmark-dashboard></app-benchmark-dashboard>
        </div>
      }

      @if (activeTab() === 'settlement') {
        <div class="space-y-6">
          <app-settlement-panel></app-settlement-panel>
        </div>
      }

    </div>
  `
})
export class MetricsPageComponent {
  readonly activeTab = signal<TelemetryTab>('overview');
}
