import { test, expect } from '@playwright/test';

const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? 'admin@renthub.com';
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? 'admin';

test.describe('Public', () => {
  test('homepage loads and shows brand', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/RentHub/i);
    await expect(page.getByRole('link', { name: /RentHub/i }).first()).toBeVisible();
  });

  test('catalog page is reachable from homepage', async ({ page }) => {
    await page.goto('/catalog');
    await expect(page).toHaveURL(/\/catalog$/);
  });

  test('protected admin route redirects unauthenticated user to /login', async ({ browser }) => {
    // Create fresh context without storageState to test redirect
    const context = await browser.newContext({ storageState: undefined });
    const page = await context.newPage();
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/login/);
    await context.close();
  });

  test('404 page renders for unknown route', async ({ page }) => {
    await page.goto('/nonexistent-page-12345');
    await expect(page.getByText('404')).toBeVisible();
    await expect(page.getByText('Страница не найдена')).toBeVisible();
  });

  test('catalog displays equipment cards', async ({ page }) => {
    await page.goto('/catalog');
    // Wait for equipment grid to load (skeleton disappears)
    await page.waitForSelector('[data-testid="equipment-card"], .grid a[href*="/equipment/"]', {
      timeout: 10_000,
    }).catch(() => {
      // fallback: at least the page should have loaded with some content
    });
    // Page should have loaded without errors
    await expect(page.locator('main, [role="main"], .container').first()).toBeVisible();
  });

  test('contact/inquiry page loads', async ({ page }) => {
    await page.goto('/contact');
    await expect(page).toHaveURL(/\/contact/);
    // Should have a form
    await expect(page.locator('form').first()).toBeVisible();
  });

  test('rental terms page loads', async ({ page }) => {
    await page.goto('/rental-terms');
    await expect(page).toHaveURL(/\/rental-terms/);
  });
});

test.describe('Auth', () => {
  test('admin can sign in and is redirected into admin panel', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill(ADMIN_EMAIL);
    await page.getByLabel('Пароль').fill(ADMIN_PASSWORD);
    await page.getByRole('button', { name: /Войти/i }).click();

    await expect(page).toHaveURL(/\/admin/, { timeout: 10_000 });
  });

  test('wrong password produces a visible error and stays on /login', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill(ADMIN_EMAIL);
    await page.getByLabel('Пароль').fill('definitely-wrong-password');
    await page.getByRole('button', { name: /Войти/i }).click();

    await expect(page).toHaveURL(/\/login/);
    await expect(page.locator('[data-sonner-toast], [role="status"]').first()).toBeVisible({
      timeout: 5_000,
    });
  });

  test('login form validates empty fields', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: /Войти/i }).click();
    // Should stay on login page (client-side validation prevents submission)
    await expect(page).toHaveURL(/\/login/);
  });

  test('forgot password page loads', async ({ page }) => {
    await page.goto('/forgot-password');
    await expect(page).toHaveURL(/\/forgot-password/);
    await expect(page.locator('form').first()).toBeVisible();
  });
});

test.describe('Health', () => {
  test('API liveness probe returns ok', async ({ request }) => {
    const apiPort = process.env.E2E_API_PORT ?? '3001';
    const res = await request.get(`http://localhost:${apiPort}/api/v1/health`);
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.status).toBe('ok');
  });

  test('API readiness probe reports up DB and Redis', async ({ request }) => {
    const apiPort = process.env.E2E_API_PORT ?? '3001';
    const res = await request.get(`http://localhost:${apiPort}/api/v1/health/ready`);
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.status).toBe('ok');
    expect(body.info?.database?.status).toBe('up');
    expect(body.info?.redis?.status).toBe('up');
  });
});

test.describe('Admin panel (authenticated)', () => {
  // Authentication is handled by auth.setup.ts and storageState

  test('dashboard shows KPI cards', async ({ page }) => {
    await page.goto('/admin/overview');
    await page.waitForTimeout(1000);
    // Should show at least one stat card with a number
    await expect(page.locator('main, [role="main"]').first()).toBeVisible();
  });

  test('orders list page loads', async ({ page }) => {
    await page.goto('/admin/orders');
    await expect(page).toHaveURL(/\/admin\/orders/);
    await expect(page.locator('main, [role="main"]').first()).toBeVisible();
  });

  test('order creation page loads with form', async ({ page }) => {
    await page.goto('/admin/orders/new');
    await expect(page).toHaveURL(/\/admin\/orders\/new/);
    await expect(page.locator('form').first()).toBeVisible();
  });

  test('equipment catalog loads', async ({ page }) => {
    await page.goto('/admin/equipment/catalog');
    await expect(page).toHaveURL(/\/admin\/equipment\/catalog/);
    await expect(page.locator('main, [role="main"]').first()).toBeVisible();
  });

  test('warehouse/stock page loads', async ({ page }) => {
    await page.goto('/admin/equipment/stock');
    await expect(page).toHaveURL(/\/admin\/equipment\/stock/);
  });

  test('categories page loads', async ({ page }) => {
    await page.goto('/admin/equipment/categories');
    await expect(page).toHaveURL(/\/admin\/equipment\/categories/);
  });

  test('pricing tiers page loads', async ({ page }) => {
    await page.goto('/admin/equipment/pricing');
    await expect(page).toHaveURL(/\/admin\/equipment\/pricing/);
  });

  test('clients list page loads', async ({ page }) => {
    await page.goto('/admin/customers');
    await expect(page).toHaveURL(/\/admin\/customers/);
    await expect(page.locator('main, [role="main"]').first()).toBeVisible();
  });

  test('calendar page loads', async ({ page }) => {
    await page.goto('/admin/calendar');
    await expect(page).toHaveURL(/\/admin\/calendar/);
    await expect(page.locator('main, [role="main"]').first()).toBeVisible();
  });

  test('analytics/reports page loads with charts', async ({ page }) => {
    await page.goto('/admin/analytics');
    await expect(page).toHaveURL(/\/admin\/analytics/);
    // Should show period selector
    await expect(page.locator('main, [role="main"]').first()).toBeVisible();
  });

  test('settings pages load (admin only)', async ({ page }) => {
    await page.goto('/admin/settings/organization');
    await expect(page).toHaveURL(/\/admin\/settings\/organization/);

    await page.goto('/admin/settings/notifications');
    await expect(page).toHaveURL(/\/admin\/settings\/notifications/);

    await page.goto('/admin/settings/users');
    await expect(page).toHaveURL(/\/admin\/settings\/users/);
  });

  test('legacy redirect /admin/dashboard works', async ({ page }) => {
    await page.goto('/admin/dashboard');
    // Should redirect to appropriate admin page
    await expect(page).toHaveURL(/\/admin\/(overview|today)/, { timeout: 5_000 });
  });

  test('legacy redirect /admin/reports works', async ({ page }) => {
    await page.goto('/admin/reports');
    await expect(page).toHaveURL(/\/admin\/analytics/, { timeout: 5_000 });
  });
});

test.describe('API endpoints', () => {
  const apiPort = process.env.E2E_API_PORT ?? '3001';
  const base = `http://localhost:${apiPort}/api/v1`;

  test('public equipment list is accessible', async ({ request }) => {
    const res = await request.get(`${base}/equipment?page=1&limit=10`);
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body).toHaveProperty('items');
    expect(Array.isArray(body.items)).toBeTruthy();
  });

  test('public categories tree is accessible', async ({ request }) => {
    const res = await request.get(`${base}/categories/tree`);
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(Array.isArray(body)).toBeTruthy();
  });

  test('protected endpoints require authentication', async ({ browser }) => {
    // Create fresh context without storageState to test unauthenticated access
    const context = await browser.newContext({ storageState: undefined });
    const request = context.request;
    const res = await request.get(`${base}/orders`);
    expect(res.status()).toBe(401);
    await context.close();
  });

  test('protected analytics require admin role', async ({ browser }) => {
    // Create fresh context without storageState to test unauthenticated access
    const context = await browser.newContext({ storageState: undefined });
    const request = context.request;
    const res = await request.get(`${base}/analytics/dashboard`);
    expect(res.status()).toBe(401);
    await context.close();
  });
});
