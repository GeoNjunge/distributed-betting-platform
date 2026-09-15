import { Component, OnInit, computed } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';

import { OddsWebSocketService } from '../../core/services/odds-websocket.service';
import { BetSlipService } from '../../core/services/bet-slip.service';
import { MarketSelectionView } from '../../core/models/odds-tick.model';

interface MarketGroup {
  matchId: string;
  matchTitle: string;
  category: string;
  selections: MarketSelectionView[];
}

const MATCH_METADATA: Record<string, { title: string; category: string }> = {
  'match-0001': { title: 'Arsenal vs Chelsea', category: 'Premier League' },
  'match-0002': { title: 'Real Madrid vs Barcelona', category: 'La Liga (El Clásico)' },
  'match-0003': { title: 'Bayern Munich vs Dortmund', category: 'Bundesliga (Der Klassiker)' }
};

@Component({
  selector: 'app-market-display',
  standalone: true,
  imports: [CommonModule, DecimalPipe],
  template: `
    <section id="live-markets" class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-colors dark:border-slate-800 dark:bg-slate-900">
      
      <!-- Section Header -->
      <div class="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4 dark:border-slate-800">
        <div>
          <div class="flex items-center gap-2">
            <span class="flex h-2.5 w-2.5 rounded-full bg-emerald-500 ring-4 ring-emerald-500/20 animate-pulse"></span>
            <span class="text-[10px] font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">Live Odds Feed</span>
          </div>
          <h2 class="text-xl font-extrabold tracking-tight text-slate-900 dark:text-white">All Live Markets</h2>
          <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Real-time market ticks streamed continuously via low-latency WebSocket.</p>
        </div>
        
        <div class="flex items-center gap-2">
          <button
            type="button"
            class="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 active:scale-95"
            (click)="odds.connect()"
          >
            <span class="h-2 w-2 rounded-full" [ngClass]="odds.connected() ? 'bg-emerald-500 animate-ping' : 'bg-amber-500'"></span>
            {{ odds.connected() ? 'Live Stream Active' : 'Reconnect Stream' }}
          </button>
        </div>
      </div>

      <!-- Match Cards Grid -->
      <div class="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        @for (market of groupedMarkets(); track market.matchId) {
          <article class="rounded-2xl border border-slate-200 bg-slate-50/50 p-4 transition-all hover:border-slate-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-950/60 dark:hover:border-slate-700">
            <div class="mb-3 flex items-start justify-between border-b border-slate-200/60 pb-2.5 dark:border-slate-800/80">
              <div>
                <span class="text-[10px] font-mono uppercase font-bold text-emerald-600 dark:text-emerald-400">{{ market.category }}</span>
                <h3 class="font-bold text-sm text-slate-900 dark:text-white">{{ market.matchTitle }}</h3>
              </div>
              <span class="rounded bg-slate-200/60 px-2 py-0.5 font-mono text-[10px] text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                {{ market.matchId }}
              </span>
            </div>

            <div class="grid gap-2">
              @for (selection of market.selections; track selection.key) {
                <button
                  type="button"
                  class="group relative flex items-center justify-between rounded-xl border p-3 text-left transition-all duration-150 active:scale-98"
                  [ngClass]="priceClasses(selection)"
                  (click)="betSlip.select(selection)"
                >
                  <div>
                    <span class="block text-xs font-bold text-slate-800 group-hover:text-emerald-600 transition-colors dark:text-slate-200 dark:group-hover:text-emerald-400">
                      {{ formatSelectionTitle(selection.selectionId) }}
                    </span>
                    <span class="block text-[10px] font-mono text-slate-400 dark:text-slate-500">
                      seq #{{ selection.sequence }}
                    </span>
                  </div>

                  <div class="flex items-center gap-2">
                    <span
                      *ngIf="selection.direction !== 'flat'"
                      class="inline-flex items-center text-xs font-bold"
                      [ngClass]="selection.direction === 'up' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'"
                    >
                      {{ selection.direction === 'up' ? '▲' : '▼' }}
                    </span>
                    <span class="font-mono text-base font-extrabold text-slate-900 dark:text-white">
                      {{ selection.odds | number:'1.2-4' }}
                    </span>
                  </div>
                </button>
              }
            </div>
          </article>
        } @empty {
          <!-- Fallback Preview Cards when WS initializes -->
          <article *ngFor="let def of defaultPreviewMarkets" class="rounded-2xl border border-slate-200 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-950/60">
            <div class="mb-3 flex items-start justify-between border-b border-slate-200/60 pb-2.5 dark:border-slate-800/80">
              <div>
                <span class="text-[10px] font-mono uppercase font-bold text-emerald-600 dark:text-emerald-400">{{ def.category }}</span>
                <h3 class="font-bold text-sm text-slate-900 dark:text-white">{{ def.title }}</h3>
              </div>
              <span class="rounded bg-slate-200/60 px-2 py-0.5 font-mono text-[10px] text-slate-600 dark:bg-slate-800 dark:text-slate-400">{{ def.id }}</span>
            </div>
            <div class="grid gap-2">
              <button
                *ngFor="let sel of def.selections"
                type="button"
                (click)="onSelectPreset(def.id, sel.id, sel.odds)"
                class="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3 text-left transition hover:border-emerald-500/60 hover:bg-emerald-50/30 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-emerald-500/60 dark:hover:bg-slate-800"
              >
                <div>
                  <span class="block text-xs font-bold text-slate-800 dark:text-slate-200">{{ sel.name }}</span>
                  <span class="block text-[10px] font-mono text-slate-400 dark:text-slate-500">Pre-match</span>
                </div>
                <span class="font-mono text-base font-extrabold text-slate-900 dark:text-white">{{ sel.odds.toFixed(2) }}</span>
              </button>
            </div>
          </article>
        }
      </div>
    </section>
  `
})
export class MarketDisplayComponent implements OnInit {
  readonly defaultPreviewMarkets = [
    {
      id: 'match-0001',
      title: 'Arsenal vs Chelsea',
      category: 'Premier League',
      selections: [
        { id: 'match-0001-home', name: 'Arsenal (Home Win)', odds: 1.95 },
        { id: 'match-0001-draw', name: 'Draw (X)', odds: 3.40 },
        { id: 'match-0001-away', name: 'Chelsea (Away Win)', odds: 3.85 }
      ]
    },
    {
      id: 'match-0002',
      title: 'Real Madrid vs Barcelona',
      category: 'La Liga (El Clásico)',
      selections: [
        { id: 'match-0002-home', name: 'Real Madrid (Home Win)', odds: 2.10 },
        { id: 'match-0002-draw', name: 'Draw (X)', odds: 3.60 },
        { id: 'match-0002-away', name: 'Barcelona (Away Win)', odds: 3.20 }
      ]
    },
    {
      id: 'match-0003',
      title: 'Bayern Munich vs Dortmund',
      category: 'Bundesliga (Der Klassiker)',
      selections: [
        { id: 'match-0003-home', name: 'Bayern Munich (Home Win)', odds: 1.75 },
        { id: 'match-0003-draw', name: 'Draw (X)', odds: 4.10 },
        { id: 'match-0003-away', name: 'Dortmund (Away Win)', odds: 4.50 }
      ]
    }
  ];

  readonly groupedMarkets = computed<MarketGroup[]>(() => {
    const groups = new Map<string, MarketSelectionView[]>();
    for (const selection of this.odds.markets()) {
      groups.set(selection.matchId, [...(groups.get(selection.matchId) ?? []), selection]);
    }
    return Array.from(groups.entries()).map(([matchId, selections]) => ({
      matchId,
      matchTitle: MATCH_METADATA[matchId]?.title ?? matchId,
      category: MATCH_METADATA[matchId]?.category ?? 'Live Match',
      selections
    }));
  });

  constructor(readonly odds: OddsWebSocketService, readonly betSlip: BetSlipService) {}

  ngOnInit(): void {
    this.odds.connect();
  }

  formatSelectionTitle(selectionId: string): string {
    if (selectionId.endsWith('-home')) return 'Home Win (1)';
    if (selectionId.endsWith('-away')) return 'Away Win (2)';
    if (selectionId.endsWith('-draw')) return 'Draw (X)';
    return selectionId;
  }

  onSelectPreset(matchId: string, selectionId: string, odds: number): void {
    const now = Date.now();
    this.betSlip.select({
      key: `${matchId}:${selectionId}`,
      matchId,
      marketId: 'full_time_result',
      selectionId,
      odds,
      sequence: 1,
      direction: 'flat',
      timestampMs: now,
      updatedAt: now
    });
  }

  priceClasses(selection: MarketSelectionView): Record<string, boolean> {
    return {
      'border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-500/80 dark:bg-emerald-950/40 dark:text-emerald-200': selection.direction === 'up',
      'border-rose-300 bg-rose-50 text-rose-900 dark:border-rose-500/80 dark:bg-rose-950/40 dark:text-rose-200': selection.direction === 'down',
      'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900/60 dark:hover:border-slate-700': selection.direction === 'flat'
    };
  }
}
