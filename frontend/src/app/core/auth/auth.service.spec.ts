import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { AuthService } from './auth.service';
import { API_CONFIG } from '../config/api-config.token';
import { authInterceptor } from '../interceptors/auth.interceptor';

describe('AuthService', () => {
  let service: AuthService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: API_CONFIG, useValue: { apiBase: '/api' } },
      ],
    });
    service = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    service.clearSession();
  });

  it('logs in and loads profile via httpOnly cookies', () => {
    service.login({ email: 'user@example.com', password: 'Secret123' }).subscribe((user) => {
      expect(user.email).toBe('user@example.com');
      expect(service.isAuthenticated()).toBe(true);
    });

    const login = http.expectOne('/api/auth/login');
    expect(login.request.withCredentials).toBe(true);
    login.flush({ token_type: 'bearer', expires_in: 900 });

    const me = http.expectOne('/api/auth/me');
    expect(me.request.withCredentials).toBe(true);
    expect(me.request.headers.has('Authorization')).toBe(false);
    me.flush({
      id: '11111111-1111-1111-1111-111111111111',
      email: 'user@example.com',
      first_name: 'Иван',
      last_name: 'Петров',
      position: 'Управляющий',
      created_at: '2026-01-01T00:00:00Z',
    });
  });

  it('registers with 201 and loads profile', () => {
    service
      .register({
        email: 'new@example.com',
        password: 'Secret123',
        first_name: 'Новый',
        last_name: 'Пользователь',
        position: 'Управляющий',
        invite_key: 'test-invite-key-value',
      })
      .subscribe((user) => {
        expect(user.email).toBe('new@example.com');
        expect(service.isAuthenticated()).toBe(true);
      });

    const register = http.expectOne('/api/auth/register');
    expect(register.request.withCredentials).toBe(true);
    register.flush({ token_type: 'bearer', expires_in: 900 }, { status: 201, statusText: 'Created' });

    const me = http.expectOne('/api/auth/me');
    expect(me.request.withCredentials).toBe(true);
    me.flush({
      id: '22222222-2222-2222-2222-222222222222',
      email: 'new@example.com',
      first_name: 'Новый',
      last_name: 'Пользователь',
      position: 'Управляющий',
      created_at: '2026-01-01T00:00:00Z',
    });
  });

  it('clears session on logout', () => {
    service.login({ email: 'user@example.com', password: 'Secret123' }).subscribe();
    http.expectOne('/api/auth/login').flush({ token_type: 'bearer', expires_in: 900 });
    http.expectOne('/api/auth/me').flush({
      id: '11111111-1111-1111-1111-111111111111',
      email: 'user@example.com',
      first_name: 'Иван',
      last_name: 'Петров',
      position: 'Управляющий',
      created_at: '2026-01-01T00:00:00Z',
    });

    service.logout().subscribe();
    const logout = http.expectOne('/api/auth/logout');
    expect(logout.request.withCredentials).toBe(true);
    logout.flush(null, { status: 204, statusText: 'No Content' });
    expect(service.isAuthenticated()).toBe(false);
  });

  it('clears session when refresh returns 401', () => {
    service.login({ email: 'user@example.com', password: 'Secret123' }).subscribe();
    http.expectOne('/api/auth/login').flush({ token_type: 'bearer', expires_in: 900 });
    http.expectOne('/api/auth/me').flush({
      id: '11111111-1111-1111-1111-111111111111',
      email: 'user@example.com',
      first_name: 'Иван',
      last_name: 'Петров',
      position: 'Управляющий',
      created_at: '2026-01-01T00:00:00Z',
    });
    expect(service.isAuthenticated()).toBe(true);

    service.refreshAccessToken().subscribe({
      error: () => undefined,
    });
    const refresh = http.expectOne('/api/auth/refresh');
    refresh.flush('Invalid refresh token', { status: 401, statusText: 'Unauthorized' });
    expect(service.isAuthenticated()).toBe(false);
  });

  it('bootstrap returns false without session when refresh fails', () => {
    let bootstrapped = false;
    service.bootstrapSession().subscribe((ok) => {
      bootstrapped = ok;
    });
    const refresh = http.expectOne('/api/auth/refresh');
    refresh.flush('Invalid refresh token', { status: 401, statusText: 'Unauthorized' });
    expect(bootstrapped).toBe(false);
    expect(service.isAuthenticated()).toBe(false);
  });
});
