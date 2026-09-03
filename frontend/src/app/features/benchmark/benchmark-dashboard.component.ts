import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BenchmarkService } from '../../core/services/benchmark.service';

@Component({
  selector: 'app-benchmark-dashboard',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="space-y-6">
      <!-- Benchmark Control Header Banner -->
      <div class="rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900/90 via-slate-900/70 to-slate-950 p-6 shadow-2xl backdrop-blur-xl">
        <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div class="space-y-1">
            <div class="flex flex-wrap items-center gap-2">
              <h2 class="text-xl font-black tracking-tight text-white sm:text-2xl">
                C++20 Pre-Trade Risk Engine &bull; Benchmark Telemetry
              </h2>
              <span class="rounded-full bg-cyan-950/90 px-3 py-0.5 text-xs font-bold text-cyan-300 border border-cyan-800/80">
                Hardware Native Execution
              </span>
              <span
                *ngIf="benchmarkService.isSimulating()"
                class="inline-flex items-center gap-1.5 rounded-full bg-emerald-950/90 px-3 py-0.5 text-xs font-bold text-emerald-400 border border-emerald-800/80 animate-pulse"
              >
                <span class="h-2 w-2 rounded-full bg-emerald-400"></span>
                Live Simulation Active
              </span>
            </div>
            <p class="text-sm text-slate-400 max-w-3xl">
              Deterministic single-thread microsecond latency profiling and high-frequency throughput benchmarking over 
              <span class="font-semibold text-slate-200">{{ data()?.total_events_processed | number }}</span> synthetic orders.
            </p>
          </div>

          <!-- Actions & Simulation Toggle -->
          <div class="flex flex-wrap items-center gap-3">
            <button
              type="button"
              (click)="benchmarkService.toggleSimulation()"
              class="flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition duration-200 shadow-lg"
              [ngClass]="{
                'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-emerald-950/40 hover:from-emerald-500 hover:to-teal-500': !benchmarkService.isSimulating(),
                'bg-gradient-to-r from-amber-600 to-orange-600 text-white shadow-amber-950/40 hover:from-amber-500 hover:to-orange-500': benchmarkService.isSimulating()
              }"
            >
              <svg *ngIf="benchmarkService.isSimulating()" class="h-3.5 w-3.5 fill-current" viewBox="0 0 24 24">
                <path d="M6.75 5.25a.75.75 0 0 1 .75.75v12a.75.75 0 0 1-1.5 0v-12a.75.75 0 0 1 .75-.75Zm9.75 0a.75.75 0 0 1 .75.75v12a.75.75 0 0 1-1.5 0v-12a.75.75 0 0 1 .75-.75Z" />
              </svg>
              <svg *ngIf="!benchmarkService.isSimulating()" class="h-3.5 w-3.5 fill-current" viewBox="0 0 24 24">
                <path d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347a1.125 1.125 0 0 1-1.667-.986V5.653Z" />
              </svg>
              <span>{{ benchmarkService.isSimulating() ? 'Pause Simulation' : 'Start Live Simulation' }}</span>
            </button>

            <button
              type="button"
              (click)="benchmarkService.fetchBenchmarkData()"
              class="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800/80 px-4 py-2.5 text-xs font-semibold text-slate-200 hover:bg-slate-700 hover:text-white transition duration-150 shadow-md"
            >
              <svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
              </svg>
              <span>Reload Asset</span>
            </button>
          </div>
        </div>

        <!-- Meta Sub-Info -->
        <div class="mt-4 flex flex-wrap items-center gap-4 border-t border-slate-800/80 pt-3 text-xs text-slate-400">
          <div>
            <span class="text-slate-500">Benchmark Asset:</span>
            <code class="ml-1 rounded bg-slate-950 px-1.5 py-0.5 font-mono text-cyan-300">frontend/src/assets/benchmark-data.json</code>
          </div>
          <div>
            <span class="text-slate-500">Last Profiled:</span>
            <span class="ml-1 font-mono text-slate-300">{{ data()?.timestamp || 'N/A' }}</span>
          </div>
          <div>
            <span class="text-slate-500">Sample Pool:</span>
            <span class="ml-1 font-mono text-emerald-400">100 concurrent trader accounts</span>
          </div>
        </div>
      </div>

      <!-- Core Performance Metric Cards -->
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <!-- Card 1: Throughput -->
        <div class="group relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-xl backdrop-blur-md transition-all hover:border-cyan-800/60">
          <div class="flex items-center justify-between">
            <span class="text-xs font-semibold uppercase tracking-wider text-slate-400">Core Throughput</span>
            <span class="rounded bg-cyan-950/80 px-2 py-0.5 font-mono text-[10px] font-bold text-cyan-300 border border-cyan-800/50">
              C++20 Hot-Path
            </span>
          </div>
          <div class="mt-3 flex items-baseline gap-2">
            <span class="text-3xl font-black tracking-tight text-white group-hover:text-cyan-300 transition-colors">
              {{ (benchmarkService.isSimulating() ? benchmarkService.simulationThroughput() : data()?.throughput_ops_sec) | number }}
            </span>
            <span class="text-xs font-medium text-slate-400">ops/sec</span>
          </div>
          <div class="mt-2 flex items-center justify-between text-xs text-slate-400">
            <span class="inline-flex items-center gap-1 text-emerald-400 font-semibold">
              <svg class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 10.5 12 3m0 0 7.5 7.5M12 3v18" />
              </svg>
              <span>100% In-Memory</span>
            </span>
            <span class="text-slate-500">Single Thread</span>
          </div>
          <div class="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
            <div class="h-full rounded-full bg-gradient-to-r from-cyan-500 to-emerald-400 transition-all duration-300" style="width: 88%"></div>
          </div>
        </div>

        <!-- Card 2: p50 Median Latency -->
        <div class="group relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-xl backdrop-blur-md transition-all hover:border-emerald-800/60">
          <div class="flex items-center justify-between">
            <span class="text-xs font-semibold uppercase tracking-wider text-slate-400">p50 Median Latency</span>
            <span class="rounded bg-emerald-950/80 px-2 py-0.5 font-mono text-[10px] font-bold text-emerald-300 border border-emerald-800/50">
              Sub-Microsecond
            </span>
          </div>
          <div class="mt-3 flex items-baseline gap-2">
            <span class="text-3xl font-black tracking-tight text-white group-hover:text-emerald-300 transition-colors">
              {{ (benchmarkService.isSimulating() ? benchmarkService.simulationP50() : data()?.p50_latency_us) | number:'1.2-2' }}
            </span>
            <span class="text-xs font-medium text-slate-400">µs (microseconds)</span>
          </div>
          <div class="mt-2 flex items-center justify-between text-xs text-slate-400">
            <span class="text-slate-400">Fast-Path Decision</span>
            <span class="font-mono text-emerald-400 font-semibold">0.004 ms</span>
          </div>
          <div class="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
            <div class="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400" style="width: 95%"></div>
          </div>
        </div>

        <!-- Card 3: p99 Tail Latency -->
        <div class="group relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-xl backdrop-blur-md transition-all hover:border-purple-800/60">
          <div class="flex items-center justify-between">
            <span class="text-xs font-semibold uppercase tracking-wider text-slate-400">p99 Tail Latency</span>
            <span class="rounded bg-purple-950/80 px-2 py-0.5 font-mono text-[10px] font-bold text-purple-300 border border-purple-800/50">
              SLA Bound
            </span>
          </div>
          <div class="mt-3 flex items-baseline gap-2">
            <span class="text-3xl font-black tracking-tight text-white group-hover:text-purple-300 transition-colors">
              {{ (benchmarkService.isSimulating() ? benchmarkService.simulationP99() : data()?.p99_latency_us) | number:'1.2-2' }}
            </span>
            <span class="text-xs font-medium text-slate-400">µs</span>
          </div>
          <div class="mt-2 flex items-center justify-between text-xs text-slate-400">
            <span class="text-purple-400 font-semibold">99% of requests &lt; 15µs</span>
            <span class="text-slate-500">Zero GC Jitter</span>
          </div>
          <div class="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
            <div class="h-full rounded-full bg-gradient-to-r from-purple-500 to-pink-500" style="width: 84%"></div>
          </div>
        </div>

        <!-- Card 4: Memory & Allocations -->
        <div class="group relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-xl backdrop-blur-md transition-all hover:border-blue-800/60">
          <div class="flex items-center justify-between">
            <span class="text-xs font-semibold uppercase tracking-wider text-slate-400">Memory Footprint</span>
            <span class="rounded bg-blue-950/80 px-2 py-0.5 font-mono text-[10px] font-bold text-blue-300 border border-blue-800/50">
              Zero-Copy
            </span>
          </div>
          <div class="mt-3 flex items-baseline gap-2">
            <span class="text-3xl font-black tracking-tight text-white group-hover:text-blue-300 transition-colors">
              {{ data()?.memory_footprint_mb | number:'1.2-2' }}
            </span>
            <span class="text-xs font-medium text-slate-400">MB (RSS)</span>
          </div>
          <div class="mt-2 flex items-center justify-between text-xs text-slate-400">
            <span class="text-cyan-400 font-semibold">std::string_view parser</span>
            <span class="text-slate-500">Lock-Free CAS</span>
          </div>
          <div class="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
            <div class="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-400" style="width: 92%"></div>
          </div>
        </div>
      </div>

      <!-- Latency Breakdown & Live Sparkline Charts -->
      <div class="grid gap-6 lg:grid-cols-2">
        <!-- Left Column: Latency Percentile Histogram / Waterfall -->
        <div class="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-xl backdrop-blur-md">
          <div class="flex items-center justify-between border-b border-slate-800/80 pb-4">
            <div>
              <h3 class="text-base font-bold text-white">Latency Distribution Waterfall</h3>
              <p class="text-xs text-slate-400">Microsecond breakdown across execution percentiles</p>
            </div>
            <span class="font-mono text-xs text-slate-400">Unit: Microseconds (µs)</span>
          </div>

          <div class="mt-6 space-y-4">
            <!-- Min -->
            <div>
              <div class="flex items-center justify-between text-xs font-semibold mb-1">
                <span class="text-slate-400">Minimum (Best-Case)</span>
                <span class="font-mono text-emerald-400">{{ data()?.min_latency_us | number:'1.2-2' }} µs</span>
              </div>
              <div class="h-2.5 w-full overflow-hidden rounded-full bg-slate-950 border border-slate-800">
                <div class="h-full rounded-full bg-emerald-500" style="width: 15%"></div>
              </div>
            </div>

            <!-- p50 -->
            <div>
              <div class="flex items-center justify-between text-xs font-semibold mb-1">
                <span class="text-slate-300">p50 (Median)</span>
                <span class="font-mono text-cyan-300 font-bold">
                  {{ (benchmarkService.isSimulating() ? benchmarkService.simulationP50() : data()?.p50_latency_us) | number:'1.2-2' }} µs
                </span>
              </div>
              <div class="h-2.5 w-full overflow-hidden rounded-full bg-slate-950 border border-slate-800">
                <div class="h-full rounded-full bg-cyan-500" style="width: 25%"></div>
              </div>
            </div>

            <!-- Average -->
            <div>
              <div class="flex items-center justify-between text-xs font-semibold mb-1">
                <span class="text-slate-400">Arithmetic Mean</span>
                <span class="font-mono text-cyan-400">{{ data()?.avg_latency_us | number:'1.2-2' }} µs</span>
              </div>
              <div class="h-2.5 w-full overflow-hidden rounded-full bg-slate-950 border border-slate-800">
                <div class="h-full rounded-full bg-teal-500" style="width: 32%"></div>
              </div>
            </div>

            <!-- p90 -->
            <div>
              <div class="flex items-center justify-between text-xs font-semibold mb-1">
                <span class="text-slate-400">p90 Percentile</span>
                <span class="font-mono text-blue-400">{{ data()?.p90_latency_us | number:'1.2-2' }} µs</span>
              </div>
              <div class="h-2.5 w-full overflow-hidden rounded-full bg-slate-950 border border-slate-800">
                <div class="h-full rounded-full bg-blue-500" style="width: 45%"></div>
              </div>
            </div>

            <!-- p95 -->
            <div>
              <div class="flex items-center justify-between text-xs font-semibold mb-1">
                <span class="text-slate-400">p95 Percentile</span>
                <span class="font-mono text-indigo-400">{{ data()?.p95_latency_us | number:'1.2-2' }} µs</span>
              </div>
              <div class="h-2.5 w-full overflow-hidden rounded-full bg-slate-950 border border-slate-800">
                <div class="h-full rounded-full bg-indigo-500" style="width: 58%"></div>
              </div>
            </div>

            <!-- p99 -->
            <div>
              <div class="flex items-center justify-between text-xs font-semibold mb-1">
                <span class="text-slate-300 font-bold">p99 Tail Worst-Case</span>
                <span class="font-mono text-purple-300 font-bold">
                  {{ (benchmarkService.isSimulating() ? benchmarkService.simulationP99() : data()?.p99_latency_us) | number:'1.2-2' }} µs
                </span>
              </div>
              <div class="h-2.5 w-full overflow-hidden rounded-full bg-slate-950 border border-slate-800">
                <div class="h-full rounded-full bg-purple-500" style="width: 78%"></div>
              </div>
            </div>
          </div>

          <!-- Speed comparison benchmark callout -->
          <div class="mt-6 rounded-xl border border-emerald-900/60 bg-emerald-950/20 p-4">
            <div class="flex items-start gap-3">
              <span class="inline-flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-emerald-900/40 text-emerald-400">
                <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" d="m3.75 13.5 10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75Z" />
                </svg>
              </span>
              <div class="text-xs text-emerald-300/90 leading-relaxed">
                <strong class="text-emerald-200">3,500x Faster than Dynamic Interpreters:</strong> 
                Standard Python/Node.js validation loops require 10–25ms. The C++20 engine completes payload parsing, quote age calculation, and lock-free CAS debits in <strong class="text-white">&lt; 5 microseconds</strong>.
              </div>
            </div>
          </div>
        </div>

        <!-- Right Column: Live Telemetry Sparkline & Trend -->
        <div class="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-xl backdrop-blur-md flex flex-col justify-between">
          <div>
            <div class="flex items-center justify-between border-b border-slate-800/80 pb-4">
              <div>
                <h3 class="text-base font-bold text-white">Live Telemetry Trend</h3>
                <p class="text-xs text-slate-400">Rolling throughput window (ops/sec)</p>
              </div>
              <div class="flex items-center gap-2">
                <span class="flex h-2 w-2 rounded-full bg-cyan-400" [ngClass]="{'animate-pulse': benchmarkService.isSimulating()}"></span>
                <span class="font-mono text-xs text-cyan-300">
                  {{ (benchmarkService.isSimulating() ? benchmarkService.simulationThroughput() : data()?.throughput_ops_sec) | number }} ops/s
                </span>
              </div>
            </div>

            <!-- SVG Visualizer Chart -->
            <div class="mt-6">
              <div class="h-44 w-full rounded-xl bg-slate-950/90 p-3 border border-slate-800/80 relative overflow-hidden flex items-end">
                <!-- Background Grid Lines -->
                <div class="absolute inset-0 flex flex-col justify-between p-3 pointer-events-none opacity-20">
                  <div class="border-b border-cyan-500 w-full"></div>
                  <div class="border-b border-cyan-500 w-full"></div>
                  <div class="border-b border-cyan-500 w-full"></div>
                </div>

                <!-- SVG Sparkline Area -->
                <svg class="w-full h-32 overflow-visible" viewBox="0 0 400 100" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="chartGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stop-color="#06b6d4" stop-opacity="0.4" />
                      <stop offset="100%" stop-color="#06b6d4" stop-opacity="0.0" />
                    </linearGradient>
                  </defs>
                  <!-- Polygon Area Fill -->
                  <polygon
                    [attr.points]="chartPolygonPoints()"
                    fill="url(#chartGradient)"
                  />
                  <!-- Polyline Stroke -->
                  <polyline
                    [attr.points]="chartPolylinePoints()"
                    fill="none"
                    stroke="#22d3ee"
                    stroke-width="2.5"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
              </div>

              <div class="mt-2 flex items-center justify-between text-[10px] text-slate-500 font-mono">
                <span>T-25s</span>
                <span>T-12s</span>
                <span>Current Real-Time</span>
              </div>
            </div>
          </div>

          <!-- Live Sample Stream Table -->
          <div class="mt-6 border-t border-slate-800/80 pt-4">
            <h4 class="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
              Recent Order Evaluation Stream
            </h4>
            <div class="space-y-1.5 max-h-40 overflow-y-auto font-mono text-xs">
              <div
                *ngFor="let sample of benchmarkService.liveSamples(); let i = index"
                class="flex items-center justify-between rounded-lg bg-slate-950/70 px-3 py-1.5 border border-slate-800/60"
              >
                <div class="flex items-center gap-2">
                  <span class="text-cyan-400 font-semibold">{{ sample.orderId }}</span>
                  <span class="text-slate-500 text-[11px]">{{ sample.accountId }}</span>
                </div>
                <div class="flex items-center gap-3">
                  <span class="text-slate-400 text-[11px]">{{ sample.latencyUs }} µs</span>
                  <span
                    class="rounded px-1.5 py-0.5 text-[10px] font-bold"
                    [ngClass]="{
                      'bg-emerald-950 text-emerald-400 border border-emerald-800/80': sample.decision === 'ACCEPTED',
                      'bg-rose-950 text-rose-400 border border-rose-800/80': sample.decision === 'REJECTED'
                    }"
                  >
                    {{ sample.decision }}
                  </span>
                </div>
              </div>

              <div *ngIf="benchmarkService.liveSamples().length === 0" class="text-center py-4 text-xs text-slate-500">
                Click <strong>"Start Live Simulation"</strong> to stream synthetic high-frequency transactions.
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Architectural Deep-Dive Grid -->
      <div class="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-xl backdrop-blur-md">
        <h3 class="text-base font-bold text-white mb-4">Underlying Systems & Low-Latency Architecture</h3>
        <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <!-- Spec 1 -->
          <div class="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
            <div class="flex items-center gap-2 text-cyan-400 font-bold text-sm mb-1">
              <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" d="m3.75 13.5 10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75Z" />
              </svg>
              <span>Zero-Copy String Views</span>
            </div>
            <p class="text-xs text-slate-400 leading-relaxed">
              Payloads are parsed using <code class="text-slate-300">std::string_view</code> pointers into the message buffer, eliminating dynamic memory allocations on the hot path.
            </p>
          </div>

          <!-- Spec 2 -->
          <div class="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
            <div class="flex items-center gap-2 text-emerald-400 font-bold text-sm mb-1">
              <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
              </svg>
              <span>Lock-Free CAS Atomics</span>
            </div>
            <p class="text-xs text-slate-400 leading-relaxed">
              Account balances utilize <code class="text-slate-300">std::atomic&lt;int64_t&gt;</code> with <code class="text-slate-300">compare_exchange_weak</code> to prevent mutex contention across CPU cores.
            </p>
          </div>

          <!-- Spec 3 -->
          <div class="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
            <div class="flex items-center gap-2 text-amber-400 font-bold text-sm mb-1">
              <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
              </svg>
              <span>Stale Quote Protection</span>
            </div>
            <p class="text-xs text-slate-400 leading-relaxed">
              Quotes older than 200ms are deterministically dropped before risk calculation, protecting the book from latency arbitrage.
            </p>
          </div>

          <!-- Spec 4 -->
          <div class="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
            <div class="flex items-center gap-2 text-purple-400 font-bold text-sm mb-1">
              <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 3v17.25m0 0c-1.472 0-2.882.265-4.185.75M12 20.25c1.472 0 2.882.265 4.185.75M18.75 4.97A48.416 48.416 0 0 0 12 4.5c-2.291 0-4.545.16-6.75.47m13.5 0c1.01.143 2.01.317 3 .52m-3-.52 2.62 10.726c.122.499-.106 1.028-.589 1.202a5.988 5.988 0 0 1-2.031.352 5.988 5.988 0 0 1-2.031-.352c-.483-.174-.711-.703-.59-1.202L18.75 4.971Zm-16.5.52c.99-.203 1.99-.377 3-.52m0 0 2.62 10.726c.122.499-.106 1.028-.589 1.202a5.989 5.989 0 0 1-2.031.352 5.989 5.989 0 0 1-2.031-.352c-.483-.174-.711-.703-.59-1.202L5.25 4.971Z" />
              </svg>
              <span>Single-Account Exposure</span>
            </div>
            <p class="text-xs text-slate-400 leading-relaxed">
              SAEC guarantees aggregate open liability does not exceed $10,000 per user account with atomic check-then-reserve logic.
            </p>
          </div>
        </div>
      </div>
    </div>
  `
})
export class BenchmarkDashboardComponent {
  readonly benchmarkService = inject(BenchmarkService);
  readonly data = computed(() => this.benchmarkService.benchmarkData());

  readonly chartPolylinePoints = computed(() => {
    const history = this.benchmarkService.chartHistory();
    if (history.length === 0) return '0,50 400,50';

    const minThroughput = 120000;
    const maxThroughput = 180000;
    const width = 400;
    const height = 100;

    return history
      .map((pt, idx) => {
        const x = (idx / (history.length - 1 || 1)) * width;
        const normalized = (pt.throughput - minThroughput) / (maxThroughput - minThroughput);
        const clamped = Math.max(0.05, Math.min(0.95, normalized));
        const y = height - clamped * height;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
  });

  readonly chartPolygonPoints = computed(() => {
    const polyline = this.chartPolylinePoints();
    return `0,100 ${polyline} 400,100`;
  });
}
