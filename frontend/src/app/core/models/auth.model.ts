export interface UserRegisterRequest {
  email: string;
  phone: string;
  password: string;
  username?: string;
}

export interface VerifyOTPRequest {
  phone: string;
  otp: string;
}

export interface UserLoginRequest {
  phone: string;
  password: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: 'bearer';
}

export interface RegisterPendingResponse {
  message: string;
  phone: string;
}

export interface SessionState {
  authenticated: boolean;
  userId?: string;
  accessToken?: string;
  refreshToken?: string;
}

export const ACCESS_TOKEN_STORAGE_KEY = 'apex_access_token';
export const REFRESH_TOKEN_STORAGE_KEY = 'apex_refresh_token';
