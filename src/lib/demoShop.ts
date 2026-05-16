import { db } from '@/lib/db';
import { useAppStore } from '@/lib/store';

/** USDC devnet mint — matches the known token in solanaTokens.ts */
const USDC_DEVNET_MINT = 'Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr';

/** Throwaway devnet merchant wallet. Not a real keypair — demo only. */
const DEMO_MERCHANT_WALLET = '2uVfLpMdaLaKx9dAXV7UjqML1j7VxPfM7gJDi9bjNwXX';

export interface DemoItem {
  name: string;
  price: number;
  stock: number;
}

const DEMO_ITEMS: DemoItem[] = [
  { name: 'Espresso', price: 3.5, stock: 50 },
  { name: 'Latte', price: 4.5, stock: 30 },
  { name: 'Croissant', price: 5.0, stock: 20 },
];

/**
 * Seed a demo shop ("Sample Coffee Cart") with three items.
 * Only seeds if no shops exist in Dexie yet.
 * Returns the new shop ID, or null if shops already exist.
 */
export async function seedDemoShop(): Promise<number | null> {
  const existingCount = await db.shops.count();
  if (existingCount > 0) return null;

  const shopId = (await db.shops.add({
    name: 'Sample Coffee Cart',
    username: 'demo-coffee-cart',
    tipPresets: [0, 10, 15, 20],
    reserveAllocationEnabled: false,
    reserveRate: 0,
    charityEnabled: false,
    charityPartners: [],
    merchantWallet: DEMO_MERCHANT_WALLET,
    acceptedTokens: [
      {
        mint: USDC_DEVNET_MINT,
        symbol: 'USDC',
        decimals: 6,
        name: 'USD Coin (Devnet)',
      },
    ],
    splTokenMint: USDC_DEVNET_MINT,
    splTokenSymbol: 'USDC',
    isDemo: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  })) as number;

  const now = new Date();
  for (const item of DEMO_ITEMS) {
    await db.items.add({
      shopId,
      type: 'product',
      name: item.name,
      price: item.price,
      stock: item.stock,
      status: 'live',
      listingRules: { enabled: false },
      createdAt: now,
      updatedAt: now,
    });
  }

  useAppStore.getState().setActiveShopId(shopId);
  return shopId;
}
