import { test, expect } from '@playwright/test';

/**
 * Shared browser-context helpers — run inside page.evaluate().
 * These interact with the Dexie IndexedDB (name: MicrostoreDB).
 */

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

const seedItems = (shopId: number, itemsDef: Array<Record<string, unknown>>) => {
  const now = new Date();
  return Promise.all(itemsDef.map((def) => {
    const item = {
      shopId, type: 'product', name: 'Item', price: 5, stock: 100,
      status: 'live', listingRules: { enabled: true },
      createdAt: now, updatedAt: now, ...def,
    };
    return new Promise<number>((resolve, reject) => {
      const req = indexedDB.open('MicrostoreDB');
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction('items', 'readwrite');
        const addReq = tx.objectStore('items').add(item);
        addReq.onsuccess = () => { resolve(addReq.result as number); db.close(); };
        addReq.onerror = () => { reject(addReq.error); db.close(); };
      };
      req.onerror = () => reject(req.error);
    });
  }));
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('POS Checkout', () => {
  test('shows no-shop-selected state', async ({ page }) => {
    await page.goto('/pos');
    await expect(page.getByText('No shop selected')).toBeVisible({ timeout: 10000 });
  });

  test('renders POS header with view toggle when shop exists', async ({ page }) => {
    const shopId = await page.evaluate(seedShop, {
      name: 'POS Test Shop', username: 'pos-test',
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

  test('can switch between Items and Cart view', async ({ page }) => {
    const shopId = await page.evaluate(seedShop, {
      name: 'Toggle Shop', username: 'toggle-shop',
    });
    await page.evaluate((id: number) => {
      localStorage.setItem('microstore-active-shop', String(id));
    }, shopId);

    await page.goto('/pos');
    await page.waitForLoadState('networkidle');

    // Default: Items view with search input
    await expect(page.getByPlaceholder('Search items…')).toBeVisible({ timeout: 10000 });

    // Switch to Cart
    await page.getByRole('button', { name: 'Cart' }).click();
    await expect(page.getByText('Cart is empty')).toBeVisible({ timeout: 5000 });

    // Switch back
    await page.getByRole('button', { name: 'Items' }).click();
    await expect(page.getByPlaceholder('Search items…')).toBeVisible();
  });

  test('cart shows empty state', async ({ page }) => {
    const shopId = await page.evaluate(seedShop, {
      name: 'Empty Cart', username: 'empty-cart',
    });
    await page.evaluate((id: number) => {
      localStorage.setItem('microstore-active-shop', String(id));
    }, shopId);

    await page.goto('/pos');
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: 'Cart' }).click();
    await expect(page.getByText('Cart is empty')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Tap items to add them to the cart.')).toBeVisible();
  });

  test('connectivity badge is visible', async ({ page }) => {
    const shopId = await page.evaluate(seedShop, {
      name: 'Net Shop', username: 'net-shop',
    });
    await page.evaluate((id: number) => {
      localStorage.setItem('microstore-active-shop', String(id));
    }, shopId);

    await page.goto('/pos');
    await page.waitForLoadState('networkidle');

    await expect(
      page.locator('text=Online').or(page.locator('text=Offline')),
    ).toBeVisible({ timeout: 10000 });
  });

  test('adding items to cart shows checkout flow', async ({ page }) => {
    const shopId = await page.evaluate(seedShop, {
      name: 'Checkout Shop', username: 'checkout-shop',
    });
    await page.evaluate(
      (args: { shopId: number; items: Array<Record<string, unknown>> }) =>
        (seedItems as Function)(args.shopId, args.items),
      { shopId, items: [
        { name: 'Espresso', price: 3.50 },
        { name: 'Latte', price: 4.50 },
        { name: 'Croissant', price: 2.75 },
      ]},
    );
    await page.evaluate((id: number) => {
      localStorage.setItem('microstore-active-shop', String(id));
    }, shopId);

    await page.goto('/pos');
    await page.waitForLoadState('networkidle');

    // Items visible in grid
    await expect(page.getByText('Espresso')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Latte')).toBeVisible();
    await expect(page.getByText('Croissant')).toBeVisible();

    // Add Espresso
    await page.getByText('Espresso').first().click();

    // Go to cart
    await page.getByRole('button', { name: 'Cart' }).click();
    await expect(page.locator('.flex-col').filter({ hasText: 'Espresso' })).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Subtotal')).toBeVisible();
  });
});
