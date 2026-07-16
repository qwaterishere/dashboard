import { expect, test as setup } from '@playwright/test';

import { API_BASE, E2E_USER } from './auth.constants';

/**
 * Пользователь создаётся в `scripts/e2e-backend.sh` → `seed_e2e.py` (с invite).
 * Setup только проверяет, что логин работает.
 */
setup('ensure e2e user exists', async ({ request }) => {
  const login = await request.post(`${API_BASE}/api/auth/login`, {
    data: { email: E2E_USER.email, password: E2E_USER.password },
  });
  expect(
    login.ok(),
    `E2E login failed (${login.status()}): ${await login.text()}. ` +
      'Запускайте e2e через `npm run e2e` (поднимает e2e-backend.sh + seed), ' +
      'а не против обычного dashboard.db без пользователя e2e@example.com.',
  ).toBeTruthy();
});
