import { test, expect } from '@playwright/test';

// ---------------------------------------------------------------------------
// Browser-context seed helpers
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

test.describe('Settings Export', () => {
  test('shows settings page with no shop selected', async ({ page }) => {
    await page.goto('/settings');

    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible({ timeout: 10000 });
    await expect(
      page.getByText('No shops yet').or(page.getByText('Import Data')),
    ).toBeVisible({ timeout: 5000 });
  });

  test('renders shop selector when shops exist', async ({ page }) => {
    await page.evaluate(seedShop, { name: 'Settings Shop', username: 'settings-shop' });

    await page.goto('/settings');
    await expect(page.getByText('Settings Shop')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('@settings-shop')).toBeVisible();
  });

  test('selecting a shop shows Edit Shop button', async ({ page }) => {
    const shopId = await page.evaluate(seedShop, {
      name: 'Editable Shop', username: 'editable',
    });
    await page.evaluate((id: number) => {
      localStorage.setItem('microstore-active-shop', String(id));
    }, shopId);

    await page.goto('/settings');
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('button', { name: 'Edit Shop' })).toBeVisible({ timeout: 5000 });
  });

  test('can enter edit mode and see form fields', async ({ page }) => {
    const shopId = await page.evaluate(seedShop, {
      name: 'Edit Mode Shop', username: 'edit-mode',
      description: 'Testing edit mode',
      charityEnabled: true,
      charityPartners: ['GiveDirectly', 'Local Food Bank'],
    });
    await page.evaluate((id: number) => {
      localStorage.setItem('microstore-active-shop', String(id));
    }, shopId);

    await page.goto('/settings');
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: 'Edit Shop' }).click();

    await expect(page.getByLabel('Shop name')).toBeVisible({ timeout: 5000 });
    await expect(page.getByLabel('Username')).toBeVisible();
    await expect(page.getByLabel('Description')).toBeVisible();
    await expect(page.getByLabel('Merchant wallet')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Cancel' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save' })).toBeVisible();
  });

  test('can cancel edit mode', async ({ page }) => {
    const shopId = await page.evaluate(seedShop, {
      name: 'Cancel Shop', username: 'cancel-shop',
    });
    await page.evaluate((id: number) => {
      localStorage.setItem('microstore-active-shop', String(id));
    }, shopId);

    await page.goto('/settings');
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: 'Edit Shop' }).click();
    await expect(page.getByRole('button', { name: 'Cancel' })).toBeVisible();

    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByRole('button', { name: 'Edit Shop' })).toBeVisible({ timeout: 5000 });
  });

  test('import section is visible', async ({ page }) => {
    await page.goto('/settings');

    await expect(page.getByText('Import Data')).toBeVisible({ timeout: 10000 });
    await expect(
      page.getByText('Import a previously exported Microstore JSON'),
    ).toBeVisible();
    await expect(page.getByText('Choose File')).toBeVisible();
  });

  test('export button is visible with active shop and data', async ({ page }) => {
    const shopId = await page.evaluate(seedShop, {
      name: 'Export Shop', username: 'export-shop',
    });
    await page.evaluate(
      (args: { shopId: number; items: Array<Record<string, unknown>> }) =>
        (seedItems as Function)(args.shopId, args.items),
      { shopId, items: [
        { name: 'Item A', price: 5 },
        { name: 'Item B', price: 10 },
      ]},
    );
    await page.evaluate(
      (args: { shopId: number; overrides: Record<string, unknown> }) =>
        (seedOrder as Function)(args.shopId, args.overrides),
      {
        shopId,
        overrides: {
          status: 'paid', subtotal: 15, tip: 1.5, total: 16.5,
          items: [
            { itemId: 1, name: 'Item A', price: 5, quantity: 1 },
            { itemId: 2, name: 'Item B', price: 10, quantity: 1 },
          ],
        },
      },
    );
    await page.evaluate((id: number) => {
      localStorage.setItem('microstore-active-shop', String(id));
    }, shopId);

    await page.goto('/settings');
    await page.waitForLoadState('networkidle');

    // Export button should be visible
    await expect(page.getByRole('button', { name: /export/i })).toBeVisible({ timeout: 5000 });
  });

  test('delete shop section is visible', async ({ page }) => {
    const shopId = await page.evaluate(seedShop, {
      name: 'Delete Shop', username: 'delete-shop',
    });
    await page.evaluate((id: number) => {
      localStorage.setItem('microstore-active-shop', String(id));
    }, shopId);

    await page.goto('/settings');
    await page.waitForLoadState('networkidle');

    // Danger zone / delete section should be visible
    await expect(page.getByText('Danger Zone').or(page.getByRole('button', { name: /delete/i })))
      .toBeVisible({ timeout: 5000 });
  });
});
