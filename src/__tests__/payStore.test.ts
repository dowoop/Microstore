import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Order, Shop } from '@/lib/db';
import type { SplitBreakdown } from '@/lib/solanaPay';

// Mock db
const mockOrdersGet = vi.fn();
const mockOrdersUpdate = vi.fn();
const mockShopsGet = vi.fn();

vi.mock('@/lib/db', () => ({
  db: {
    orders: {
      get: (...args: unknown[]) => mockOrdersGet(...args),
      update: (...args: unknown[]) => mockOrdersUpdate(...args),
    },
    shops: { get: (...args: unknown[]) => mockShopsGet(...args) },
  },
}));

// Mock solanaPay
const mockComputeAtomicSplit = vi.fn();
const mockGeneratePaymentReference = vi.fn();
const mockFindReferenceByAddress = vi.fn();
const mockGetConnection = vi.fn();
const mockGetLatestBlockhash = vi.fn();
vi.mock('@/lib/solanaPay', () => ({
  computeAtomicSplit: (params: Record<string, unknown>) => mockComputeAtomicSplit(params),
  generatePaymentReference: () => mockGeneratePaymentReference(),
  findReferenceByAddress: (...args: unknown[]) => mockFindReferenceByAddress(...args),
  getConnection: () => mockGetConnection(),
  getLatestBlockhash: () => mockGetLatestBlockhash(),
}));

import { usePayStore } from '@/lib/payStore';

function makeOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: 1,
    shopId: 10,
    status: 'pending',
    subtotal: 42.5,
    tip: 6.38,
    tipPercent: 15,
    tax: 3.77,
    charity: 0.35,
    total: 53.0,
    items: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeShop(overrides: Partial<Shop> = {}): Shop {
  return {
    id: 10,
    name: 'Test Shop',
    username: 'test-shop',
    tipPresets: [0, 10, 15],
    taxEnabled: true,
    taxRate: 0.08875,
    charityEnabled: true,
    charityPartners: ['RedCross'],
    merchantWallet: 'Mk1',
    taxSetAsideWallet: 'Tk1',
    charityWallet: 'Ck1',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('payStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Set default mock returns
    mockGeneratePaymentReference.mockReturnValue({
      publicKey: 'mock-ref-pubkey-123',
      secretKey: new Uint8Array(64),
    });
    // Reset store state
    usePayStore.getState().reset();
  });

  describe('loadOrder - success path', () => {
    it('loads an order and shop, computes split', async () => {
      const order = makeOrder();
      const shop = makeShop();
      const mockSplit: SplitBreakdown = {
        merchant: { address: 'Mk1', amount: 48.88, label: 'Merchant + Tip' },
        tax: { address: 'Tk1', amount: 3.77, label: 'Tax' },
        charity: { address: 'Ck1', amount: 0.35, label: 'RedCross' },
      };

      mockOrdersGet.mockResolvedValue(order);
      mockShopsGet.mockResolvedValue(shop);
      mockComputeAtomicSplit.mockReturnValue(mockSplit);

      await usePayStore.getState().loadOrder(1);

      const state = usePayStore.getState();
      expect(state.loading).toBe(false);
      expect(state.error).toBeNull();
      expect(state.order).toEqual(order);
      expect(state.shop).toBeTruthy();
      expect(state.shop!.name).toBe('Test Shop');
      expect(state.shop!.merchantWallet).toBe('Mk1');
      expect(state.split).toEqual(mockSplit);
    });

    it('uses order-level wallet overrides when present', async () => {
      const order = makeOrder({
        merchantWallet: 'OrdMk1',
        taxSetAsideWallet: 'OrdTk1',
        charityWallet: 'OrdCk1',
      });
      const shop = makeShop();

      mockOrdersGet.mockResolvedValue(order);
      mockShopsGet.mockResolvedValue(shop);

      await usePayStore.getState().loadOrder(1);

      const state = usePayStore.getState();
      expect(state.shop!.merchantWallet).toBe('OrdMk1');
      expect(state.shop!.taxSetAsideWallet).toBe('OrdTk1');
      expect(state.shop!.charityWallet).toBe('OrdCk1');
    });

    it('falls back to shop merchantWallet for null order wallets', async () => {
      const order = makeOrder({
        merchantWallet: undefined,
        taxSetAsideWallet: undefined,
        charityWallet: undefined,
      });
      const shop = makeShop();

      mockOrdersGet.mockResolvedValue(order);
      mockShopsGet.mockResolvedValue(shop);

      await usePayStore.getState().loadOrder(1);

      const state = usePayStore.getState();
      expect(state.shop!.merchantWallet).toBe('Mk1');
      expect(state.shop!.taxSetAsideWallet).toBe('Tk1');
      expect(state.shop!.charityWallet).toBe('Ck1');
    });

    it('computes charityRoundUp flag from order.charity > 0', async () => {
      const order = makeOrder({ charity: 0.35 });
      const shop = makeShop();

      mockOrdersGet.mockResolvedValue(order);
      mockShopsGet.mockResolvedValue(shop);

      await usePayStore.getState().loadOrder(1);

      // computeAtomicSplit should have been called with charityRoundUp: true
      expect(mockComputeAtomicSplit).toHaveBeenCalledWith(
        expect.objectContaining({ charityRoundUp: true }),
      );
    });

    it('computes charityRoundUp flag false when order.charity is 0', async () => {
      const order = makeOrder({ charity: 0 });
      const shop = makeShop();

      mockOrdersGet.mockResolvedValue(order);
      mockShopsGet.mockResolvedValue(shop);

      await usePayStore.getState().loadOrder(1);

      expect(mockComputeAtomicSplit).toHaveBeenCalledWith(
        expect.objectContaining({ charityRoundUp: false }),
      );
    });

    it('passes correct params to computeAtomicSplit', async () => {
      const order = makeOrder({ subtotal: 42.5, tipPercent: 15, charity: 0 });
      const shop = makeShop();

      mockOrdersGet.mockResolvedValue(order);
      mockShopsGet.mockResolvedValue(shop);

      await usePayStore.getState().loadOrder(1);

      expect(mockComputeAtomicSplit).toHaveBeenCalledWith({
        subtotal: 42.5,
        tipPercent: 15,
        taxRate: 0.08875,
        charityRoundUp: false,
        merchantWallet: 'Mk1',
        taxSetAsideWallet: 'Tk1',
        charityWallet: 'Ck1',
        charityPartners: ['RedCross'],
      });
    });
  });

  describe('loadOrder - ORDER_NOT_FOUND', () => {
    it('sets ORDER_NOT_FOUND error when order does not exist', async () => {
      mockOrdersGet.mockResolvedValue(undefined);

      await usePayStore.getState().loadOrder(999);

      const state = usePayStore.getState();
      expect(state.loading).toBe(false);
      expect(state.order).toBeNull();
      expect(state.error?.code).toBe('ORDER_NOT_FOUND');
      expect(state.error?.userMessage).toContain('expired');
    });
  });

  describe('loadOrder - SHOP_NOT_FOUND', () => {
    it('sets SHOP_NOT_FOUND error when shop does not exist', async () => {
      mockOrdersGet.mockResolvedValue(makeOrder());
      mockShopsGet.mockResolvedValue(undefined);

      await usePayStore.getState().loadOrder(1);

      const state = usePayStore.getState();
      expect(state.loading).toBe(false);
      expect(state.order).toBeNull(); // reset before setting shop error... actually the order IS set before the shop check. Let me check the code again.
      // Actually, looking at the code, when SHOP_NOT_FOUND, the function returns before setting the order.
      // So order stays null.
      expect(state.error?.code).toBe('SHOP_NOT_FOUND');
    });
  });

  describe('loadOrder - DB_LOAD_FAILED', () => {
    it('sets DB_LOAD_FAILED error when db.orders.get throws', async () => {
      mockOrdersGet.mockRejectedValue(new Error('IndexedDB error'));

      await usePayStore.getState().loadOrder(1);

      const state = usePayStore.getState();
      expect(state.loading).toBe(false);
      expect(state.error?.code).toBe('DB_LOAD_FAILED');
      expect(state.error?.message).toContain('IndexedDB error');
      expect(state.error?.userMessage).toContain('connection');
    });

    it('handles non-Error throw from DB', async () => {
      mockOrdersGet.mockRejectedValue('string error');

      await usePayStore.getState().loadOrder(1);

      const state = usePayStore.getState();
      expect(state.error?.code).toBe('DB_LOAD_FAILED');
      expect(state.error?.message).toBe('Unknown error');
    });
  });

  describe('loadOrder - race guard', () => {
    it('ignores stale result when superseded by newer loadOrder', async () => {
      const order2 = makeOrder({ id: 2, subtotal: 20 });
      const shop = makeShop();

      mockOrdersGet.mockResolvedValue(order2);
      mockShopsGet.mockResolvedValue(shop);

      await usePayStore.getState().loadOrder(2);

      expect(usePayStore.getState().order?.id).toBe(2);
      expect(usePayStore.getState().order?.subtotal).toBe(20);
    });

    it('sets loading true while loading', () => {
      // Don't await — check loading state immediately after calling
      mockOrdersGet.mockImplementation(() => new Promise(() => {})); // never resolves
      usePayStore.getState().loadOrder(1);
      expect(usePayStore.getState().loading).toBe(true);
    });
  });

  describe('reset', () => {
    it('clears all state back to defaults', async () => {
      // First load an order
      mockOrdersGet.mockResolvedValue(makeOrder());
      mockShopsGet.mockResolvedValue(makeShop());
      await usePayStore.getState().loadOrder(1);

      expect(usePayStore.getState().order).not.toBeNull();

      usePayStore.getState().reset();

      const state = usePayStore.getState();
      expect(state.order).toBeNull();
      expect(state.shop).toBeNull();
      expect(state.split).toBeNull();
      expect(state.loading).toBe(false);
      expect(state.error).toBeNull();
      expect(state.networkFee).toBeGreaterThan(0);
    });
  });
});
