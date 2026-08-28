import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule, NgIf } from '@angular/common';

import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-auth-panel',
  standalone: true,
  imports: [CommonModule, FormsModule, NgIf],
  template: `
    <section class="rounded-2xl border border-slate-800 bg-slate-900/90 p-5 shadow-2xl backdrop-blur-md">
      <div class="mb-4 flex items-center justify-between border-b border-slate-800 pb-3">
        <div>
          <span class="text-[10px] font-bold uppercase tracking-widest text-emerald-400">Security & Session</span>
          <h2 class="text-lg font-extrabold text-white">Account Access</h2>
        </div>
        <span
          class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider"
          [ngClass]="auth.isAuthenticated() ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-700/60' : 'bg-slate-800 text-slate-300 border border-slate-700'"
        >
          <span class="h-1.5 w-1.5 rounded-full" [ngClass]="auth.isAuthenticated() ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'"></span>
          {{ auth.isAuthenticated() ? 'Authenticated' : 'Guest' }}
        </span>
      </div>

      <form class="grid gap-3" (ngSubmit)="login()">
        <label class="grid gap-1 text-xs font-semibold text-slate-300">
          Email Address
          <input
            class="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-mono text-white outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20"
            name="email"
            type="email"
            [(ngModel)]="email"
            required
          />
        </label>
        <label class="grid gap-1 text-xs font-semibold text-slate-300">
          Password
          <input
            class="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-mono text-white outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20"
            name="password"
            type="password"
            [(ngModel)]="password"
            required
            minlength="12"
          />
        </label>
        <div class="grid grid-cols-2 gap-2 mt-1">
          <button
            class="rounded-xl border border-slate-700 bg-slate-800/80 px-3 py-2 text-xs font-bold text-slate-200 transition hover:bg-slate-700 hover:text-white active:scale-98"
            type="button"
            (click)="register()"
          >
            Register
          </button>
          <button
            class="rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 px-3 py-2 text-xs font-bold text-white shadow-md shadow-cyan-950/30 transition hover:from-cyan-500 hover:to-blue-500 active:scale-98"
            type="submit"
          >
            Sign In
          </button>
        </div>
      </form>

      <div *ngIf="message()" class="mt-3 rounded-xl bg-slate-950/80 p-2.5 text-xs text-cyan-300 font-mono border border-slate-800">
        {{ message() }}
      </div>
    </section>
  `
})
export class AuthPanelComponent {
  email = 'e2e-user@example.com';
  password = 'correct-horse-battery-staple';
  readonly message = signal('');

  constructor(readonly auth: AuthService) {}

  register(): void {
    this.auth.register(this.email, this.password).subscribe({
      next: (session) => this.message.set(`✓ Registered: ${session.email}`),
      error: (error) => this.message.set(`✕ ${error?.error?.detail ?? 'Registration failed'}`)
    });
  }

  login(): void {
    this.auth.login(this.email, this.password).subscribe({
      next: (session) => this.message.set(`✓ Logged in as: ${session.email}`),
      error: (error) => this.message.set(`✕ ${error?.error?.detail ?? 'Login failed'}`)
    });
  }
}
