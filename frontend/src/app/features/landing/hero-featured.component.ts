import { Component } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';

import { BetSlipService } from '../../core/services/bet-slip.service';
import { OddsWebSocketService } from '../../core/services/odds-websocket.service';
import { MarketSelectionView, PriceDirection } from '../../core/models/odds-tick.model';

interface HighlightMatch {
  id: string;
  category: string;
  homeTeam: string;
  awayTeam: string;
  isLive: boolean;
  selections: {
    label: string;
    selectionId: string;
    defaultOdds: number;
  }[];
}

@Component({
  selector: 'app-hero-featured',
  standalone: true,
  imports: [CommonModule, DecimalPipe],
  template: `
    <section class="relative overflow-hidden rounded-3xl border border-slate-200/80 bg-gradient-to-b from-white to-slate-50/50 p-6 shadow-sm transition-colors dark:border-slate-800 dark:from-slate-900 dark:to-slate-900/60 sm:p-8">
      
      <!-- Subtle Ambient Decorative Glow -->
      <div class="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-emerald-500/10 blur-3xl dark:bg-emerald-500/5"></div>

      <!-- Hero Header -->
      <div class="relative z-10 max-w-2xl">
        <div class="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50/80 px-3 py-1 text-xs font-bold text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300">
          <span class="relative flex h-2 w-2">
            <span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
            <span class="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
          </span>
          <span>Featured Live Matches</span>
        </div>

        <h1 class="mt-3 text-3xl font-black tracking-tight text-slate-900 sm:text-4xl dark:text-white">
          Real-time odds. <span class="text-emerald-600 dark:text-emerald-400">Instant execution.</span>
        </h1>
        <p class="mt-2 text-sm text-slate-600 dark:text-slate-400">
          Pick your odds below or browse live markets. Slips are tracked automatically in real time.
        </p>
      </div>

      <!-- 2 or 3 Highlighted Odds Cards -->
      <div class="relative z-10 mt-6 grid gap-4 md:grid-cols-3">
        @for (match of featuredMatches; track match.id) {
          <div class="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-950/80 dark:hover:border-slate-700">
            
            <!-- Card Meta -->
            <div>
              <div class="flex items-center justify-between">
                <span class="text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                  {{ match.category }}
                </span>
                @if (match.isLive) {
                  <span class="flex items-center gap-1 rounded bg-rose-50 px-1.5 py-0.5 text-[10px] font-bold text-rose-600 dark:bg-rose-950/50 dark:text-rose-400">
                    <span class="h-1.5 w-1.5 rounded-full bg-rose-500 animate-pulse"></span>
                    LIVE
                  </span>
                }
              </div>

              <!-- Match Teams -->
              <div class="mt-2.5">
                <div class="flex items-center justify-between font-bold text-sm text-slate-900 dark:text-white">
                  <span>{{ match.homeTeam }}</span>
                </div>
                <div class="mt-1 flex items-center justify-between font-bold text-sm text-slate-900 dark:text-white">
                  <span>{{ match.awayTeam }}</span>
                </div>
              </div>
            </div>

            <!-- Odds Action Buttons (1, X, 2) -->
            <div class="mt-4 grid grid-cols-3 gap-2">
              @for (btn of match.selections; track btn.selectionId) {
                <button
                  type="button"
                  (click)="onSelectOdds(match.id, btn.selectionId, getOdds(match.id, btn.selectionId, btn.defaultOdds))"
                  [ngClass]="getSelectionClasses(match.id, btn.selectionId)"
                  class="flex flex-col items-center justify-center rounded-xl border py-2 transition hover:border-emerald-400 hover:bg-emerald-50/50 active:scale-95 dark:hover:border-emerald-500/50 dark:hover:bg-slate-800"
                >
                  <span class="text-[10px] font-semibold text-slate-600 dark:text-slate-400">{{ btn.label }}</span>
                  <div class="flex items-center gap-0.5">
                    <span class="font-mono text-xs font-black text-slate-900 dark:text-white">
                      {{ getOdds(match.id, btn.selectionId, btn.defaultOdds) | number:'1.2-2' }}
                    </span>
                    @if (getDirection(match.id, btn.selectionId) !== 'flat') {
                      <span [ngClass]="getDirectionClass(match.id, btn.selectionId)">
                        {{ getDirection(match.id, btn.selectionId) === 'up' ? '▲' : '▼' }}
                      </span>
                    }
                  </div>
                </button>
              }
            </div>

          </div>
        }
      </div>

    </section>
  `
})
export class HeroFeaturedComponent {
  readonly featuredMatches: HighlightMatch[] = [
    {
      id: 'match-0001',
      category: 'Premier League',
      homeTeam: 'Arsenal',
      awayTeam: 'Chelsea',
      isLive: true,
      selections: [
        { label: 'Arsenal', selectionId: 'match-0001-home', defaultOdds: 1.95 },
        { label: 'Draw', selectionId: 'match-0001-draw', defaultOdds: 3.40 },
        { label: 'Chelsea', selectionId: 'match-0001-away', defaultOdds: 3.85 }
      ]
    },
    {
      id: 'match-0002',
      category: 'La Liga (El Clásico)',
      homeTeam: 'Real Madrid',
      awayTeam: 'Barcelona',
      isLive: true,
      selections: [
        { label: 'Real Madrid', selectionId: 'match-0002-home', defaultOdds: 2.10 },
        { label: 'Draw', selectionId: 'match-0002-draw', defaultOdds: 3.60 },
        { label: 'Barcelona', selectionId: 'match-0002-away', defaultOdds: 3.20 }
      ]
    },
    {
      id: 'match-0003',
      category: 'Bundesliga',
      homeTeam: 'Bayern Munich',
      awayTeam: 'Dortmund',
      isLive: false,
      selections: [
        { label: 'Bayern', selectionId: 'match-0003-home', defaultOdds: 1.75 },
        { label: 'Draw', selectionId: 'match-0003-draw', defaultOdds: 4.10 },
        { label: 'Dortmund', selectionId: 'match-0003-away', defaultOdds: 4.50 }
      ]
    }
  ];

  constructor(
    readonly betSlip: BetSlipService,
    readonly odds: OddsWebSocketService
  ) {}

  getLiveSelection(matchId: string, selectionId: string): MarketSelectionView | undefined {
    return this.odds.markets().find(m => m.matchId === matchId && m.selectionId === selectionId);
  }

  getOdds(matchId: string, selectionId: string, fallback: number): number {
    const live = this.getLiveSelection(matchId, selectionId);
    return live ? live.odds : fallback;
  }

  getDirection(matchId: string, selectionId: string): PriceDirection {
    const live = this.getLiveSelection(matchId, selectionId);
    return live ? live.direction : 'flat';
  }

  getDirectionClass(matchId: string, selectionId: string): string {
    const dir = this.getDirection(matchId, selectionId);
    return dir === 'up' ? 'text-emerald-500' : dir === 'down' ? 'text-rose-500' : '';
  }

  isCurrentSelection(matchId: string, selectionId: string): boolean {
    const active = this.betSlip.state().selection;
    return active?.matchId === matchId && active?.selectionId === selectionId;
  }

  getSelectionClasses(matchId: string, selectionId: string): Record<string, boolean> {
    const isSelected = this.isCurrentSelection(matchId, selectionId);
    return {
      'border-emerald-500 bg-emerald-50 text-emerald-700 dark:border-emerald-500 dark:bg-emerald-950/40 dark:text-emerald-300': isSelected,
      'border-slate-200 bg-slate-50/80 dark:border-slate-800 dark:bg-slate-900': !isSelected
    };
  }

  onSelectOdds(matchId: string, selectionId: string, odds: number): void {
    const live = this.getLiveSelection(matchId, selectionId);
    const now = Date.now();
    if (live) {
      this.betSlip.select(live);
    } else {
      this.betSlip.select({
        key: `${matchId}:moneyline:${selectionId}`,
        matchId,
        marketId: 'moneyline',
        selectionId,
        odds,
        sequence: 1,
        timestampMs: now,
        updatedAt: now,
        direction: 'flat'
      });
    }
  }
}
