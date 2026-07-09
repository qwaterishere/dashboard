/** Контракты auth API — POST/GET /api/auth/*. */

export interface TokenResponse {
  access_token: string;
  token_type: 'bearer';
  expires_in: number;
}

export interface UserPublic {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  position: string;
  created_at: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest extends LoginRequest {
  first_name: string;
  last_name: string;
  position: string;
}
