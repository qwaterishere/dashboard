import { computed, signal } from '@angular/core';
import { of } from 'rxjs';

import type { UserPublic } from '../../shared/models/auth.model';
import { AuthService } from './auth.service';

export const MOCK_AUTH_USER: UserPublic = {
  id: '11111111-1111-1111-1111-111111111111',
  email: 'test@example.com',
  first_name: 'Артём',
  last_name: 'Ким',
  position: 'Управляющий',
  created_at: '2026-01-01T00:00:00Z',
};

export function provideMockAuthenticatedAuth() {
  const user = signal<UserPublic | null>(MOCK_AUTH_USER);
  return {
    provide: AuthService,
    useValue: {
      user,
      isAuthenticated: computed(() => user() !== null),
      getAccessToken: () => 'test-token',
      canAttemptSilentRefresh: () => true,
      initials: () => 'АК',
      displayName: () => 'Артём Ким',
      bootstrapSession: () => of(true),
      handleUnauthorizedRedirect: () => undefined,
      logoutAndRedirect: () => undefined,
      clearSession: () => user.set(null),
    } satisfies Partial<AuthService>,
  };
}
