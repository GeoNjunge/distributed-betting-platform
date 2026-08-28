export interface AuthRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  user_id: string;
  email: string;
  token_type: 'bearer';
}

export interface SessionState {
  authenticated: boolean;
  userId?: string;
  email?: string;
}
