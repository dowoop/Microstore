import { test, expect } from '@playwright/test';

const seedShop = (overrides: Record<string, unknown> = {}) => {
  const now = new Date();
  return new Promise<number>((resolve, reject) => {
    const req = indexedDB.open('MicrostoreDB');
    req.onsuccess = () => {
      const db = req.result;
      const tx = db.transaction('shops', 'readwrite');
      const addReq = tx.objectStore('shops').add({
        name: 'Test Shop', username: 'test-shop', tipPresets: [10, 15, 20],
        taxAllocationEnabled: true, charityEnabled: false, charityPartners: [],
        merchantWallet: 'HN7cABqLq46Es1jh92dQQisAq662SmxELLLsHHe4YWrH',
        splTokenMint: 'Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr',
        splTokenSymbol: 'USDC', createdAt: now, updatedAt: now, ...overrides,
      });
      addReq.onsuccess = () => { resolve(addReq.result as number); db.close(); };
      addReq.onerror = () => { reject(addReq.error); db.close(); };
    };
    req.onerror = () => reject(req.error);
  });
};

test.describe('Settings Export', () => {
  test('shows settings with no shop selected', async ({ page }) => {
    await page.goto('/settings');
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('No shops yet').or(page.getByText('Import Data'))).toBeVisible({ timeout: 5000 });
  });

  test('renders shop selector when shops exist', async ({ page }) => {
    await page.evaluate(seedShop as any, { name: 'Settings Shop', username: 'settings-shop' });
    await page.goto('/settings');
    await expect(page.getByText('Settings Shop')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('@settings-shop')).toBeVisible();
  });

  test('selecting a shop shows Edit Shop button', async ({ page }) => {
    const shopId = await page.evaluate(seedShop as any, {
      name: 'Editable', username: 'editable',
    });
    await page.evaluate((id: number) => {
      localStorage.setItem('microstore-active-shop', String(id));
    }, shopId);
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('button', { name: 'Edit Shop' })).toBeVisible({ timeout: 5000 });
  });

  test('can enter edit mode and see form fields', async ({ page }) => {
    const shopId = await page.evaluate(seedShop as any, {
      name: 'Edit Mode', username: 'edit-mode', description: 'Testing edit mode',
    });
    await page.evaluate((id: number) => {
      localStorage.setItem('microstore-active-shop', String(id));
    }, shopId);
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: 'Edit Shop' }).click();
    await expect(page.getByLabel('Shop name')).toBeVisible({ timeout: 5000 });
    await expect(page.getByLabel('Username')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Cancel' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save' })).toBeVisible();
  });

  test('import section is visible', async ({ page }) => {
    await page.goto('/settings');
    await expect(page.getByText('Import Data')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Choose File')).toBeVisible();
  });

  test('export button visible with active shop', async ({ page }) => {
    const shopId = await page.evaluate(seedShop as any, {
      name: 'Export Shop', username: 'export-shop',
    });
    await page.evaluate((id: number) => {
      localStorage.setItem('microstore-active-shop', String(id));
    }, shopId);
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('button', { name: /export/i })).toBeVisible({ timeout: 5000 });
  });

  test('delete shop section visible', async ({ page }) => {
    const shopId = await page.evaluate(seedShop as any, {
      name: 'Delete Shop', username: 'delete-shop',
    });
    await page.evaluate((id: number) => {
      localStorage.setItem('microstore-active-shop', String(id));
    }, shopId);
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('Danger Zone').or(page.getByRole('button', { name: /delete/i }))).toBeVisible({ timeout: 5000 });
  });
});
