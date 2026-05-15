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

test.describe('POS Checkout', () => {
  test('shows no shop selected state', async ({ page }) => {
    await page.goto('/pos');
    await expect(page.getByText('No shop selected')).toBeVisible({ timeout: 10000 });
  });

  test('renders POS with view toggle when seeded', async ({ page }) => {
    const shopId = await page.evaluate(seedShop as any, {
      name: 'POS Shop', username: 'pos-shop',
    });
    await page.evaluate((id: number) => {
      localStorage.setItem('microstore-active-shop', String(id));
    }, shopId);

    await page.goto('/pos');
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('heading', { name: 'POS' })).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('button', { name: 'Items' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Cart' })).toBeVisible();
  });

  test('cart shows empty state', async ({ page }) => {
    const shopId = await page.evaluate(seedShop as any, {
      name: 'Empty Cart', username: 'empty-cart',
    });
    await page.evaluate((id: number) => {
      localStorage.setItem('microstore-active-shop', String(id));
    }, shopId);

    await page.goto('/pos');
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: 'Cart' }).click();
    await expect(page.getByText('Cart is empty')).toBeVisible({ timeout: 5000 });
  });

  test('connectivity badge visible', async ({ page }) => {
    const shopId = await page.evaluate(seedShop as any, {
      name: 'Net Shop', username: 'net-shop',
    });
    await page.evaluate((id: number) => {
      localStorage.setItem('microstore-active-shop', String(id));
    }, shopId);
    await page.goto('/pos');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('text=Online').or(page.locator('text=Offline'))).toBeVisible({ timeout: 10000 });
  });
});
