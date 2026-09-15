import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { AuthService } from '../../core/services/auth.service';
import { AuthModalService } from '../../core/services/auth-modal.service';

@Component({
  selector: 'app-auth-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    @if (modal.isOpen()) {
      <!-- Backdrop -->
      <div
        class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in"
        (click)="onBackdropClick($event)"
      >
        <!-- Modal Card -->
        <div
          class="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl transition-all dark:border-slate-800 dark:bg-slate-900"
          (click)="$event.stopPropagation()"
        >
          <!-- Close Button -->
          <button
            type="button"
            (click)="modal.close()"
            class="absolute right-4 top-4 rounded-xl p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            aria-label="Close"
          >
            <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          <!-- Header & Mode Tabs -->
          <div class="mb-5 text-center">
            <div class="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500 font-mono text-xl font-black text-white shadow-lg shadow-emerald-500/20">
              Δ
            </div>
            <h2 class="text-xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              {{ modal.mode() === 'login' ? 'Welcome Back' : 'Create an Account' }}
            </h2>
            <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {{ modal.mode() === 'login' ? 'Sign in to access your wallet and submit bets' : 'Register to unlock institutional STP execution' }}
            </p>

            <div class="mt-4 flex rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
              <button
                type="button"
                (click)="modal.setMode('login')"
                [ngClass]="modal.mode() === 'login' ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white' : 'text-slate-600 dark:text-slate-400'"
                class="flex-1 rounded-lg py-2 text-xs font-bold transition"
              >
                Sign In
              </button>
              <button
                type="button"
                (click)="modal.setMode('register')"
                [ngClass]="modal.mode() === 'register' ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white' : 'text-slate-600 dark:text-slate-400'"
                class="flex-1 rounded-lg py-2 text-xs font-bold transition"
              >
                Create Account
              </button>
            </div>
          </div>

          <!-- Alert / Error message -->
          @if (errorMessage()) {
            <div class="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300">
              {{ errorMessage() }}
            </div>
          }

          <!-- Form -->
          <form (ngSubmit)="onSubmit()" class="space-y-4">
            <div>
              <label class="block text-xs font-bold text-slate-700 dark:text-slate-300">
                Email Address
              </label>
              <input
                type="email"
                [(ngModel)]="email"
                name="email"
                placeholder="trader@domain.com"
                required
                class="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              />
            </div>

            <div>
              <label class="block text-xs font-bold text-slate-700 dark:text-slate-300">
                Password
              </label>
              <input
                type="password"
                [(ngModel)]="password"
                name="password"
                placeholder="••••••••••••"
                required
                minlength="6"
                class="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              />
            </div>

            <button
              type="submit"
              [disabled]="loading() || !email || !password"
              class="w-full rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white shadow-md shadow-emerald-600/30 transition hover:bg-emerald-500 active:scale-98 disabled:cursor-not-allowed disabled:opacity-50"
            >
              @if (loading()) {
                <span class="inline-flex items-center gap-2">
                  <svg class="h-4 w-4 animate-spin" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                  </svg>
                  Processing...
                </span>
              } @else {
                {{ modal.mode() === 'login' ? 'Sign In to Sportsbook' : 'Complete Registration' }}
              }
            </button>
          </form>

          <p class="mt-4 text-center text-[11px] text-slate-500 dark:text-slate-400">
            By signing in, you confirm you are 18+ and accept platform terms.
          </p>
        </div>
      </div>
    }
  `
})
export class AuthModalComponent {
  email = '';
  password = '';
  readonly loading = signal(false);
  readonly errorMessage = signal<string | null>(null);

  constructor(
    readonly auth: AuthService,
    readonly modal: AuthModalService
  ) {}

  onBackdropClick(event: MouseEvent): void {
    this.modal.close();
  }

  onSubmit(): void {
    if (!this.email || !this.password) return;

    this.loading.set(true);
    this.errorMessage.set(null);

    const action$ = this.modal.mode() === 'login'
      ? this.auth.login(this.email, this.password)
      : this.auth.register(this.email, this.password);

    action$.subscribe({
      next: () => {
        this.loading.set(false);
        this.modal.close();
        this.email = '';
        this.password = '';
      },
      error: (err) => {
        this.loading.set(false);
        this.errorMessage.set(err?.error?.detail || err?.message || 'Authentication request failed. Please check your credentials.');
      }
    });
  }
}
