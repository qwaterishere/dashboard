import { ensureE2eUserSession, expect, test } from './fixtures';

test.describe('security', () => {
  test('API responses include security headers', async ({ page }) => {
    await ensureE2eUserSession(page);
    const response = await page.request.get('/api/dashboard');
    expect(response.ok()).toBeTruthy();
    const headers = response.headers();
    expect(headers['x-content-type-options']).toBe('nosniff');
    expect(headers['x-frame-options']).toBe('DENY');
    expect(headers['content-security-policy']).toContain("default-src 'self'");
  });

  test('health endpoint is reachable', async ({ page }) => {
    const response = await page.request.get('/health');
    expect(response.ok()).toBeTruthy();
    await expect(response.json()).resolves.toEqual({ status: 'ok' });
  });

  test('malicious API strings render as plain text on foodcost', async ({ page }) => {
    const payload = '<script>alert(1)</script>';

    await page.route('**/api/foodcost', async (route) => {
      const response = await route.fetch();
      const json = await response.json();
      json.overview.clean.title = payload;
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(json) });
    });

    await page.goto('/foodcost');
    await expect(page.getByText(payload)).toBeVisible();
    expect(await page.evaluate(() => (window as unknown as { __xss?: boolean }).__xss)).toBeFalsy();
  });

  test('API failure shows generic load error without stack trace', async ({ page }) => {
    const logs: string[] = [];
    page.on('console', (msg) => logs.push(msg.text()));

    await page.route('**/api/sales', (route) => route.abort());
    await page.goto('/sales');
    await expect(page.getByText('Не удалось загрузить данные продаж')).toBeVisible();
    expect(logs.join('')).not.toMatch(/stack|trace|internal/i);
  });
});
