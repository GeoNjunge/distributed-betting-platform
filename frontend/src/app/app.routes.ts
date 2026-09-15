import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./features/landing/landing-page.component').then(m => m.LandingPageComponent),
    title: 'Live Sports Betting & Real-Time Odds | ApexBets'
  },
  {
    path: 'metrics',
    loadComponent: () => import('./features/metrics/metrics-page.component').then(m => m.MetricsPageComponent),
    title: 'Platform Telemetry & Engine Diagnostics'
  },
  {
    path: '**',
    redirectTo: ''
  }
];
