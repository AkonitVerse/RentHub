/**
 * Скрипт для генерации скриншотов пользовательского руководства.
 *
 * Запуск:
 *   npx playwright test e2e/screenshots.spec.ts --project=chromium
 *
 * Скриншоты сохраняются в docs/screenshots/
 */
import { test, expect } from '@playwright/test';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? 'admin@renthub.com';
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? 'admin';

const screenshotsDir = path.resolve(__dirname, '../../../docs/screenshots');

async function screenshot(page: import('@playwright/test').Page, name: string) {
  await page.waitForTimeout(500); // let animations settle
  await page.screenshot({ path: path.join(screenshotsDir, `${name}.png`), fullPage: false });
}

test.describe('User guide screenshots', () => {
  test('01 — Login page', async ({ page }) => {
    await page.goto('/login');
    await screenshot(page, '01-login');
  });

  test('02 — Public homepage', async ({ page }) => {
    await page.goto('/');
    await screenshot(page, '02-homepage');
  });

  test('03 — Public catalog', async ({ page }) => {
    await page.goto('/catalog');
    await page.waitForTimeout(1500);
    await screenshot(page, '03-catalog');
  });

  test('04-13 — Admin pages', async ({ page }) => {
    // Sign in
    await page.goto('/login');
    await page.getByLabel('Email').fill(ADMIN_EMAIL);
    await page.getByLabel('Пароль').fill(ADMIN_PASSWORD);
    await page.getByRole('button', { name: /Войти/i }).click();
    await expect(page).toHaveURL(/\/admin/, { timeout: 10_000 });

    // Dashboard
    await page.goto('/admin/overview');
    await page.waitForTimeout(2000);
    await screenshot(page, '04-dashboard');

    // Orders
    await page.goto('/admin/orders');
    await page.waitForTimeout(1500);
    await screenshot(page, '05-orders');

    // Order creation
    await page.goto('/admin/orders/new');
    await page.waitForTimeout(1000);
    await screenshot(page, '06-order-create');

    // Equipment catalog
    await page.goto('/admin/equipment/catalog');
    await page.waitForTimeout(1500);
    await screenshot(page, '07-equipment');

    // Warehouse
    await page.goto('/admin/equipment/stock');
    await page.waitForTimeout(1500);
    await screenshot(page, '08-warehouse');

    // Categories
    await page.goto('/admin/equipment/categories');
    await page.waitForTimeout(1500);
    await screenshot(page, '09-categories');

    // Clients
    await page.goto('/admin/customers');
    await page.waitForTimeout(1500);
    await screenshot(page, '10-clients');

    // Calendar
    await page.goto('/admin/calendar');
    await page.waitForTimeout(2000);
    await screenshot(page, '11-calendar');

    // Reports
    await page.goto('/admin/analytics');
    await page.waitForTimeout(2000);
    await screenshot(page, '12-reports');

    // Settings
    await page.goto('/admin/settings/organization');
    await page.waitForTimeout(1000);
    await screenshot(page, '13-settings');
  });
});
