import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { AuthService } from '../../core/services/auth.service';
import { AuthModalService } from '../../core/services/auth-modal.service';

@Component({
  selector: 'app-auth-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    @if (modal.isOpen()) {
      <div
        class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in"
        (click)="onBackdropClick($event)"
      >
        <div
          class="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl transition-all dark:border-slate-800 dark:bg-slate-900"
          (click)="$event.stopPropagation()"
        >
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

          <div class="mb-5 text-center">
            <div class="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500 font-mono text-xl font-black text-white shadow-lg shadow-emerald-500/20">
              Δ
            </div>
            <h2 class="text-xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              {{ modal.mode() === 'login' ? 'Welcome Back' : 'Create an Account' }}
            </h2>
            <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Phone + password auth with SMS OTP verification for new accounts.
            </p>
          </div>

          @if (errorMessage()) {
            <div class="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300">
              {{ errorMessage() }}
            </div>
          }

          <form (ngSubmit)="onSubmit()" class="space-y-4">
            @if (modal.mode() === 'register') {
              <div>
                <label class="block text-xs font-bold text-slate-700 dark:text-slate-300">Email Address</label>
                <input
                  type="email"
                  [(ngModel)]="email"
                  name="email"
                  required
                  class="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                />
              </div>
            }

            <div>
              <label class="block text-xs font-bold text-slate-700 dark:text-slate-300">Phone (E.164)</label>
              <input
                type="tel"
                [(ngModel)]="phone"
                name="phone"
                placeholder="+254712345678"
                required
                class="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-mono dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              />
            </div>

            <div>
              <label class="block text-xs font-bold text-slate-700 dark:text-slate-300">Password</label>
              <input
                type="password"
                [(ngModel)]="password"
                name="password"
                required
                minlength="12"
                class="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              />
            </div>

            <button
              type="submit"
              [disabled]="loading()"
              class="w-full rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white shadow-md shadow-emerald-600/30 transition hover:bg-emerald-500 disabled:opacity-50"
            >
              {{ loading() ? 'Processing…' : modal.mode() === 'login' ? 'Sign In' : 'Register & Send OTP' }}
            </button>
          </form>
        </div>
      </div>
    }
  `
})
export class AuthModalComponent {
  email = '';
  phone = '+254';
  password = '';
  readonly loading = signal(false);
  readonly errorMessage = signal<string | null>(null);

  constructor(
    readonly auth: AuthService,
    readonly modal: AuthModalService,
    private readonly router: Router
  ) {}

  onBackdropClick(_event: MouseEvent): void {
    this.modal.close();
  }

  onSubmit(): void {
    if (!this.phone || !this.password) return;
    if (this.modal.mode() === 'register' && !this.email) return;

    this.loading.set(true);
    this.errorMessage.set(null);

    if (this.modal.mode() === 'login') {
      this.auth.login({ phone: this.phone, password: this.password }).subscribe({
        next: () => {
          this.loading.set(false);
          this.modal.close();
          void this.router.navigate(['/dashboard']);
        },
        error: (err) => {
          this.loading.set(false);
          this.errorMessage.set(err?.error?.detail ?? 'Login failed');
        }
      });
      return;
    }

    this.auth.register({ email: this.email, phone: this.phone, password: this.password }).subscribe({
      next: (response) => {
        this.loading.set(false);
        this.modal.close();
        void this.router.navigate(['/auth/verify-otp'], { queryParams: { phone: response.phone } });
      },
      error: (err) => {
        this.loading.set(false);
        this.errorMessage.set(err?.error?.detail ?? 'Registration failed');
      }
    });
  }
}
