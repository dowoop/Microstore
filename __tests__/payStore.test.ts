import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { usePayStore } from '@/lib/payStore';
import { db } from '@/lib/db';
import { computeAtomicSplit } from '@/lib/solanaPay';
import type { Order, Shop } from '@/lib/db';

// Mock the db module
vi.mock('@/lib/db', () => ({
  db: {
    orders: { get: vi.fn(), update: vi.fn() },
    shops: { get: vi.fn() },
  },
}));

// Mock computeAtomicSplit
vi.mock('@/lib/solanaPay', () => ({
  computeAtomicSplit: vi.fn(),
  getConnection: vi.fn(),
  generatePaymentReference: vi.fn(() => ({ publicKey: 'mock-ref-pubkey', secretKey: new Uint8Array(64) })),
  findReferenceByAddress: vi.fn(),
  getLatestBlockhash: vi.fn(),
  buildAtomicSplitTransaction: vi.fn(),
  createSolanaPayURL: vi.fn(),
  generateQRCode: vi.fn(),
  serializeTransactionForQR: vi.fn(),
  fetchWalletBalance: vi.fn(),
  fetchTokenBalances: vi.fn(),
  fetchWalletBalances: vi.fn(),
  fetchTokenBalance: vi.fn(),
  checkSufficientBalance: vi.fn(),
  detectNetworkMismatch: vi.fn(),
  networkName: vi.fn(),
  formatWalletError: vi.fn(),
  sendWithBlockhashRetry: vi.fn(),
  BlockhashRetryExhaustedError: class extends Error {},
}));

const mockOrder: Order = {
  id: 42,
  shopId: 1,
  status: 'pending',
  subtotal: 25.00,
  tip: 2.50,
  tipPercent: 10,
  tax: 2.22,
  charity: 0.03,
  total: 29.75,
  items: [{ itemId: 1, name: 'Coffee', price: 25, quantity: 1 }],
  merchantWallet: 'Merch1111111111111111111111111111111111111111',
  taxWallet: 'Tax2222222222222222222222222222222222222222',
  charityWallet: 'Char3333333333333333333333333333333333333333',
  splTokenSymbol: 'USDC',
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockShop: Shop = {
  id: 1,
  name: 'Test Cafe',
  username: 'test-cafe',
  tipPresets: [0, 10, 15, 20],
  taxAllocationEnabled: true,
  taxRate: 0.08875,
  charityEnabled: true,
  charityPartners: ['GiveDirectly'],
  merchantWallet: 'Merch1111111111111111111111111111111111111111',
  taxWallet: 'Tax2222222222222222222222222222222222222222',
  charityWallet: 'Char3333333333333333333333333333333333333333',
  splTokenMint: 'Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr',
  splTokenSymbol: 'USDC',
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockSplit = {
  merchant: { address: 'Merch1111111111111111111111111111111111111111', amount: 27.50, label: 'Merchant + Tip' },
  tax: { address: 'Tax2222222222222222222222222222222222222222', amount: 2.22, label: 'Tax' },
  charity: { address: 'Char3333333333333333333333333333333333333333', amount: 0.03, label: 'GiveDirectly' },
};

beforeEach(() => {
  vi.clearAllMocks();
  // Reset the store to initial state
  usePayStore.getState().reset();
});

describe('payStore', () => {
  describe('loadOrder - success', () => {
    it('loads an order, shop, and computes split', async () => {
      vi.mocked(db.orders.get).mockResolvedValue(mockOrder);
      vi.mocked(db.shops.get).mockResolvedValue(mockShop);
      vi.mocked(computeAtomicSplit).mockReturnValue(mockSplit);

      await usePayStore.getState().loadOrder(42);

      const state = usePayStore.getState();
      expect(state.loading).toBe(false);
      expect(state.error).toBeNull();
      expect(state.order).toEqual(mockOrder);
      expect(state.shop).toEqual({
        name: 'Test Cafe',
        merchantWallet: 'Merch1111111111111111111111111111111111111111',
        taxWallet: 'Tax2222222222222222222222222222222222222222',
        charityWallet: 'Char3333333333333333333333333333333333333333',
        charityPartners: ['GiveDirectly'],
        splTokenSymbol: 'USDC',
        taxAllocationEnabled: true,
        charityEnabled: true,
      });
      expect(state.split).toEqual(mockSplit);
    });

    it('calls computeAtomicSplit with correct parameters', async () => {
      vi.mocked(db.orders.get).mockResolvedValue(mockOrder);
      vi.mocked(db.shops.get).mockResolvedValue(mockShop);
      vi.mocked(computeAtomicSplit).mockReturnValue(mockSplit);

      await usePayStore.getState().loadOrder(42);

      expect(computeAtomicSplit).toHaveBeenCalledWith({
        subtotal: 25.00,
        tipPercent: 10,
        taxRate: 0.08875,
        charityRoundUp: true,
        merchantWallet: 'Merch1111111111111111111111111111111111111111',
        taxWallet: 'Tax2222222222222222222222222222222222222222',
        charityWallet: 'Char3333333333333333333333333333333333333333',
        charityPartners: ['GiveDirectly'],
      });
    });

    it('uses order-level wallet overrides when present', async () => {
      const orderWithWalletOverrides = {
        ...mockOrder,
        merchantWallet: 'OrderMerch9999999999999999999999999999999999',
      };
      vi.mocked(db.orders.get).mockResolvedValue(orderWithWalletOverrides);
      vi.mocked(db.shops.get).mockResolvedValue(mockShop);
      vi.mocked(computeAtomicSplit).mockReturnValue(mockSplit);

      await usePayStore.getState().loadOrder(42);

      const state = usePayStore.getState();
      expect(state.shop!.merchantWallet).toBe('OrderMerch9999999999999999999999999999999999');
    });
  });

  describe('loadOrder - ORDER_NOT_FOUND', () => {
    it('sets error when order does not exist', async () => {
      vi.mocked(db.orders.get).mockResolvedValue(undefined);

      await usePayStore.getState().loadOrder(99);

      const state = usePayStore.getState();
      expect(state.loading).toBe(false);
      expect(state.error).toEqual({
        code: 'ORDER_NOT_FOUND',
        message: 'Order #99 not found in local database.',
        userMessage:
          'This payment link has expired or the order was deleted. Please ask the merchant for a new payment link.',
      });
      expect(state.order).toBeNull();
    });
  });

  describe('loadOrder - SHOP_NOT_FOUND', () => {
    it('sets error when shop does not exist', async () => {
      vi.mocked(db.orders.get).mockResolvedValue(mockOrder);
      vi.mocked(db.shops.get).mockResolvedValue(undefined);

      await usePayStore.getState().loadOrder(42);

      const state = usePayStore.getState();
      expect(state.loading).toBe(false);
      expect(state.error).toEqual({
        code: 'SHOP_NOT_FOUND',
        message: 'Shop for order #42 not found.',
        userMessage: 'The shop associated with this order no longer exists.',
      });
    });
  });

  describe('loadOrder - DB_LOAD_FAILED', () => {
    it('sets error when db throws', async () => {
      vi.mocked(db.orders.get).mockRejectedValue(new Error('IndexedDB error'));

      await usePayStore.getState().loadOrder(42);

      const state = usePayStore.getState();
      expect(state.loading).toBe(false);
      expect(state.error).toEqual({
        code: 'DB_LOAD_FAILED',
        message: 'IndexedDB error',
        userMessage: 'Failed to load payment details. Please check your connection and try again.',
      });
    });
  });

  describe('loadOrder - race guard', () => {
    it('ignores stale response when a newer loadOrder is in flight', async () => {
      // First loadOrder: slow - order not found
      vi.mocked(db.orders.get).mockResolvedValueOnce(undefined)
                               .mockResolvedValueOnce(mockOrder);
      vi.mocked(db.shops.get).mockResolvedValue(mockShop);
      vi.mocked(computeAtomicSplit).mockReturnValue(mockSplit);

      // Start first loadOrder (will get ORDER_NOT_FOUND)
      const firstPromise = usePayStore.getState().loadOrder(1);

      // Start second loadOrder immediately
      const secondPromise = usePayStore.getState().loadOrder(42);

      await Promise.all([firstPromise, secondPromise]);

      // The second call should win — state should reflect order 42
      const state = usePayStore.getState();
      expect(state.order).not.toBeNull();
      expect(state.order!.id).toBe(42);
      expect(state.error).toBeNull();
    });
  });

  describe('reset', () => {
    it('resets the store to initial state', async () => {
      vi.mocked(db.orders.get).mockResolvedValue(mockOrder);
      vi.mocked(db.shops.get).mockResolvedValue(mockShop);
      vi.mocked(computeAtomicSplit).mockReturnValue(mockSplit);

      await usePayStore.getState().loadOrder(42);

      usePayStore.getState().reset();

      const state = usePayStore.getState();
      expect(state.order).toBeNull();
      expect(state.shop).toBeNull();
      expect(state.split).toBeNull();
      expect(state.loading).toBe(false);
      expect(state.error).toBeNull();
      expect(state.networkFee).toBe(0.001);
    });
  });
});
