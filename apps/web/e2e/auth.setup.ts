import { test as setup, expect } from '@playwright/test';

const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? 'admin@renthub.com';
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? 'admin';

const authFile = 'playwright/.auth/admin.json';

setup('authenticate as admin', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill(ADMIN_EMAIL);
  await page.getByLabel('Пароль').fill(ADMIN_PASSWORD);
  await page.getByRole('button', { name: /Войти/i }).click();

  // Wait for redirect to admin panel
  await expect(page).toHaveURL(/\/admin/, { timeout: 10_000 });

  // Save signed-in state
  await page.context().storageState({ path: authFile });
});
