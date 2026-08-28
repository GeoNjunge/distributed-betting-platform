import { HttpClient } from '@angular/common/http';
import { Injectable, computed, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';

import { environment } from '../../../environments/environment';
import { AuthRequest, AuthResponse, SessionState } from '../models/auth.model';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly sessionSignal = signal<SessionState>({ authenticated: false });
  readonly session = this.sessionSignal.asReadonly();
  readonly isAuthenticated = computed(() => this.sessionSignal().authenticated);

  constructor(private readonly http: HttpClient) {}

  register(email: string, password: string): Observable<AuthResponse> {
    return this.authenticate('/register', { email, password });
  }

  login(email: string, password: string): Observable<AuthResponse> {
    return this.authenticate('/login', { email, password });
  }

  logoutLocal(): void {
    this.sessionSignal.set({ authenticated: false });
  }

  private authenticate(path: '/register' | '/login', payload: AuthRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${environment.ingressApiUrl}${path}`, payload, { withCredentials: true }).pipe(
      tap((response) => {
        this.sessionSignal.set({
          authenticated: true,
          userId: response.user_id,
          email: response.email
        });
      })
    );
  }
}
