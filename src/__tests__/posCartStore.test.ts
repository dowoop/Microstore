import { describe, it, expect, beforeEach } from 'vitest';
import { usePosCartStore } from '@/lib/posCartStore';
import type { Item } from '@/lib/db';

function makeItem(overrides: Partial<Item> = {}): Item {
  return {
    id: 1,
    shopId: 1,
    type: 'product',
    name: 'Test Item',
    price: 9.99,
    stock: 100,
    status: 'live',
    listingRules: { enabled: false },
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeItem2(): Item {
  return makeItem({ id: 2, name: 'Item Two', price: 4.50 });
}

describe('posCartStore', () => {
  beforeEach(() => {
    usePosCartStore.getState().clearCart();
  });

  describe('addItem', () => {
    it('adds a new item with quantity 1', () => {
      const item = makeItem();
      usePosCartStore.getState().addItem(item);
      const state = usePosCartStore.getState();
      expect(state.items).toHaveLength(1);
      expect(state.items[0].quantity).toBe(1);
      expect(state.items[0].item.id).toBe(1);
    });

    it('increments quantity when adding existing item', () => {
      const item = makeItem();
      usePosCartStore.getState().addItem(item);
      usePosCartStore.getState().addItem(item);
      usePosCartStore.getState().addItem(item);
      const state = usePosCartStore.getState();
      expect(state.items).toHaveLength(1);
      expect(state.items[0].quantity).toBe(3);
    });

    it('adds multiple distinct items', () => {
      usePosCartStore.getState().addItem(makeItem());
      usePosCartStore.getState().addItem(makeItem2());
      expect(usePosCartStore.getState().items).toHaveLength(2);
    });
  });

  describe('removeItem', () => {
    it('removes an item by id', () => {
      usePosCartStore.getState().addItem(makeItem());
      usePosCartStore.getState().addItem(makeItem2());
      usePosCartStore.getState().removeItem(1);
      const state = usePosCartStore.getState();
      expect(state.items).toHaveLength(1);
      expect(state.items[0].item.id).toBe(2);
    });

    it('does nothing if item id not in cart', () => {
      usePosCartStore.getState().addItem(makeItem());
      usePosCartStore.getState().removeItem(999);
      expect(usePosCartStore.getState().items).toHaveLength(1);
    });
  });

  describe('updateQuantity', () => {
    it('updates quantity of an item', () => {
      usePosCartStore.getState().addItem(makeItem());
      usePosCartStore.getState().updateQuantity(1, 5);
      expect(usePosCartStore.getState().items[0].quantity).toBe(5);
    });

    it('removes item when quantity is 0', () => {
      usePosCartStore.getState().addItem(makeItem());
      usePosCartStore.getState().updateQuantity(1, 0);
      expect(usePosCartStore.getState().items).toHaveLength(0);
    });

    it('removes item when quantity is negative', () => {
      usePosCartStore.getState().addItem(makeItem());
      usePosCartStore.getState().updateQuantity(1, -1);
      expect(usePosCartStore.getState().items).toHaveLength(0);
    });
  });

  describe('clearCart', () => {
    it('empties items and resets tip and charity', () => {
      const store = usePosCartStore.getState();
      store.addItem(makeItem());
      store.setSelectedTipPercent(15);
      store.setCharityRoundUp(true);
      store.clearCart();
      const state = usePosCartStore.getState();
      expect(state.items).toHaveLength(0);
      expect(state.selectedTipPercent).toBe(0);
      expect(state.charityRoundUp).toBe(false);
    });
  });

  describe('computed totals', () => {
    it('computes subtotal as sum of item prices * quantities', () => {
      usePosCartStore.getState().addItem(makeItem({ price: 10 }));
      usePosCartStore.getState().addItem(makeItem({ id: 2, price: 5 }));
      usePosCartStore.getState().updateQuantity(2, 3); // 5 * 3 = 15
                                                     // total: 10 + 15 = 25
      const subtotal = usePosCartStore.getState().subtotal();
      expect(subtotal).toBe(25);
    });

    it('computes tip amount from selected percentage', () => {
      usePosCartStore.getState().addItem(makeItem({ price: 100 }));
      usePosCartStore.getState().setSelectedTipPercent(20);
      const tip = usePosCartStore.getState().tipAmount();
      expect(tip).toBe(20);
    });

    it('returns 0 tip when percentage is 0', () => {
      usePosCartStore.getState().addItem(makeItem({ price: 100 }));
      usePosCartStore.getState().setSelectedTipPercent(0);
      expect(usePosCartStore.getState().tipAmount()).toBe(0);
    });

    it('computes tax at 8.875% when enabled', () => {
      usePosCartStore.getState().addItem(makeItem({ price: 100 }));
      // taxRate is 0.08875
      expect(usePosCartStore.getState().taxAmount()).toBeCloseTo(8.875);
    });

    it('returns 0 tax when tax allocation disabled', () => {
      usePosCartStore.getState().addItem(makeItem({ price: 100 }));
      usePosCartStore.getState().setTaxAllocationEnabled(false);
      expect(usePosCartStore.getState().taxAmount()).toBe(0);
    });

    it('computes charity round-up when enabled', () => {
      // subtotal = 10, tip = 1, tax = 0.8875
      // preCharity = 10 + 1 + 0.8875 = 11.8875
      // ceil(11.8875) = 12, charity = 12 - 11.8875 = 0.1125
      usePosCartStore.getState().addItem(makeItem({ price: 10 }));
      usePosCartStore.getState().setSelectedTipPercent(10);
      usePosCartStore.getState().setCharityRoundUp(true);
      expect(usePosCartStore.getState().charityAmount()).toBeCloseTo(0.1125);
    });

    it('returns 0 charity when disabled', () => {
      usePosCartStore.getState().addItem(makeItem({ price: 10 }));
      usePosCartStore.getState().setSelectedTipPercent(10);
      expect(usePosCartStore.getState().charityAmount()).toBe(0);
    });

    it('computes total as rounded sum of all components', () => {
      // Price = 9.99, qty = 2 => subtotal = 19.98
      usePosCartStore.getState().addItem(makeItem({ price: 9.99 }));
      usePosCartStore.getState().updateQuantity(1, 2);
      usePosCartStore.getState().setSelectedTipPercent(15); // tip = 19.98 * 0.15 = 2.997
      // tax = 19.98 * 0.08875 = 1.773225
      // preCharity = 19.98 + 2.997 + 1.773225 = 24.750225
      // charity = ceil(24.750225) - 24.750225 = 25 - 24.750225 = 0.249775
      const total = usePosCartStore.getState().total();
      // rounded components: round(19.98) + round(2.997) + round(1.773225) + round(0.249775)
      // = 19.98 + 3.00 + 1.77 + 0.25 = 25.00
      expect(total).toBeGreaterThan(0);
      // Verify total is sum of individually rounded components
      const state = usePosCartStore.getState();
      const sub = state.subtotal();
      const tip = state.tipAmount();
      const tax = state.taxAmount();
      const charity = state.charityAmount();
      const round2 = (n: number) => Math.round(n * 100) / 100;
      expect(state.total()).toBe(round2(sub) + round2(tip) + round2(tax) + round2(charity));
    });

    it('total equals subtotal when no tip, no tax, no charity', () => {
      usePosCartStore.getState().addItem(makeItem({ price: 10 }));
      usePosCartStore.getState().setTaxAllocationEnabled(false);
      usePosCartStore.getState().setSelectedTipPercent(0);
      usePosCartStore.getState().setCharityRoundUp(false);
      expect(usePosCartStore.getState().total()).toBe(10);
    });
  });

  describe('getters', () => {
    it('setSelectedTipPercent updates the percentage', () => {
      usePosCartStore.getState().setSelectedTipPercent(25);
      expect(usePosCartStore.getState().selectedTipPercent).toBe(25);
    });

    it('setCharityRoundUp toggles charity', () => {
      expect(usePosCartStore.getState().charityRoundUp).toBe(false);
      usePosCartStore.getState().setCharityRoundUp(true);
      expect(usePosCartStore.getState().charityRoundUp).toBe(true);
    });

    it('setTaxAllocationEnabled toggles tax', () => {
      expect(usePosCartStore.getState().taxAllocationEnabled).toBe(true);
      usePosCartStore.getState().setTaxAllocationEnabled(false);
      expect(usePosCartStore.getState().taxAllocationEnabled).toBe(false);
    });
  });

  describe('cart with empty items', () => {
    it('returns 0 for all computed values when cart is empty', () => {
      expect(usePosCartStore.getState().subtotal()).toBe(0);
      expect(usePosCartStore.getState().tipAmount()).toBe(0);
      expect(usePosCartStore.getState().taxAmount()).toBe(0);
      expect(usePosCartStore.getState().charityAmount()).toBe(0);
      expect(usePosCartStore.getState().total()).toBe(0);
    });
  });
});
