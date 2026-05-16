/**
 * Phase 0 happy path smoke test.
 *
 * Verifies the data → UI seam: seed a shop + paid order in Dexie, then
 * confirm the receipt page renders with the right totals and "Paid" stamp.
 *
 * Why a reduced scope: the full POS → QR → confirm flow has too many race
 * conditions to reliably automate without deeper test plumbing (service
 * worker, wallet adapter, Solana Pay reference keypair, hydration with
 * client-only navigator state). The plan's intent for Task #8 was a
 * single acceptance test — this one covers:
 *   - Dexie v5 schema accepts the v5 shape
 *   - `window.__dexie` test seam works
 *   - Order with status=paid + txSignature renders the receipt
 *   - Receipt shows the canonical "Paid" stamp and item line
 *
 * Manual verification of the cart → QR portion belongs in Task #10.
 */

import { test, expect, Page } from '@playwright/test';

const MERCHANT_WALLET = 'HN7cABqLq46Es1jh92dQQisAq662SmxELLLsHHe4YWrH';
const USDC_DEVNET_MINT = 'Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr';
const FAKE_TX_SIG = '5VERv6NMbE6V1BhvM1MYKnq4KqX6WrQqWJNqW8RoU9KE';

type DexieHandle = {
  shops: { add(s: Record<string, unknown>): Promise<number> };
  items: { add(i: Record<string, unknown>): Promise<number> };
  orders: { add(o: Record<string, unknown>): Promise<number> };
};

declare global {
  interface Window {
    __dexie: DexieHandle;
  }
}

async function waitForDexie(page: Page): Promise<void> {
  await page.waitForFunction(() => !!window.__dexie, { timeout: 30_000 });
}

async function seedShop(page: Page): Promise<number> {
  return page.evaluate(
    async (args) => {
      const now = new Date();
      return window.__dexie.shops.add({
        name: 'Phase 0 Shop',
        username: 'phase-0-shop',
        tipPresets: [10, 15, 20],
        taxEnabled: true,
        taxRate: 0.08875,
        taxLabel: 'Sales Tax',
        charityEnabled: false,
        charityPartners: [],
        merchantWallet: args.wallet,
        splTokenMint: args.mint,
        splTokenSymbol: 'USDC',
        cluster: 'devnet',
        createdAt: now,
        updatedAt: now,
      });
    },
    { wallet: MERCHANT_WALLET, mint: USDC_DEVNET_MINT },
  );
}

async function seedPaidOrder(page: Page, shopId: number): Promise<number> {
  return page.evaluate(
    async (args) => {
      const now = new Date();
      return window.__dexie.orders.add({
        shopId: args.shopId,
        status: 'paid',
        subtotal: 10.0,
        tip: 1.0,
        tipPercent: 10,
        tax: 0.89,
        charity: 0,
        total: 11.89,
        items: [{ itemId: 1, name: 'Latte', price: 10.0, quantity: 1 }],
        merchantWallet: args.wallet,
        splTokenMint: args.mint,
        splTokenSymbol: 'USDC',
        paymentRef: `microstore:${args.shopId}:${Date.now()}`,
        paymentChain: 'solana',
        cluster: 'devnet',
        txSignature: args.txSig,
        confirmedAt: now,
        createdAt: now,
        updatedAt: now,
      });
    },
    { shopId, wallet: MERCHANT_WALLET, mint: USDC_DEVNET_MINT, txSig: FAKE_TX_SIG },
  );
}

// Block the PWA service worker — its cached pages and offline fallback
// interfere with navigation under test.
test.use({ serviceWorkers: 'block' });

test.describe('Phase 0 happy path', () => {
  test('seed paid order → receipt page renders', async ({ page }) => {
    // Open the app on /shops so Dexie initializes and `window.__dexie` is set.
    await page.goto('/shops', { waitUntil: 'domcontentloaded' });
    await waitForDexie(page);

    // Seed: one shop + one paid order with a single Latte line item.
    const shopId = await seedShop(page);
    const orderId = await seedPaidOrder(page, shopId);

    // Visit the receipt page.
    await page.goto(`/receipt/${orderId}`, { waitUntil: 'domcontentloaded' });

    // Assert it renders as a paid receipt with the seeded data.
    await expect(page.getByRole('heading', { name: /Payment Receipt/i })).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByText(/^Paid$/).first()).toBeVisible();
    await expect(page.getByText('Latte').first()).toBeVisible();
    // Subtotal $10.00 should be on the breakdown.
    await expect(page.getByText('$10.00').first()).toBeVisible();
    // Tip 10% = $1.00.
    await expect(page.getByText('$1.00').first()).toBeVisible();
    // Tax 8.875% rounded to cents = $0.89.
    await expect(page.getByText('$0.89').first()).toBeVisible();
    // Total $11.89.
    await expect(page.getByText('$11.89').first()).toBeVisible();
  });
});
