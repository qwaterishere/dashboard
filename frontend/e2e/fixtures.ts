import { expect, test as base } from '@playwright/test';
import type { Page } from '@playwright/test';

import { E2E_USER } from './auth.constants';

/** Логин через API на origin приложения (httpOnly cookies в контексте page). */
export async function ensureE2eUserSession(page: Page): Promise<void> {
  const response = await page.request.post('/api/auth/login', {
    data: { email: E2E_USER.email, password: E2E_USER.password },
  });

  expect(
    response.ok(),
    `E2E login failed (${response.status()}): ${await response.text()}. ` +
      'Пользователь должен быть создан seed_e2e.py (npm run e2e → e2e-backend.sh).',
  ).toBeTruthy();
}

export const test = base.extend({
  page: async ({ page }, use) => {
    await ensureE2eUserSession(page);
    await use(page);
  },
});

export { expect };
