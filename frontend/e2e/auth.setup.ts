import { expect, test as setup } from '@playwright/test';

import { API_BASE, E2E_USER } from './auth.constants';

/** Гарантирует наличие e2e-пользователя в БД до прогона browser-тестов. */
setup('ensure e2e user exists', async ({ request }) => {
  const register = await request.post(`${API_BASE}/api/auth/register`, { data: E2E_USER });
  if (register.status() === 409) {
    const login = await request.post(`${API_BASE}/api/auth/login`, {
      data: { email: E2E_USER.email, password: E2E_USER.password },
    });
    expect(
      login.ok(),
      `E2E login failed (${login.status()}): ${await login.text()}`,
    ).toBeTruthy();
    return;
  }
  expect(
    register.ok(),
    `E2E register failed (${register.status()}): ${await register.text()}`,
  ).toBeTruthy();
});
