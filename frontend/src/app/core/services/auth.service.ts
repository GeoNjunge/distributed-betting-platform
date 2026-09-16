import { HttpClient } from '@angular/common/http';
import { Injectable, computed, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';

import { environment } from '../../../environments/environment';
import {
  ACCESS_TOKEN_STORAGE_KEY,
  REFRESH_TOKEN_STORAGE_KEY,
  RegisterPendingResponse,
  SessionState,
  TokenResponse,
  UserLoginRequest,
  UserRegisterRequest,
  VerifyOTPRequest
} from '../models/auth.model';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly sessionSignal = signal<SessionState>({ authenticated: false });
  readonly session = this.sessionSignal.asReadonly();
  readonly isAuthenticated = computed(() => this.sessionSignal().authenticated);

  constructor(private readonly http: HttpClient) {
    const accessToken = localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY);
    if (accessToken) {
      this.sessionSignal.set({
        authenticated: true,
        accessToken,
        refreshToken: localStorage.getItem(REFRESH_TOKEN_STORAGE_KEY) ?? undefined
      });
    }
  }

  register(payload: UserRegisterRequest): Observable<RegisterPendingResponse> {
    return this.http.post<RegisterPendingResponse>(`${environment.ingressApiUrl}/auth/register`, payload, {
      withCredentials: true
    });
  }

  verifyOtp(payload: VerifyOTPRequest): Observable<TokenResponse> {
    return this.http
      .post<TokenResponse>(`${environment.ingressApiUrl}/auth/verify-otp`, payload, { withCredentials: true })
      .pipe(tap((response) => this.persistSession(response)));
  }

  login(payload: UserLoginRequest): Observable<TokenResponse> {
    return this.http
      .post<TokenResponse>(`${environment.ingressApiUrl}/auth/login`, payload, { withCredentials: true })
      .pipe(tap((response) => this.persistSession(response)));
  }

  logoutLocal(): void {
    localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
    localStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY);
    this.sessionSignal.set({ authenticated: false });
  }

  private persistSession(response: TokenResponse): void {
    localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, response.access_token);
    localStorage.setItem(REFRESH_TOKEN_STORAGE_KEY, response.refresh_token);
    this.sessionSignal.set({
      authenticated: true,
      accessToken: response.access_token,
      refreshToken: response.refresh_token
    });
  }
}
