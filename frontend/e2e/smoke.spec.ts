import { expect, test } from './fixtures';

const ROUTES = [
  { path: '/dashboard', heading: 'Дашборд', panel: 'Выручка по дням' },
  { path: '/sales', heading: 'Продажи', panel: 'Структура продаж' },
  { path: '/warehouse', heading: 'Склад', panel: 'Общие товарные запасы' },
  { path: '/foodcost', heading: 'Фудкост', panel: 'Чистый фудкост' },
] as const;

test.describe('smoke', () => {
  for (const route of ROUTES) {
    test(`${route.path} loads without error`, async ({ page }) => {
      await page.goto(route.path);
      await expect(page.getByRole('link', { name: new RegExp(route.heading) })).toHaveClass(/on/);
      await expect(page.getByText(route.panel)).toBeVisible();
      await expect(page.getByText('Не удалось загрузить')).toHaveCount(0);
    });
  }

  test('sidebar navigates between dashboard and sales', async ({ page }) => {
    await page.goto('/dashboard');
    await page.getByRole('link', { name: 'Продажи', exact: true }).click();
    await expect(page).toHaveURL(/\/sales$/);
    await page.getByRole('link', { name: 'Дашборд', exact: true }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
  });

  test('period bar reflects dashboard API period', async ({ page }) => {
    await page.goto('/dashboard');
    const periodBar = page.locator('app-period-bar');
    await expect(periodBar).not.toContainText('загрузка', { timeout: 15_000 });
    await expect(periodBar).not.toContainText('Июнь 2026');
    await expect(periodBar.locator('.date-pill')).toBeVisible();
  });

  test('unknown route redirects to dashboard', async ({ page }) => {
    await page.goto('/does-not-exist');
    await expect(page).toHaveURL(/\/dashboard$/);
  });

  test('purchases placeholder renders', async ({ page }) => {
    await page.goto('/purchases');
    await expect(page.getByText('Модуль закупок появится')).toBeVisible();
  });

  test('settings page loads profile sections', async ({ page }) => {
    await page.goto('/settings');
    await expect(page.locator('app-page-greeting')).toContainText('Настройки');
    await expect(page.getByRole('heading', { name: 'Профиль' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Смена пароля' })).toBeVisible();
    await expect(page.locator('app-period-bar')).toHaveCount(0);
  });

  test('sales page shows title and period bar', async ({ page }) => {
    await page.goto('/sales');
    await expect(page.locator('app-page-greeting')).toContainText('Продажи');
    await expect(page.locator('app-period-bar')).toHaveCount(1);
  });
});
