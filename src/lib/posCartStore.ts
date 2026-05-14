import { create } from 'zustand';
import type { Item } from '@/lib/db';

export interface CartItem {
  item: Item;
  quantity: number;
}

interface PosCartState {
  items: CartItem[];
  selectedTipPercent: number;
  charityRoundUp: boolean;
  taxAllocationEnabled: boolean;

  addItem: (item: Item) => void;
  removeItem: (itemId: number) => void;
  updateQuantity: (itemId: number, quantity: number) => void;
  clearCart: () => void;
  setSelectedTipPercent: (pct: number) => void;
  setCharityRoundUp: (enabled: boolean) => void;
  setTaxAllocationEnabled: (enabled: boolean) => void;

  // Computed (call these as getters via the hook)
  subtotal: () => number;
  tipAmount: () => number;
  taxAmount: () => number;
  charityAmount: () => number;
  total: () => number;
}

// Default tax rate: 8.875% (example — configurable per shop)
const TAX_RATE = 0.08875;

export const usePosCartStore = create<PosCartState>()((set, get) => ({
  items: [],
  selectedTipPercent: 0,
  charityRoundUp: false,
  taxAllocationEnabled: true,

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

  subtotal: () => {
    return get().items.reduce((sum, ci) => sum + ci.item.price * ci.quantity, 0);
  },

  tipAmount: () => {
    const { subtotal, selectedTipPercent } = get();
    return subtotal() * (selectedTipPercent / 100);
  },

  taxAmount: () => {
    const { subtotal, taxAllocationEnabled } = get();
    if (!taxAllocationEnabled) return 0;
    return subtotal() * TAX_RATE;
  },

  charityAmount: () => {
    const { charityRoundUp, subtotal, tipAmount, taxAmount } = get();
    if (!charityRoundUp) return 0;
    // Compute pre-charity total without calling total() to avoid circular recursion
    const preCharity = subtotal() + tipAmount() + taxAmount();
    return Math.ceil(preCharity) - preCharity;
  },

  total: () => {
    const { subtotal, tipAmount, taxAmount, charityAmount } = get();
    const sub = subtotal();
    const tip = tipAmount();
    const tax = taxAmount();
    const charity = charityAmount();
    // Round each component to 2dp before summing so the displayed total
    // consistently equals the sum of individually rounded split amounts
    const round2 = (n: number) => Math.round(n * 100) / 100;
    return round2(sub) + round2(tip) + round2(tax) + round2(charity);
  },
}));