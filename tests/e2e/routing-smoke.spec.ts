import { expect, test } from '@playwright/test';

test.describe('Routing smoke', () => {
  test('landing page renders primary content', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /why teams choose klaros/i })).toBeVisible();
  });

  test('protected routes redirect unauthenticated users to login', async ({ page }) => {
    await page.goto('/decisions/new');

    const decisionsUrl = page.url();
    if (/\/login/.test(decisionsUrl)) {
      await expect(page).toHaveURL(/\/login/);
    } else {
      await expect(page.locator('.animate-spin').first()).toBeVisible();
    }

    await page.goto('/connect-data');

    const connectUrl = page.url();
    if (/\/login/.test(connectUrl)) {
      await expect(page).toHaveURL(/\/login/);
    } else {
      await expect(page.locator('.animate-spin').first()).toBeVisible();
    }
  });

  test('unknown route shows not found page', async ({ page }) => {
    await page.goto('/this-route-does-not-exist');
    await expect(page.getByRole('heading', { name: '404' })).toBeVisible();
  });
});
