import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';

import { NavbarComponent } from './core/components/navbar/navbar.component';
import { FooterComponent } from './core/components/footer/footer.component';
import { AuthModalComponent } from './features/auth/auth-modal.component';
import { ThemeService } from './core/services/theme.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    NavbarComponent,
    FooterComponent,
    AuthModalComponent
  ],
  template: `
    <div class="flex min-h-screen flex-col bg-slate-50 text-slate-800 transition-colors duration-150 dark:bg-slate-950 dark:text-slate-100">
      <!-- Universal Consumer Navbar -->
      <app-navbar></app-navbar>

      <!-- Main Routed Viewport (/ or /metrics) -->
      <div class="flex-1">
        <router-outlet></router-outlet>
      </div>

      <!-- Consumer Footer with Responsible Gaming & Discreet Telemetry Link -->
      <app-footer></app-footer>

      <!-- Global Authentication Dialog -->
      <app-auth-modal></app-auth-modal>
    </div>
  `
})
export class AppComponent {
  constructor(readonly theme: ThemeService) {}
}
