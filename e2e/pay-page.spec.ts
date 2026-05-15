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

const dbOrder = (shopId: number, o: Record<string, unknown> = {}) => {
  const n = new Date();
  return new Promise<number>((res, rej) => {
    const r = indexedDB.open('MicrostoreDB');
    r.onsuccess = () => {
      const d = r.result;
      const t = d.transaction('orders', 'readwrite');
      const a = t.objectStore('orders').add({
        shopId,status:'pending',subtotal:10,tip:1,tipPercent:10,tax:0.89,
        charity:0,total:11.89,
        items:[{itemId:0,name:'X',price:10,quantity:1}],
        merchantWallet:'HN7cABqLq46Es1jh92dQQisAq662SmxELLLsHHe4YWrH',
        splTokenMint:'Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr',
        splTokenSymbol:'USDC',paymentRef:'t:'+Date.now(),
        createdAt:n,updatedAt:n,...o,
      });
      a.onsuccess = () => { res(a.result as number); d.close(); };
      a.onerror = () => { rej(a.error); d.close(); };
    };
    r.onerror = () => rej(r.error);
  });
};

test.describe('Pay Page', () => {
  test('no orderId shows no-payment', async ({ page }) => {
    await page.goto('/pay');
    await expect(page.getByText('No Payment Found')).toBeVisible({ timeout: 10000 });
  });

  test('invalid orderId shows error', async ({ page }) => {
    await page.goto('/pay?orderId=99999');
    await expect(page.getByText('Payment Not Found')).toBeVisible({ timeout: 10000 });
  });

  test('valid order renders payment page', async ({ page }) => {
    const sid = await page.evaluate((opts: Record<string, unknown>) => dbShop(opts), { name: 'P', username: 'p' });
    const oid = await page.evaluate(
      (opts: { shopId: number; overrides: Record<string, unknown> }) => dbOrder(opts.shopId, opts.overrides),
      { shopId: sid, overrides: { items: [{ itemId: 1, name: 'L', price: 5, quantity: 2 }] } },
    );
    await page.goto(`/pay?orderId=${oid}`);
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading', { name: 'Scan to Pay' })).toBeVisible({ timeout: 15000 });
  });

  test('paid order shows complete', async ({ page }) => {
    const sid = await page.evaluate((opts: Record<string, unknown>) => dbShop(opts), { name: 'A', username: 'a', taxAllocationEnabled: false });
    const oid = await page.evaluate(
      (opts: { shopId: number; overrides: Record<string, unknown> }) => dbOrder(opts.shopId, opts.overrides),
      {
        shopId: sid,
        overrides: {
          status: 'paid', subtotal: 5, tip: 0, tipPercent: 0, tax: 0, total: 5,
          items: [{ itemId: 1, name: 'C', price: 5, quantity: 1 }],
          txSignature: '5VERv6NMbE6V1BhvM1MYKnq4KqX6WrQqWJNqW8RoU9KE',
          confirmedAt: new Date(),
        },
      },
    );
    await page.goto(`/pay?orderId=${oid}`);
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading', { name: 'Payment Complete' })).toBeVisible({ timeout: 15000 });
  });
});
