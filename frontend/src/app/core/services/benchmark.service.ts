import { Injectable, signal, computed, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError, of, tap } from 'rxjs';
import { BenchmarkData, LiveBenchmarkSample, TelemetryPoint } from '../models/benchmark.model';

@Injectable({
  providedIn: 'root'
})
export class BenchmarkService implements OnDestroy {
  readonly benchmarkData = signal<BenchmarkData | null>(null);
  readonly loading = signal<boolean>(false);
  readonly error = signal<string | null>(null);

  // Live Simulation state
  readonly isSimulating = signal<boolean>(false);
  readonly simulationThroughput = signal<number>(149034);
  readonly simulationP50 = signal<number>(4.2);
  readonly simulationP99 = signal<number>(11.8);
  readonly liveSamples = signal<LiveBenchmarkSample[]>([]);
  readonly chartHistory = signal<TelemetryPoint[]>([]);

  private simulationIntervalId: any = null;

  // Fallback data if assets/benchmark-data.json is not yet generated
  private readonly defaultFallback: BenchmarkData = {
    timestamp: new Date().toISOString(),
    total_events_processed: 50000,
    throughput_ops_sec: 149034,
    p50_latency_us: 4.2,
    p90_latency_us: 5.2,
    p95_latency_us: 5.8,
    p99_latency_us: 11.8,
    min_latency_us: 2.0,
    max_latency_us: 4617.0,
    avg_latency_us: 5.3,
    memory_footprint_mb: 6.25,
    zero_copy_string_view: true,
    lock_free_atomics: true,
    accepted_count: 49000,
    rejected_count: 1000
  };

  constructor(private readonly http: HttpClient) {
    this.initChartHistory();
    this.fetchBenchmarkData();
  }

  fetchBenchmarkData(): void {
    this.loading.set(true);
    this.error.set(null);

    this.http.get<BenchmarkData>('assets/benchmark-data.json').pipe(
      tap((data) => {
        this.benchmarkData.set(data);
        this.simulationThroughput.set(data.throughput_ops_sec);
        this.simulationP50.set(data.p50_latency_us);
        this.simulationP99.set(data.p99_latency_us);
        this.loading.set(false);
      }),
      catchError((err) => {
        console.warn('[BenchmarkService] Could not load assets/benchmark-data.json, using default telemetry data', err);
        this.benchmarkData.set(this.defaultFallback);
        this.simulationThroughput.set(this.defaultFallback.throughput_ops_sec);
        this.simulationP50.set(this.defaultFallback.p50_latency_us);
        this.simulationP99.set(this.defaultFallback.p99_latency_us);
        this.loading.set(false);
        return of(this.defaultFallback);
      })
    ).subscribe();
  }

  toggleSimulation(): void {
    if (this.isSimulating()) {
      this.stopSimulation();
    } else {
      this.startSimulation();
    }
  }

  startSimulation(): void {
    if (this.isSimulating()) return;
    this.isSimulating.set(true);

    this.simulationIntervalId = setInterval(() => {
      this.tickSimulation();
    }, 600);
  }

  stopSimulation(): void {
    if (this.simulationIntervalId) {
      clearInterval(this.simulationIntervalId);
      this.simulationIntervalId = null;
    }
    this.isSimulating.set(false);
  }

  private initChartHistory(): void {
    const points: TelemetryPoint[] = [];
    const baseThroughput = 148000;
    const baseLatency = 4.2;
    const now = Date.now();

    for (let i = 20; i >= 0; i--) {
      const timeStr = new Date(now - i * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const jitter = (Math.random() - 0.5) * 8000;
      const latJitter = (Math.random() - 0.5) * 0.8;
      points.push({
        timeLabel: timeStr,
        throughput: Math.round(baseThroughput + jitter),
        latencyUs: parseFloat((baseLatency + latJitter).toFixed(2))
      });
    }
    this.chartHistory.set(points);
  }

  private tickSimulation(): void {
    const base = this.benchmarkData()?.throughput_ops_sec || 149000;
    const jitterPercent = (Math.random() - 0.48) * 0.12;
    const currentOps = Math.max(120000, Math.round(base * (1 + jitterPercent)));

    const baseLat = this.benchmarkData()?.p50_latency_us || 4.2;
    const latJitter = (Math.random() - 0.5) * 1.4;
    const currentP50 = parseFloat((baseLat + latJitter).toFixed(2));
    const currentP99 = parseFloat((currentP50 * (2.2 + Math.random() * 0.8)).toFixed(2));

    this.simulationThroughput.set(currentOps);
    this.simulationP50.set(currentP50);
    this.simulationP99.set(currentP99);

    // Update Chart History
    const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const currentHistory = [...this.chartHistory()];
    if (currentHistory.length >= 25) {
      currentHistory.shift();
    }
    currentHistory.push({
      timeLabel: nowStr,
      throughput: currentOps,
      latencyUs: currentP50
    });
    this.chartHistory.set(currentHistory);

    // Generate simulated event sample
    const isAccepted = Math.random() > 0.04;
    const reasons = ['STALE_QUOTE', 'SAEC_EXCEEDED', 'INSUFFICIENT_FUNDS'];
    const reasonCode = isAccepted ? 'ACCEPTED' : reasons[Math.floor(Math.random() * reasons.length)];
    const accountIndex = Math.floor(Math.random() * 100);
    const orderNum = Math.floor(100000 + Math.random() * 900000);

    const newSample: LiveBenchmarkSample = {
      id: `sample-${Date.now()}-${orderNum}`,
      orderId: `bet-${orderNum}`,
      accountId: `trader-${accountIndex}`,
      latencyUs: parseFloat((currentP50 * (0.8 + Math.random() * 1.5)).toFixed(2)),
      decision: isAccepted ? 'ACCEPTED' : 'REJECTED',
      reasonCode,
      timestamp: new Date().toISOString().substring(11, 23)
    };

    const samples = [newSample, ...this.liveSamples()].slice(0, 8);
    this.liveSamples.set(samples);
  }

  ngOnDestroy(): void {
    this.stopSimulation();
  }
}
