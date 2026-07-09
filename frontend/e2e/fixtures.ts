import { expect, test as base } from '@playwright/test';
import type { Page } from '@playwright/test';

import { E2E_USER } from './auth.constants';

/** Логин через API на origin приложения (cookie попадает в контекст page). */
export async function ensureE2eUserSession(page: Page): Promise<string> {
  let response = await page.request.post('/api/auth/login', {
    data: { email: E2E_USER.email, password: E2E_USER.password },
  });

  if (!response.ok()) {
    const register = await page.request.post('/api/auth/register', { data: E2E_USER });
    if (register.status() === 409) {
      response = await page.request.post('/api/auth/login', {
        data: { email: E2E_USER.email, password: E2E_USER.password },
      });
    } else {
      response = register;
    }
  }

  expect(
    response.ok(),
    `E2E auth failed (${response.status()}): ${await response.text()}`,
  ).toBeTruthy();
  const body = (await response.json()) as { access_token: string };
  return body.access_token;
}

export const test = base.extend({
  page: async ({ page }, use) => {
    await ensureE2eUserSession(page);
    await use(page);
  },
});

export { expect };
