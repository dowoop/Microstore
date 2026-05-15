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

const seedOrder = (shopId: number, overrides: Record<string, unknown> = {}) => {
  const now = new Date();
  return new Promise<number>((resolve, reject) => {
    const req = indexedDB.open('MicrostoreDB');
    req.onsuccess = () => {
      const db = req.result;
      const tx = db.transaction('orders', 'readwrite');
      const addReq = tx.objectStore('orders').add({
        shopId, status: 'pending', subtotal: 10, tip: 1, tipPercent: 10,
        tax: 0.89, charity: 0, total: 11.89,
        items: [{ itemId: 0, name: 'Test Item', price: 10, quantity: 1 }],
        merchantWallet: 'HN7cABqLq46Es1jh92dQQisAq662SmxELLLsHHe4YWrH',
        splTokenMint: 'Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr',
        splTokenSymbol: 'USDC', paymentRef: 'test:' + Date.now(),
        createdAt: now, updatedAt: now, ...overrides,
      });
      addReq.onsuccess = () => { resolve(addReq.result as number); db.close(); };
      addReq.onerror = () => { reject(addReq.error); db.close(); };
    };
    req.onerror = () => reject(req.error);
  });
};

test.describe('Pay Page', () => {
  test('shows no-payment state when no orderId', async ({ page }) => {
    await page.goto('/pay');
    await expect(page.getByText('No Payment Found')).toBeVisible({ timeout: 10000 });
  });

  test('shows error for invalid orderId', async ({ page }) => {
    await page.goto('/pay?orderId=99999');
    await expect(page.getByText('Payment Not Found')).toBeVisible({ timeout: 10000 });
  });

  test('renders payment page for valid order', async ({ page }) => {
    const shopId = await page.evaluate(seedShop as any, { name: 'Pay Shop', username: 'pay-shop' });
    const orderId = await page.evaluate(
      (args: any) => (seedOrder as any)(args.shopId, args.overrides),
      { shopId, overrides: { items: [{ itemId: 1, name: 'Latte', price: 5, quantity: 2 }] } },
    );
    await page.goto(`/pay?orderId=${orderId}`);
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading', { name: 'Scan to Pay' })).toBeVisible({ timeout: 15000 });
  });

  test('shows paid status for completed orders', async ({ page }) => {
    const shopId = await page.evaluate(seedShop as any, { name: 'Paid', username: 'paid', taxAllocationEnabled: false });
    const orderId = await page.evaluate(
      (args: any) => (seedOrder as any)(args.shopId, args.overrides),
      {
        shopId,
        overrides: {
          status: 'paid', subtotal: 5, tip: 0, tipPercent: 0, tax: 0, total: 5,
          items: [{ itemId: 1, name: 'Cookie', price: 5, quantity: 1 }],
          txSignature: '5VERv6NMbE6V1BhvM1MYKnq4KqX6WrQqWJNqW8RoU9KE',
          confirmedAt: new Date(),
        },
      },
    );
    await page.goto(`/pay?orderId=${orderId}`);
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading', { name: 'Payment Complete' })).toBeVisible({ timeout: 15000 });
  });
});
