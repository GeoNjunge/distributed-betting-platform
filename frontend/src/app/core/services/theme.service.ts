import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly STORAGE_KEY = 'app_theme';
  readonly isDarkMode = signal<boolean>(false);

  constructor() {
    this.initTheme();
  }

  toggleTheme(): void {
    this.setTheme(!this.isDarkMode());
  }

  setTheme(isDark: boolean): void {
    this.isDarkMode.set(isDark);
    if (typeof document !== 'undefined') {
      if (isDark) {
        document.documentElement.classList.add('dark');
        localStorage.setItem(this.STORAGE_KEY, 'dark');
      } else {
        document.documentElement.classList.remove('dark');
        localStorage.setItem(this.STORAGE_KEY, 'light');
      }
    }
  }

  private initTheme(): void {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
      return;
    }

    const savedTheme = localStorage.getItem(this.STORAGE_KEY);
    if (savedTheme === 'dark') {
      this.setTheme(true);
    } else if (savedTheme === 'light') {
      this.setTheme(false);
    } else {
      // Default to clean light mode as specified in the architectural requirements
      this.setTheme(false);
    }
  }
}
