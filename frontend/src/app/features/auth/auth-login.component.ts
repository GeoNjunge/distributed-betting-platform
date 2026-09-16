import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-auth-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <section class="mx-auto mt-16 max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900">
      <h1 class="text-xl font-extrabold text-slate-900 dark:text-white">Sign In</h1>
      <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">Use your phone number and password.</p>

      <form class="mt-5 space-y-4" (ngSubmit)="submit()">
        <label class="block text-xs font-bold text-slate-700 dark:text-slate-300">
          Phone (E.164)
          <input
            class="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-mono dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            type="tel"
            name="phone"
            [(ngModel)]="phone"
            required
          />
        </label>
        <label class="block text-xs font-bold text-slate-700 dark:text-slate-300">
          Password
          <input
            class="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            type="password"
            name="password"
            [(ngModel)]="password"
            required
          />
        </label>

        @if (errorMessage()) {
          <p class="rounded-xl border border-rose-200 bg-rose-50 p-2 text-xs text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300">
            {{ errorMessage() }}
          </p>
        }

        <button
          type="submit"
          [disabled]="loading()"
          class="w-full rounded-xl bg-emerald-600 py-2.5 text-sm font-bold text-white hover:bg-emerald-500 disabled:opacity-50"
        >
          {{ loading() ? 'Signing in…' : 'Sign In' }}
        </button>
      </form>

      <p class="mt-4 text-center text-xs text-slate-500">
        New here?
        <a routerLink="/auth/register" class="font-bold text-emerald-600 hover:underline">Create an account</a>
      </p>
    </section>
  `
})
export class AuthLoginComponent {
  phone = '+254';
  password = '';
  readonly loading = signal(false);
  readonly errorMessage = signal<string | null>(null);

  constructor(
    private readonly auth: AuthService,
    private readonly router: Router
  ) {}

  submit(): void {
    this.loading.set(true);
    this.errorMessage.set(null);
    this.auth.login({ phone: this.phone, password: this.password }).subscribe({
      next: () => {
        this.loading.set(false);
        void this.router.navigate(['/dashboard']);
      },
      error: (err) => {
        this.loading.set(false);
        this.errorMessage.set(err?.error?.detail ?? 'Login failed');
      }
    });
  }
}
