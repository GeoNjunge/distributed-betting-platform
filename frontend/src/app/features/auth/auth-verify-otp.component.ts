import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-auth-verify-otp',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="mx-auto mt-16 max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900">
      <h1 class="text-xl font-extrabold text-slate-900 dark:text-white">Verify SMS Code</h1>
      <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">
        Enter the 6-digit code sent to <span class="font-mono font-bold">{{ phone }}</span>
      </p>

      <form class="mt-5 space-y-4" (ngSubmit)="submit()">
        <label class="block text-xs font-bold text-slate-700 dark:text-slate-300">
          OTP Code
          <input
            class="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-center text-lg tracking-[0.4em] font-mono dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            type="text"
            inputmode="numeric"
            pattern="[0-9]*"
            maxlength="6"
            name="otp"
            [(ngModel)]="otp"
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
          [disabled]="loading() || otp.length !== 6"
          class="w-full rounded-xl bg-emerald-600 py-2.5 text-sm font-bold text-white hover:bg-emerald-500 disabled:opacity-50"
        >
          {{ loading() ? 'Verifying…' : 'Verify & Continue' }}
        </button>
      </form>
    </section>
  `
})
export class AuthVerifyOtpComponent implements OnInit {
  phone = '';
  otp = '';
  readonly loading = signal(false);
  readonly errorMessage = signal<string | null>(null);

  constructor(
    private readonly auth: AuthService,
    private readonly route: ActivatedRoute,
    private readonly router: Router
  ) {}

  ngOnInit(): void {
    this.phone = this.route.snapshot.queryParamMap.get('phone') ?? '';
  }

  submit(): void {
    if (!this.phone) {
      this.errorMessage.set('Missing phone number. Start from registration.');
      return;
    }
    this.loading.set(true);
    this.errorMessage.set(null);
    this.auth.verifyOtp({ phone: this.phone, otp: this.otp }).subscribe({
      next: () => {
        this.loading.set(false);
        void this.router.navigate(['/dashboard']);
      },
      error: (err) => {
        this.loading.set(false);
        const detail = err?.error?.detail;
        this.errorMessage.set(typeof detail === 'string' ? detail : 'OTP verification failed');
      }
    });
  }
}
