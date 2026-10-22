import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';
const password = 'CreatorFlow-demo-2026!';
test('marketing and mobile navigation render without overflow', async ({ page }) => {
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'Turn your audience into customers.' }),
  ).toBeVisible();
  await expect(
    page.getByRole('banner').getByRole('link', { name: 'Start for Free', exact: true }),
  ).toBeVisible();
  mkdirSync('artifacts', { recursive: true });
  await page.screenshot({
    path: 'artifacts/marketing-desktop.png',
    fullPage: true,
    animations: 'disabled',
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page.getByRole('banner').getByRole('link', { name: 'Start for Free', exact: true }),
  ).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({
    path: 'artifacts/marketing-mobile.png',
    fullPage: true,
    animations: 'disabled',
  });
});
test('real login, persistent lead creation, simulation, workflows and mobile dashboard', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/login');
  await page.getByLabel('Email address').fill('demo@creatorflow.local');
  await page.getByLabel('Password', { exact: false }).fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Welcome back, Demo.' })).toBeVisible();
  await expect(page.getByText('No paid orders yet')).toBeVisible();
  await page.screenshot({
    path: 'artifacts/dashboard-desktop.png',
    fullPage: true,
    animations: 'disabled',
  });
  await page.getByRole('link', { name: 'Leads & CRM', exact: true }).click();
  await page.getByRole('button', { name: 'Add lead', exact: true }).click();
  const suffix = Date.now();
  await page.getByLabel('Full name').fill(`QA Lead ${suffix}`);
  await page.getByLabel('Email address').fill(`qa-${suffix}@example.test`);
  await page.getByRole('dialog').getByRole('button', { name: 'Add lead', exact: true }).click();
  await expect(
    page.getByRole('button', { name: `View QA Lead ${suffix}`, exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.locator('.crm-table-card').getByText(`qa-${suffix}@example.test`),
  ).toBeVisible();
  await page.getByRole('button', { name: `Edit QA Lead ${suffix}` }).click();
  await page.getByRole('combobox', { name: 'Status', exact: true }).selectOption('QUALIFIED');
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect(
    page
      .getByRole('row')
      .filter({ hasText: `qa-${suffix}@example.test` })
      .getByText('Qualified', { exact: true }),
  ).toBeVisible();
  await page.goto('/app/automations');
  await page.getByRole('button', { name: 'New automation' }).click();
  await page.getByLabel('Automation name').fill(`QA Guide ${suffix}`);
  await page.getByLabel('Comment keywords').fill('GUIDE');
  await page.getByLabel('Private reply').fill('Here is your requested resource.');
  await page.getByRole('button', { name: 'Create automation', exact: true }).click();
  await page
    .getByRole('button', { name: `Q QA Guide ${suffix} Instagram comment`, exact: true })
    .click();
  await page.getByRole('button', { name: 'Run simulation' }).click();
  await expect(page.getByText('Simulation', { exact: true })).toBeVisible();
  await expect(page.getByText(/No message was sent/)).toBeVisible();
  await page.getByRole('button', { name: 'Close dialog' }).click();
  const workflowsLoaded = page.waitForResponse(
    (response) =>
      /\/api\/workspaces\/[^/]+\/workflows$/.test(response.url()) &&
      response.request().method() === 'GET',
  );
  await page.goto('/app/workflows');
  const existing = await (await workflowsLoaded).json();
  const reusable =
    existing.find((flow: { status: string }) => flow.status === 'ACTIVE') || existing[0];
  const savedWorkflows = page.getByLabel('Choose workflow');
  if (reusable) await savedWorkflows.selectOption(reusable.id);
  await page.getByLabel('Workflow name').fill(`QA Flow ${suffix}`);
  await page.getByRole('button', { name: 'Save draft', exact: true }).click();
  await expect(page.getByText('Workflow draft saved')).toBeVisible();
  await page.getByRole('button', { name: 'Publish workflow', exact: true }).click();
  await expect(page.getByText(/ACTIVE · v[0-9]+/)).toBeVisible();
  await page.screenshot({
    path: 'artifacts/workflow-desktop.png',
    fullPage: true,
    animations: 'disabled',
  });
  await page.goto('/app/social-accounts');
  await expect(page.getByText('Not connected', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Connect Instagram', exact: true }).click();
  await expect(
    page.getByRole('alert').filter({ hasText: 'Configure your Meta app' }),
  ).toBeVisible();
  await page.goto('/app');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Open menu' }).click();
  await expect(page.getByRole('link', { name: 'Lead forms', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Overview', exact: true }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await expect
    .poll(async () => page.locator('.sidebar').evaluate((el) => el.getBoundingClientRect().right))
    .toBeLessThanOrEqual(0);
  await page.screenshot({
    path: 'artifacts/dashboard-mobile.png',
    fullPage: true,
    animations: 'disabled',
  });
  expect(errors).toEqual([]);
});

test('public lead form saves consent and core workspace sections render', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email address').fill('demo@creatorflow.local');
  await page.getByLabel('Password', { exact: false }).fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Welcome back, Demo.' })).toBeVisible();
  const n = Date.now();
  await page.goto('/app/forms');
  await page.getByRole('button', { name: 'New form', exact: true }).click();
  await page.getByLabel('Form name').fill(`QA Capture ${n}`);
  await page.getByLabel('Public URL slug').fill(`qa-capture-${n}`);
  await page.getByLabel('Publish this form').check();
  await page.getByRole('button', { name: 'Create form', exact: true }).click();
  await expect(page.getByRole('link', { name: `Open QA Capture ${n}` })).toBeVisible();
  await page.goto(`/f/qa-capture-${n}`);
  await page.getByLabel('Your name').fill('QA Audience Member');
  await page.getByLabel('Email address').fill(`capture-${n}@example.test`);
  await page.getByRole('button', { name: 'Send my details' }).click();
  await expect(page.getByRole('heading', { name: 'You’re on the list.' })).toBeVisible();
  await page.goto('/app/leads');
  await expect(
    page.locator('.crm-table-card').getByText(`capture-${n}@example.test`),
  ).toBeVisible();
  for (const [route, heading] of [
    ['lead-magnets', 'Share a little of what you know.'],
    ['store', 'Your expertise. Your storefront.'],
    ['courses', 'Make your knowledge go further.'],
    ['billing', 'Room for your next chapter.'],
    ['team', 'Better, together.'],
    ['settings', 'Make yourself at home.'],
    ['support', 'A little help goes a long way.'],
  ]) {
    await page.goto(`/app/${route}`);
    await expect(page.getByRole('heading', { name: heading })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'We couldn’t load this view' })).toHaveCount(0);
  }
  await page.getByRole('button', { name: 'Toggle theme' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.screenshot({
    path: 'artifacts/dashboard-dark.png',
    fullPage: true,
    animations: 'disabled',
  });
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/app$/);
  await expect(page.getByRole('heading', { name: 'Welcome back, Demo.' })).toBeVisible();
});

test('redesigned product cards retain create, edit, detail and delete actions', async ({
  page,
}) => {
  await page.goto('/login');
  await page.getByLabel('Email address').fill('demo@creatorflow.local');
  await page.getByLabel('Password', { exact: false }).fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Welcome back, Demo.' })).toBeVisible();
  await page.goto('/app/store');
  const name = `QA Creator Playbook ${Date.now()}`;
  await page.getByRole('button', { name: 'New product', exact: true }).click();
  await page.getByLabel('Product name', { exact: false }).fill(name);
  await page
    .getByRole('textbox', { name: 'Description', exact: true })
    .fill('A draft product created to verify the redesigned catalog.');
  await page.getByRole('button', { name: 'Create product', exact: true }).click();
  const card = page.locator('.catalog-card').filter({ hasText: name });
  await expect(card).toBeVisible();
  await expect(card.getByText('Draft', { exact: true })).toBeVisible();
  await card.getByRole('button', { name: `Edit ${name}` }).click();
  await page
    .getByRole('textbox', { name: 'Description', exact: true })
    .fill('Updated through the product card.');
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect(card.getByText('Updated through the product card.')).toBeVisible();
  await card.getByRole('button', { name: `Open ${name}` }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await page.screenshot({
    path: 'artifacts/catalog-desktop.png',
    fullPage: true,
    animations: 'disabled',
  });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({
    path: 'artifacts/catalog-mobile.png',
    fullPage: true,
    animations: 'disabled',
  });
  await card.getByRole('button', { name: `Delete ${name}` }).click();
  await page.getByRole('button', { name: 'Delete permanently' }).click();
  await expect(card).toHaveCount(0);
});
