import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';

import { AuthService } from '../../services/auth.service';
import { ThemeService } from '../../services/theme.service';
import { AuthModalService } from '../../services/auth-modal.service';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  template: `
    <header class="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur-md transition-colors dark:border-slate-800 dark:bg-slate-900/90">
      <div class="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        
        <!-- Brand & Main Nav Links -->
        <div class="flex items-center gap-8">
          <a routerLink="/" class="flex items-center gap-2.5 group">
            <div class="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500 font-bold text-white shadow-md shadow-emerald-500/20 transition group-hover:scale-105">
              <span class="font-mono text-base font-black">Δ</span>
            </div>
            <div class="flex flex-col">
              <span class="text-base font-black tracking-tight text-slate-900 dark:text-white">Apex<span class="text-emerald-500">Bets</span></span>
              <span class="text-[9px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">Institutional STP</span>
            </div>
          </a>

          <!-- Public Nav items -->
          <nav class="hidden md:flex items-center gap-1 text-sm font-semibold">
            <a
              routerLink="/"
              routerLinkActive="text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40"
              [routerLinkActiveOptions]="{ exact: true }"
              class="rounded-lg px-3 py-1.5 text-slate-600 transition hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
            >
              Sportsbook
            </a>
            <a
              routerLink="/"
              fragment="live-markets"
              class="rounded-lg px-3 py-1.5 text-slate-600 transition hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
            >
              Live In-Play
            </a>
          </nav>
        </div>

        <!-- Right Side: Metrics Link, Theme Toggle & Authentication -->
        <div class="flex items-center gap-2.5 sm:gap-3">
          <!-- Discreet Metrics Quick Link -->
          <a
            routerLink="/metrics"
            routerLinkActive="bg-slate-200 dark:bg-slate-800"
            class="hidden sm:inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-100 px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-900 dark:border-slate-800 dark:bg-slate-800/80 dark:text-slate-400 dark:hover:text-white"
            title="System & Engine Telemetry"
          >
            <span class="relative flex h-2 w-2">
              <span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
              <span class="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
            </span>
            <span>Telemetry</span>
          </a>

          <!-- Dark / Light Mode Toggle Button -->
          <button
            type="button"
            (click)="theme.toggleTheme()"
            aria-label="Toggle visual theme"
            class="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-slate-100 text-slate-600 transition hover:border-slate-300 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:text-white"
          >
            <!-- Sun icon when dark -->
            @if (theme.isDarkMode()) {
              <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            } @else {
              <!-- Moon icon when light -->
              <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            }
          </button>

          <!-- Auth Status / Actions -->
          @if (auth.isAuthenticated()) {
            <div class="flex items-center gap-2">
              <div class="hidden sm:flex flex-col text-right">
                <span class="text-xs font-bold text-slate-900 dark:text-white">{{ 'Trader' }}</span>
                <span class="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 font-semibold">$2,450.00 Balance</span>
              </div>
              <button
                type="button"
                (click)="auth.logoutLocal()"
                class="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                Sign Out
              </button>
            </div>
          } @else {
            <div class="flex items-center gap-2">
              <button
                type="button"
                (click)="authModal.open('login')"
                class="rounded-xl px-3 py-1.5 text-xs font-bold text-slate-700 transition hover:text-slate-900 dark:text-slate-200 dark:hover:text-white"
              >
                Sign In
              </button>
              <button
                type="button"
                (click)="authModal.open('register')"
                class="rounded-xl bg-emerald-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-sm shadow-emerald-600/30 transition hover:bg-emerald-500 active:scale-95"
              >
                Register
              </button>
            </div>
          }

        </div>
      </div>
    </header>
  `
})
export class NavbarComponent {
  constructor(
    readonly auth: AuthService,
    readonly theme: ThemeService,
    readonly authModal: AuthModalService
  ) {}
}
