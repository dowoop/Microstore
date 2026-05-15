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

test.describe('Settings Export', () => {
  test('shows settings with no shop', async ({ page }) => {
    await page.goto('/settings');
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('No shops yet').or(page.getByText('Import Data'))).toBeVisible({ timeout: 5000 });
  });

  test('shows shop selector', async ({ page }) => {
    await page.evaluate((opts: Record<string, unknown>) => dbShop(opts), { name: 'T', username: 't' });
    await page.goto('/settings');
    await expect(page.getByText('T')).toBeVisible({ timeout: 10000 });
  });

  test('select shop shows Edit Shop', async ({ page }) => {
    const id = await page.evaluate((opts: Record<string, unknown>) => dbShop(opts), { name: 'E', username: 'e' });
    await page.evaluate((shopId: number) => { localStorage.setItem('microstore-active-shop', String(shopId)); }, id);
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('button', { name: 'Edit Shop' })).toBeVisible({ timeout: 5000 });
  });

  test('edit mode shows form fields', async ({ page }) => {
    const id = await page.evaluate((opts: Record<string, unknown>) => dbShop(opts), { name: 'M', username: 'm' });
    await page.evaluate((shopId: number) => { localStorage.setItem('microstore-active-shop', String(shopId)); }, id);
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: 'Edit Shop' }).click();
    await expect(page.getByLabel('Shop name')).toBeVisible({ timeout: 5000 });
    await expect(page.getByLabel('Username')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Cancel' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save' })).toBeVisible();
  });

  test('import section visible', async ({ page }) => {
    await page.goto('/settings');
    await expect(page.getByText('Import Data')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Choose File')).toBeVisible();
  });

  test('export button visible', async ({ page }) => {
    const id = await page.evaluate((opts: Record<string, unknown>) => dbShop(opts), { name: 'X', username: 'x' });
    await page.evaluate((shopId: number) => { localStorage.setItem('microstore-active-shop', String(shopId)); }, id);
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('button', { name: /export/i })).toBeVisible({ timeout: 5000 });
  });

  test('delete section visible', async ({ page }) => {
    const id = await page.evaluate((opts: Record<string, unknown>) => dbShop(opts), { name: 'D', username: 'd' });
    await page.evaluate((shopId: number) => { localStorage.setItem('microstore-active-shop', String(shopId)); }, id);
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('Danger Zone').or(page.getByRole('button', { name: /delete/i }))).toBeVisible({ timeout: 5000 });
  });
});
