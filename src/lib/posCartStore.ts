import { create } from 'zustand';
import type { Item } from '@/lib/db';
import { computeOrderTotals, type OrderTotals } from '@/lib/solanaPay';

export interface CartItem {
  item: Item;
  quantity: number;
}

interface PosCartState {
  items: CartItem[];
  selectedTipPercent: number;
  charityRoundUp: boolean;
  taxAllocationEnabled: boolean;
  /** Shop-level tax rate (decimal, e.g. 0.08875 for 8.875%). 0 = tax disabled. */
  taxRate: number;

  addItem: (item: Item) => void;
  removeItem: (itemId: number) => void;
  updateQuantity: (itemId: number, quantity: number) => void;
  clearCart: () => void;
  setSelectedTipPercent: (pct: number) => void;
  setCharityRoundUp: (enabled: boolean) => void;
  setTaxAllocationEnabled: (enabled: boolean) => void;
  setTaxRate: (rate: number) => void;

  // Computed (call these as getters via the hook)
  subtotal: () => number;
  /** Full computed totals via computeOrderTotals (single source of truth). */
  computedTotals: () => OrderTotals;
  tipAmount: () => number;
  taxAmount: () => number;
  charityAmount: () => number;
  total: () => number;
}

export const usePosCartStore = create<PosCartState>()((set, get) => ({
  items: [],
  selectedTipPercent: 0,
  charityRoundUp: false,
  taxAllocationEnabled: true,
  taxRate: 0,

  addItem: (item: Item) => {
    const current = get().items;
    const existing = current.find((ci) => ci.item.id === item.id);
    if (existing) {
      set({
        items: current.map((ci) =>
          ci.item.id === item.id
            ? { ...ci, quantity: ci.quantity + 1 }
            : ci
        ),
      });
    } else {
      set({ items: [...current, { item, quantity: 1 }] });
    }
  },

  removeItem: (itemId: number) => {
    set({ items: get().items.filter((ci) => ci.item.id !== itemId) });
  },

  updateQuantity: (itemId: number, quantity: number) => {
    if (quantity <= 0) {
      get().removeItem(itemId);
      return;
    }
    set({
      items: get().items.map((ci) =>
        ci.item.id === itemId ? { ...ci, quantity } : ci
      ),
    });
  },

  clearCart: () => set({ items: [], selectedTipPercent: 0, charityRoundUp: false }),

  setSelectedTipPercent: (pct: number) => set({ selectedTipPercent: pct }),

  setCharityRoundUp: (enabled: boolean) => set({ charityRoundUp: enabled }),

  setTaxAllocationEnabled: (enabled: boolean) => set({ taxAllocationEnabled: enabled }),

  setTaxRate: (rate: number) => set({ taxRate: rate }),

  subtotal: () => {
    return get().items.reduce((sum, ci) => sum + ci.item.price * ci.quantity, 0);
  },

  computedTotals: () => {
    const { subtotal, selectedTipPercent, taxAllocationEnabled, charityRoundUp, taxRate } = get();
    return computeOrderTotals({
      subtotal: subtotal(),
      tipPercent: selectedTipPercent,
      taxRate: taxAllocationEnabled ? taxRate : 0,
      charityRoundUp,
    });
  },

  tipAmount: () => {
    return get().computedTotals().tip;
  },

  taxAmount: () => {
    return get().computedTotals().tax;
  },

  charityAmount: () => {
    return get().computedTotals().charity;
  },

  total: () => {
    return get().computedTotals().total;
  },
}));
