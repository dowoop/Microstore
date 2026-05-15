import { test, expect } from '@playwright/test';

test.describe('Shop Creation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/shops/new');
  });

  test('renders the create shop form', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Create Shop' })).toBeVisible();
    await expect(page.getByText('Set up your merchant profile')).toBeVisible();
    await expect(page.getByLabel('Shop name')).toBeVisible();
    await expect(page.getByLabel('Username')).toBeVisible();
    await expect(page.getByLabel('Description')).toBeVisible();
    await expect(page.getByText('Tip presets')).toBeVisible();
    await expect(page.getByText('Tax allocation')).toBeVisible();
    await expect(page.getByText('Charity round-up')).toBeVisible();
    await expect(page.getByText('Payment Setup (Solana)')).toBeVisible();
    await expect(page.getByLabel('Merchant wallet')).toBeVisible();
  });

  test('shows validation error when submitting empty form', async ({ page }) => {
    await page.getByLabel('Shop name').press('Enter');
    await expect(page.locator('.bg-red-50')).toBeVisible({ timeout: 5000 });
  });

  test('can fill form fields', async ({ page }) => {
    await page.getByLabel('Shop name').fill('Test Coffee Shop');
    await expect(page.getByLabel('Shop name')).toHaveValue('Test Coffee Shop');
    await page.getByLabel('Username').fill('test-coffee');
    await page.getByLabel('Description').fill('Best coffee in town');
  });

  test('tip presets toggle works', async ({ page }) => {
    const btn10 = page.getByRole('button', { name: '10%' });
    await btn10.click();
    await expect(btn10).toHaveClass(/bg-blue-600/);
  });

  test('tax allocation toggle works', async ({ page }) => {
    const tax = page.getByRole('switch', { name: /tax/i }).first();
    await expect(tax).toHaveAttribute('aria-checked', 'true');
    await tax.click();
    await expect(tax).toHaveAttribute('aria-checked', 'false');
  });

  test('charity toggle reveals partner info', async ({ page }) => {
    await page.getByRole('switch', { name: /charity/i }).click();
    await expect(page.getByText('Partner charities')).toBeVisible();
    await expect(page.getByText('GiveDirectly')).toBeVisible();
    await expect(page.getByText('Local Food Bank')).toBeVisible();
  });

  test('can fill wallet addresses', async ({ page }) => {
    await page.getByLabel('Merchant wallet').fill('HN7cABqLq46Es1jh92dQQisAq662SmxELLLsHHe4YWrH');
    await expect(page.getByLabel('Merchant wallet')).toHaveValue('HN7cABqLq46Es1jh92dQQisAq662SmxELLLsHHe4YWrH');
    await expect(page.getByLabel('Tax wallet')).toBeVisible();
  });
});
