import { Injectable, OnDestroy, computed, signal } from '@angular/core';
import { webSocket, WebSocketSubject } from 'rxjs/webSocket';
import { EMPTY, Subject, catchError, retry, takeUntil, tap } from 'rxjs';

import { environment } from '../../../environments/environment';
import { MarketSelectionView, OddsTick } from '../models/odds-tick.model';

@Injectable({ providedIn: 'root' })
export class OddsWebSocketService implements OnDestroy {
  private socket?: WebSocketSubject<OddsTick>;
  private readonly destroy$ = new Subject<void>();
  private readonly marketsSignal = signal<Record<string, MarketSelectionView>>({});
  private readonly connectedSignal = signal(false);

  readonly connected = this.connectedSignal.asReadonly();
  readonly markets = computed(() => Object.values(this.marketsSignal()).sort((a, b) => a.matchId.localeCompare(b.matchId) || a.selectionId.localeCompare(b.selectionId)));

  connect(): void {
    if (this.socket && !this.socket.closed) {
      return;
    }

    this.socket = webSocket<OddsTick>({
      url: environment.oddsWebSocketUrl,
      binaryType: 'arraybuffer',
      deserializer: (event) => {
        const data = event.data instanceof ArrayBuffer ? new TextDecoder().decode(event.data) : String(event.data);
        return JSON.parse(data) as OddsTick;
      },
      serializer: (value) => JSON.stringify(value),
      openObserver: { next: () => this.connectedSignal.set(true) },
      closeObserver: { next: () => this.connectedSignal.set(false) }
    });

    this.socket.pipe(
      tap((tick) => this.applyTick(tick)),
      retry({ delay: 1000 }),
      catchError(() => EMPTY),
      takeUntil(this.destroy$)
    ).subscribe();
  }

  disconnect(): void {
    this.socket?.complete();
    this.socket = undefined;
    this.connectedSignal.set(false);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.disconnect();
  }

  private applyTick(tick: OddsTick): void {
    const odds = Number(tick.decimal_odds);
    const key = `${tick.match_id}:${tick.market_id}:${tick.selection_id}`;
    this.marketsSignal.update((current) => {
      const previous = current[key];
      const direction = previous ? (odds > previous.odds ? 'up' : odds < previous.odds ? 'down' : 'flat') : 'flat';
      return {
        ...current,
        [key]: {
          key,
          matchId: tick.match_id,
          marketId: tick.market_id,
          selectionId: tick.selection_id,
          sequence: tick.sequence,
          timestampMs: tick.timestamp_ms,
          odds,
          previousOdds: previous?.odds,
          direction,
          updatedAt: Date.now()
        }
      };
    });
  }
}
