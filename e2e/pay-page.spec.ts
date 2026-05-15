import { test, expect } from '@playwright/test';

// ---------------------------------------------------------------------------
// Browser-context seed helpers (run inside page.evaluate, accesses IndexedDB)
// ---------------------------------------------------------------------------

const seedShop = (overrides: Record<string, unknown> = {}) => {
  const now = new Date();
  const shop = {
    name: 'Test Shop', username: 'test-shop',
    tipPresets: [10, 15, 20], taxAllocationEnabled: true, charityEnabled: false,
    charityPartners: [],
    merchantWallet: 'HN7cABqLq46Es1jh92dQQisAq662SmxELLLsHHe4YWrH',
    splTokenMint: 'Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr',
    splTokenSymbol: 'USDC', createdAt: now, updatedAt: now,
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
};

const seedOrder = (shopId: number, overrides: Record<string, unknown> = {}) => {
  const now = new Date();
  const order = {
    shopId, status: 'pending', subtotal: 10, tip: 1, tipPercent: 10, tax: 0.89,
    charity: 0, total: 11.89,
    items: [{ itemId: 0, name: 'Test Item', price: 10, quantity: 1 }],
    merchantWallet: 'HN7cABqLq46Es1jh92dQQisAq662SmxELLLsHHe4YWrH',
    splTokenMint: 'Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr',
    splTokenSymbol: 'USDC', paymentRef: 'microshop:test:1',
    createdAt: now, updatedAt: now,
    ...overrides,
  };
  return new Promise<number>((resolve, reject) => {
    const req = indexedDB.open('MicrostoreDB');
    req.onsuccess = () => {
      const db = req.result;
      const tx = db.transaction('orders', 'readwrite');
      const addReq = tx.objectStore('orders').add(order);
      addReq.onsuccess = () => { resolve(addReq.result as number); db.close(); };
      addReq.onerror = () => { reject(addReq.error); db.close(); };
    };
    req.onerror = () => reject(req.error);
  });
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('Pay Page', () => {
  test('shows no-payment state when no orderId param', async ({ page }) => {
    await page.goto('/pay');

    await expect(page.getByText('No Payment Found')).toBeVisible({ timeout: 10000 });
    await expect(
      page.getByText('Scan a payment QR code from a Microstore merchant to pay.'),
    ).toBeVisible();
  });

  test('shows error for invalid orderId', async ({ page }) => {
    await page.goto('/pay?orderId=99999');
    await expect(page.getByText('Payment Not Found')).toBeVisible({ timeout: 10000 });
  });

  test('renders payment page for a valid order', async ({ page }) => {
    const shopId = await page.evaluate(seedShop, {
      name: 'Pay Test Shop', username: 'pay-test',
      taxWallet: '2xVTE6sAWGEA2cAq1JabL9hD3S9GeyZSCPTbDPKKBG8F',
      charityWallet: '3yXTE6sAWGEA2cAq1JabL9hD3S9GeyZSCPTbDPKKBG8G',
    });

    const orderId = await page.evaluate(
      (args: { shopId: number; overrides: Record<string, unknown> }) =>
        (seedOrder as Function)(args.shopId, args.overrides),
      {
        shopId,
        overrides: {
          subtotal: 15, tip: 2.25, tipPercent: 15, tax: 1.33, total: 18.58,
          items: [
            { itemId: 1, name: 'Espresso', price: 5, quantity: 1 },
            { itemId: 2, name: 'Latte', price: 5, quantity: 2 },
          ],
          taxWallet: '2xVTE6sAWGEA2cAq1JabL9hD3S9GeyZSCPTbDPKKBG8F',
          charityWallet: '3yXTE6sAWGEA2cAq1JabL9hD3S9GeyZSCPTbDPKKBG8G',
        },
      },
    );

    await page.goto(`/pay?orderId=${orderId}`);
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('heading', { name: 'Scan to Pay' })).toBeVisible({
      timeout: 15000,
    });
  });

  test('shows order summary with items', async ({ page }) => {
    const shopId = await page.evaluate(seedShop, {
      name: 'Summary Shop', username: 'summary',
    });

    const orderId = await page.evaluate(
      (args: { shopId: number; overrides: Record<string, unknown> }) =>
        (seedOrder as Function)(args.shopId, args.overrides),
      {
        shopId,
        overrides: {
          subtotal: 10, total: 11,
          items: [{ itemId: 1, name: 'Americano', price: 5, quantity: 2 }],
        },
      },
    );

    await page.goto(`/pay?orderId=${orderId}`);
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('Order Summary')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Americano')).toBeVisible();
  });

  test('shows QR code section', async ({ page }) => {
    const shopId = await page.evaluate(seedShop, {
      name: 'QR Shop', username: 'qr-shop',
      taxAllocationEnabled: false,
    });

    const orderId = await page.evaluate(
      (args: { shopId: number; overrides: Record<string, unknown> }) =>
        (seedOrder as Function)(args.shopId, args.overrides),
      {
        shopId,
        overrides: {
          subtotal: 5, tip: 0, tipPercent: 0, tax: 0, total: 5,
          items: [{ itemId: 1, name: 'Cookie', price: 5, quantity: 1 }],
        },
      },
    );

    await page.goto(`/pay?orderId=${orderId}`);
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('Scan with Wallet')).toBeVisible({ timeout: 15000 });
  });

  test('shows paid status for completed orders', async ({ page }) => {
    const shopId = await page.evaluate(seedShop, {
      name: 'Paid Shop', username: 'paid-shop',
      taxAllocationEnabled: false,
    });

    const orderId = await page.evaluate(
      (args: { shopId: number; overrides: Record<string, unknown> }) =>
        (seedOrder as Function)(args.shopId, args.overrides),
      {
        shopId,
        overrides: {
          status: 'paid', subtotal: 5, tip: 0, tipPercent: 0, tax: 0, total: 5,
          items: [{ itemId: 1, name: 'Cookies', price: 5, quantity: 1 }],
          txSignature: '5VERv6NMbE6V1BhvM1MYKnq4KqX6WrQqWJNqW8RoU9KE3KgXNxUFJY4J7q2JhNkNknSLaGseMZdnGbXTpKc5AaMG',
          confirmedAt: new Date(),
        },
      },
    );

    await page.goto(`/pay?orderId=${orderId}`);
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('heading', { name: 'Payment Complete' })).toBeVisible({
      timeout: 15000,
    });
    await expect(page.getByText('This order has been paid.')).toBeVisible();
  });

  test('shows atomic split breakdown with tax when enabled', async ({ page }) => {
    const shopId = await page.evaluate(seedShop, {
      name: 'Split Shop', username: 'split-shop',
      taxAllocationEnabled: true, charityEnabled: false,
      taxWallet: '2xVTE6sAWGEA2cAq1JabL9hD3S9GeyZSCPTbDPKKBG8F',
    });

    const orderId = await page.evaluate(
      (args: { shopId: number; overrides: Record<string, unknown> }) =>
        (seedOrder as Function)(args.shopId, args.overrides),
      {
        shopId,
        overrides: {
          subtotal: 20, tip: 3, tipPercent: 15, tax: 1.78, total: 24.78,
          items: [{ itemId: 1, name: 'Burger', price: 10, quantity: 2 }],
          taxWallet: '2xVTE6sAWGEA2cAq1JabL9hD3S9GeyZSCPTbDPKKBG8F',
        },
      },
    );

    await page.goto(`/pay?orderId=${orderId}`);
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('Atomic Split Breakdown')).toBeVisible({ timeout: 15000 });
  });
});
