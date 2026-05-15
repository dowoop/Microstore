import { test, expect } from '@playwright/test';

/**
 * Seed a shop directly into IndexedDB (Dexie DB name: MicrostoreDB).
 * Run inside page.evaluate().
 */
async function seedShop(page: import('@playwright/test').Page, overrides: Record<string, unknown> = {}): Promise<number> {
  return page.evaluate((overrides) => {
    const now = new Date();
    const shop = {
      name: 'Test Shop', username: 'test-shop',
      tipPresets: [10, 15, 20], taxAllocationEnabled: true, charityEnabled: false,
      charityPartners: [],
      merchantWallet: 'HN7cABqLq46Es1jh92dQQisAq662SmxELLLsHHe4YWrH',
      splTokenMint: 'Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr',
      splTokenSymbol: 'USDC',
      createdAt: now, updatedAt: now,
      ...overrides,
    };
    return new Promise<number>((resolve, reject) => {
      const req = indexedDB.open('MicrostoreDB');
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction('shops', 'readwrite');
        const addReq = tx.objectStore('shops').add(shop);
        addReq.onsuccess = () => { resolve(addReq.result as number); db.close(); };
        addReq.onerror = () => { reject(addReq.error); db.close(); };
      };
      req.onerror = () => reject(req.error);
    });
  }, overrides);
}

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

  test('can fill shop name, username, and toggle tip presets', async ({ page }) => {
    await page.getByLabel('Shop name').fill('Test Coffee Shop');
    await expect(page.getByLabel('Shop name')).toHaveValue('Test Coffee Shop');
    await page.getByLabel('Username').fill('test-coffee');
    await expect(page.getByLabel('Username')).toHaveValue('test-coffee');
    await page.getByLabel('Description').fill('Best coffee in town');
    await expect(page.getByLabel('Description')).toHaveValue('Best coffee in town');
  });

  test('tip presets can be toggled', async ({ page }) => {
    const btn10 = page.getByRole('button', { name: '10%' });
    // Should be off initially (not selected)
    await expect(btn10).not.toHaveClass(/bg-blue-600/);
    await btn10.click();
    // After clicking, it should be selected
    await expect(btn10).toHaveClass(/bg-blue-600/);
  });

  test('tax allocation toggle works', async ({ page }) => {
    const taxToggle = page.getByRole('switch', { name: /tax/i }).first();
    await expect(taxToggle).toHaveAttribute('aria-checked', 'true');
    await taxToggle.click();
    await expect(taxToggle).toHaveAttribute('aria-checked', 'false');
  });

  test('charity toggle reveals partner info', async ({ page }) => {
    const charityToggle = page.getByRole('switch', { name: /charity/i });
    await charityToggle.click();
    await expect(charityToggle).toHaveAttribute('aria-checked', 'true');
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
