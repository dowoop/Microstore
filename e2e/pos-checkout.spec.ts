import { test, expect } from '@playwright/test';

const dbShop = (o: Record<string, unknown> = {}) => {
  const n = new Date();
  return new Promise<number>((res, rej) => {
    const r = indexedDB.open('MicrostoreDB');
    r.onsuccess = () => {
      const d = r.result;
      const t = d.transaction('shops', 'readwrite');
      const a = t.objectStore('shops').add({
        name:'S',username:'s',tipPresets:[10,15,20],taxAllocationEnabled:true,
        charityEnabled:false,charityPartners:[],
        merchantWallet:'HN7cABqLq46Es1jh92dQQisAq662SmxELLLsHHe4YWrH',
        splTokenMint:'Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr',
        splTokenSymbol:'USDC',createdAt:n,updatedAt:n,...o,
      });
      a.onsuccess = () => { res(a.result as number); d.close(); };
      a.onerror = () => { rej(a.error); d.close(); };
    };
    r.onerror = () => rej(r.error);
  });
};

test.describe('POS Checkout', () => {
  test('shows no shop selected', async ({ page }) => {
    await page.goto('/pos');
    await expect(page.getByText('No shop selected')).toBeVisible({ timeout: 10000 });
  });

  test('renders POS with view toggle', async ({ page }) => {
    const id = await page.evaluate((opts: Record<string, unknown>) => dbShop(opts), { name: 'P', username: 'p' });
    await page.evaluate((shopId: number) => { localStorage.setItem('microstore-active-shop', String(shopId)); }, id);
    await page.goto('/pos');
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading', { name: 'POS' })).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('button', { name: 'Items' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Cart' })).toBeVisible();
  });

  test('cart shows empty state', async ({ page }) => {
    const id = await page.evaluate((opts: Record<string, unknown>) => dbShop(opts), { name: 'C', username: 'c' });
    await page.evaluate((shopId: number) => { localStorage.setItem('microstore-active-shop', String(shopId)); }, id);
    await page.goto('/pos');
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: 'Cart' }).click();
    await expect(page.getByText('Cart is empty')).toBeVisible({ timeout: 5000 });
  });

  test('connectivity badge visible', async ({ page }) => {
    const id = await page.evaluate((opts: Record<string, unknown>) => dbShop(opts), { name: 'N', username: 'n' });
    await page.evaluate((shopId: number) => { localStorage.setItem('microstore-active-shop', String(shopId)); }, id);
    await page.goto('/pos');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('text=Online').or(page.locator('text=Offline'))).toBeVisible({ timeout: 10000 });
  });
});
