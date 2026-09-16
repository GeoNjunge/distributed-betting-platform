import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-dashboard-page',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <section class="mx-auto mt-16 max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900">
      <h1 class="text-2xl font-extrabold text-slate-900 dark:text-white">Dashboard</h1>
      <p class="mt-2 text-sm text-slate-600 dark:text-slate-300">
        You are signed in. Session token is stored locally for API calls and the ingress HttpOnly cookie is set for bet submission.
      </p>
      <div class="mt-6 flex gap-3">
        <a routerLink="/" class="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-500">Back to markets</a>
        <button
          type="button"
          (click)="logout()"
          class="rounded-xl border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 dark:border-slate-700 dark:text-slate-200"
        >
          Sign out
        </button>
      </div>
    </section>
  `
})
export class DashboardPageComponent {
  constructor(private readonly auth: AuthService) {}

  logout(): void {
    this.auth.logoutLocal();
  }
}
