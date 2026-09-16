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
    path: 'auth/register',
    loadComponent: () => import('./features/auth/auth-register.component').then(m => m.AuthRegisterComponent),
    title: 'Register'
  },
  {
    path: 'auth/verify-otp',
    loadComponent: () => import('./features/auth/auth-verify-otp.component').then(m => m.AuthVerifyOtpComponent),
    title: 'Verify OTP'
  },
  {
    path: 'auth/login',
    loadComponent: () => import('./features/auth/auth-login.component').then(m => m.AuthLoginComponent),
    title: 'Sign In'
  },
  {
    path: 'dashboard',
    loadComponent: () => import('./features/dashboard/dashboard-page.component').then(m => m.DashboardPageComponent),
    title: 'Dashboard'
  },
  {
    path: '**',
    redirectTo: ''
  }
];
