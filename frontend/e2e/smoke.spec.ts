import { expect, test } from './fixtures';
import type { Page } from '@playwright/test';

const MONTHS_SHORT = [
  'янв',
  'фев',
  'мар',
  'апр',
  'май',
  'июн',
  'июл',
  'авг',
  'сен',
  'окт',
  'ноя',
  'дек',
] as const;

const ROUTES = [
  { path: '/dashboard', heading: 'Дашборд', panel: 'Выручка по дням', api: 'dashboard' },
  { path: '/sales', heading: 'Продажи', panel: 'Структура продаж', api: 'sales' },
  { path: '/warehouse', heading: 'Склад', panel: 'Общие товарные запасы', api: 'warehouse' },
  { path: '/foodcost', heading: 'Фудкост', panel: 'Чистый фудкост', api: 'foodcost' },
] as const;

function waitForPageApi(page: Page, api: string) {
  return page.waitForResponse(
    (response) =>
      response.url().includes(`/api/${api}`) &&
      response.request().method() === 'GET' &&
      response.status() === 200,
    { timeout: 30_000 },
  );
}

test.describe('smoke', () => {
  for (const route of ROUTES) {
    test(`${route.path} loads without error`, async ({ page }) => {
      const apiReady = waitForPageApi(page, route.api);
      await page.goto(route.path);
      await apiReady;

      await expect(page.getByRole('link', { name: new RegExp(route.heading) })).toHaveClass(/on/);
      await expect(page.getByText(route.panel)).toBeVisible({ timeout: 15_000 });
      await expect(page.getByText('Не удалось загрузить')).toHaveCount(0);
    });
  }

  test('sidebar navigates between dashboard and sales', async ({ page }) => {
    const dashboardReady = waitForPageApi(page, 'dashboard');
    await page.goto('/dashboard');
    await dashboardReady;

    const salesReady = waitForPageApi(page, 'sales');
    await page.getByRole('link', { name: 'Продажи', exact: true }).click();
    await expect(page).toHaveURL(/\/sales$/);
    await salesReady;

    await page.getByRole('link', { name: 'Дашборд', exact: true }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByText('Выручка по дням')).toBeVisible();
  });

  test('period bar reflects dashboard API period', async ({ page }) => {
    const apiReady = waitForPageApi(page, 'dashboard');
    await page.goto('/dashboard');
    await apiReady;

    const api = await page.request.get('/api/dashboard');
    expect(api.ok()).toBeTruthy();
    const body = await api.json();
    const monthShort = MONTHS_SHORT[(body.period.month as number) - 1];

    const periodBar = page.locator('app-period-bar');
    await expect(periodBar).not.toContainText('загрузка', { timeout: 15_000 });
    await expect(periodBar.locator('.date-pill').first()).toBeVisible();
    await expect(periodBar).toContainText(String(body.period.year));
    await expect(periodBar).toContainText(monthShort);
  });

  test('unknown route redirects to dashboard', async ({ page }) => {
    await page.goto('/does-not-exist');
    await expect(page).toHaveURL(/\/dashboard$/);
  });

  test('targets page renders goal sections', async ({ page }) => {
    const apiReady = waitForPageApi(page, 'targets');
    await page.goto('/targets');
    await apiReady;

    await expect(page.locator('app-page-greeting')).toContainText('Цели');
    await expect(page.locator('app-period-bar')).toHaveCount(1);
    await expect(page.getByRole('heading', { name: 'Выручка — план по дням' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Фудкост по юнитам' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Списания' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Сохранить' })).toBeVisible();
  });

  test('settings page loads profile sections', async ({ page }) => {
    await page.goto('/settings');
    await expect(page.locator('app-page-greeting')).toContainText('Настройки');
    await expect(page.getByRole('heading', { name: 'Профиль' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Подключение iiko' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Смена пароля' })).toBeVisible();
    await expect(page.locator('app-period-bar')).toHaveCount(0);
  });

  test('sales page shows title and period bar', async ({ page }) => {
    const apiReady = waitForPageApi(page, 'sales');
    await page.goto('/sales');
    await apiReady;
    await expect(page.locator('app-page-greeting')).toContainText('Продажи');
    await expect(page.locator('app-period-bar')).toHaveCount(1);
  });
});
