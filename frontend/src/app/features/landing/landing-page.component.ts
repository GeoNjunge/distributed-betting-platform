import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

import { HeroFeaturedComponent } from './hero-featured.component';
import { MarketDisplayComponent } from '../markets/market-display.component';
import { BetSlipComponent } from '../bet-slip/bet-slip.component';

@Component({
  selector: 'app-landing-page',
  standalone: true,
  imports: [
    CommonModule,
    HeroFeaturedComponent,
    MarketDisplayComponent,
    BetSlipComponent
  ],
  template: `
    <div class="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      
      <!-- Responsive Sportsbook Layout: Main Feed (Left) & Sticky Bet Slip (Right) -->
      <div class="grid grid-cols-1 gap-8 lg:grid-cols-12">
        
        <!-- Main Sports Content Area (8 Columns on Large Screens) -->
        <main class="space-y-6 lg:col-span-8">
          <!-- Hero Section: Minimal content with 2-3 highlighted odds cards -->
          <app-hero-featured></app-hero-featured>

          <!-- Categorized Real-Time Markets -->
          <app-market-display></app-market-display>
        </main>

        <!-- Right Rail: Dedicated Bet Slip Drawer (4 Columns on Large Screens) -->
        <div class="lg:col-span-4">
          <app-bet-slip (viewTrace)="onTraceRequested($event)"></app-bet-slip>
        </div>

      </div>

    </div>
  `
})
export class LandingPageComponent {
  constructor(private readonly router: Router) {}

  onTraceRequested(traceId: string): void {
    this.router.navigate(['/metrics'], { queryParams: { traceId } });
  }
}
