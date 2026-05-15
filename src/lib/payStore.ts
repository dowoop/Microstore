import { create } from 'zustand';
import { db, type Order } from '@/lib/db';
import {
  computeAtomicSplit,
  type SplitBreakdown,
} from '@/lib/solanaPay';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PayState {
  // The order being processed
  order: Order | null;
  shop: {
    name: string;
    merchantWallet: string;
    taxWallet: string;
    charityWallet: string;
    charityPartners: string[];
    splTokenSymbol: string;
    taxAllocationEnabled: boolean;
    charityEnabled: boolean;
  } | null;
  split: SplitBreakdown | null;
  networkFee: number;         // estimated SOL network fee in USD
  loading: boolean;
  error: string | null;

  // Actions
  loadOrder: (orderId: number) => Promise<void>;
  reset: () => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

// Estimated Solana transaction fee (0.000005 SOL * ~$150 SOL price)
// In reality this is negligible; show it for transparency
const ESTIMATED_NETWORK_FEE_USD = 0.001;

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

// Monotonically increasing counter to guard against stale async callbacks.
// If loadOrder() is called rapidly with different orderIds, earlier calls
// bail at each await checkpoint so they don't overwrite later state.
let loadRequestId = 0;

export const usePayStore = create<PayState>()((set) => ({
  order: null,
  shop: null,
  split: null,
  networkFee: ESTIMATED_NETWORK_FEE_USD,
  loading: false,
  error: null,

  loadOrder: async (orderId: number) => {
    const thisRequestId = ++loadRequestId;
    set({ loading: true, error: null });

    try {
      const order = await db.orders.get(orderId);
      if (thisRequestId !== loadRequestId) return; // superseded
      if (!order) {
        set({ loading: false, error: `Order #${orderId} not found.` });
        return;
      }

      const shopRecord = await db.shops.get(order.shopId);
      if (thisRequestId !== loadRequestId) return; // superseded
      if (!shopRecord) {
        set({ loading: false, error: `Shop for order #${orderId} not found.` });
        return;
      }

      const shop = {
        name: shopRecord.name,
        merchantWallet: order.merchantWallet ?? shopRecord.merchantWallet ?? '',
        taxWallet: order.taxWallet ?? shopRecord.taxWallet ?? shopRecord.merchantWallet ?? '',
        charityWallet: order.charityWallet ?? shopRecord.charityWallet ?? shopRecord.merchantWallet ?? '',
        charityPartners: shopRecord.charityPartners ?? [],
        splTokenSymbol: order.splTokenSymbol ?? shopRecord.splTokenSymbol ?? 'SPL',
        taxAllocationEnabled: shopRecord.taxAllocationEnabled,
        charityEnabled: shopRecord.charityEnabled,
      };

      // Compute the atomic split breakdown from the order's stored values
      const split = computeAtomicSplit({
        subtotal: order.subtotal,
        tipPercent: order.tipPercent,
        taxRate: 0.08875,
        charityRoundUp: order.charity > 0,
        merchantWallet: shop.merchantWallet,
        taxWallet: shop.taxWallet,
        charityWallet: shop.charityWallet,
        charityPartners: shop.charityPartners,
      });

      set({ order, shop, split, loading: false });
    } catch (err) {
      console.error('Pay store loadOrder error:', err);
      set({
        loading: false,
        error: err instanceof Error ? err.message : 'Failed to load order.',
      });
    }
  },

  reset: () => {
    set({
      order: null,
      shop: null,
      split: null,
      networkFee: ESTIMATED_NETWORK_FEE_USD,
      loading: false,
      error: null,
    });
  },
}));
