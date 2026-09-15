import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <footer class="mt-auto border-t border-slate-200 bg-white py-8 transition-colors dark:border-slate-800 dark:bg-slate-900">
      <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div class="flex flex-col items-center justify-between gap-4 md:flex-row">
          
          <!-- Brand & Responsible Gambling Notice -->
          <div class="flex flex-col items-center gap-1.5 md:items-start text-center md:text-left">
            <div class="flex items-center gap-2">
              <span class="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-black text-slate-700 dark:bg-slate-800 dark:text-slate-300">18+</span>
              <span class="text-xs font-semibold text-slate-600 dark:text-slate-400">Please Gamble Responsibly &bull; BeGambleAware.org</span>
            </div>
            <p class="text-xs text-slate-600 dark:text-slate-400">
              Institutional-grade Straight-Through Processing (STP) sports wagering platform.
            </p>
          </div>

          <!-- Secondary / Discreet Engineering & Diagnostics Link -->
          <div class="flex items-center gap-4 text-xs font-medium text-slate-600 dark:text-slate-400">
            <a
              routerLink="/metrics"
              class="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 transition hover:border-slate-300 hover:text-slate-900 dark:border-slate-800 dark:bg-slate-950 dark:hover:text-white"
            >
              <svg class="h-3.5 w-3.5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <span>System Telemetry & Metrics</span>
            </a>
          </div>

        </div>

        <div class="mt-6 border-t border-slate-100 pt-4 text-center text-[11px] text-slate-500 dark:border-slate-800/80 dark:text-slate-400">
          &copy; {{ currentYear }} ApexBets Distributed Platform. All rights reserved.
        </div>
      </div>
    </footer>
  `
})
export class FooterComponent {
  readonly currentYear = new Date().getFullYear();
}
