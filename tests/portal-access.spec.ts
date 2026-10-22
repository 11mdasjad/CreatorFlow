import { test, expect } from '@playwright/test';
import { existsSync, readFileSync, mkdirSync } from 'node:fs';

const credentialsPath = '.local/admin-access.json';
test('shared login routes admin and creator accounts with protected destinations and clean logout', async ({
  page,
  baseURL,
}) => {
  test.skip(
    !existsSync(credentialsPath) || new URL(baseURL!).hostname !== '127.0.0.1',
    'Requires local admin:local setup',
  );
  const admin = JSON.parse(readFileSync(credentialsPath, 'utf8'));
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  mkdirSync('artifacts/portal-access', { recursive: true });
  async function signIn(email: string, password: string) {
    await page.getByLabel('Email address').fill(email);
    await page.getByLabel('Password', { exact: false }).fill(password);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  }
  async function responsiveScreenshot(name: string) {
    for (const width of [1440, 390, 320]) {
      await page.setViewportSize({ width, height: 1000 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      await page.screenshot({
        path: `artifacts/portal-access/${name}-${width}.png`,
        fullPage: true,
      });
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
  }
  await page.goto('/admin/login');
  await expect(page).toHaveURL(/\/login$/);
  await page.goto('/admin/users');
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', { name: 'Welcome back', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Platform admin? Sign in here' })).toHaveCount(0);
  await responsiveScreenshot('shared-login');
  await signIn('demo@creatorflow.local', 'CreatorFlow-demo-2026!');
  await expect(page).toHaveURL(/\/app$/);
  await expect(page.getByRole('heading', { name: 'Welcome back, Demo.' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Platform admin', exact: true })).toHaveCount(0);
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/app$/);
  await expect(page.getByRole('heading', { name: 'Welcome back, Demo.' })).toBeVisible();
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await signIn(admin.email, admin.password);
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole('heading', { name: 'Platform overview' })).toBeVisible();
  await expect(page.getByText('Md Asjad', { exact: true })).toBeVisible();
  await expect(page.getByText('Registered users', { exact: true })).toBeVisible();
  await responsiveScreenshot('admin-overview');
  for (const [slug, heading] of [
    ['users', 'Users'],
    ['workspaces', 'Workspaces'],
    ['plans', 'Plans & subscriptions'],
    ['monitoring', 'Integration health'],
    ['support', 'Support'],
    ['settings', 'Platform settings'],
  ]) {
    await page.goto(`/admin/${slug}`);
    await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
    await expect(page.locator('.error-panel[role=alert]')).toHaveCount(0);
  }
  await page.goto('/app');
  await expect(page).toHaveURL(/\/admin$/);
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/login$/);
  await page.goto('/app');
  await expect(page).toHaveURL(/\/login$/);
  await signIn('demo@creatorflow.local', 'CreatorFlow-demo-2026!');
  await expect(page).toHaveURL(/\/app$/);
  await expect(page.getByRole('heading', { name: 'Welcome back, Demo.' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Platform overview' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  expect(errors).toEqual([]);
});
