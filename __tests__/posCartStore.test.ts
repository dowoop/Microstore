import { describe, it, expect, beforeEach } from 'vitest';
import { usePosCartStore } from '@/lib/posCartStore';
import type { Item } from '@/lib/db';

const makeItem = (overrides: Partial<Item> = {}): Item => ({
  id: 1,
  shopId: 1,
  type: 'product',
  name: 'Latte',
  price: 5.00,
  stock: 100,
  status: 'live',
  listingRules: { enabled: false },
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

beforeEach(() => {
  usePosCartStore.getState().clearCart();
  // clearCart doesn't reset taxAllocationEnabled — restore default
  usePosCartStore.getState().setTaxAllocationEnabled(true);
  // Set default tax rate to match old hardcoded 8.875% for backward test compat
  usePosCartStore.getState().setTaxRate(0.08875);
});

describe('posCartStore', () => {
  describe('addItem', () => {
    it('adds a new item to the cart', () => {
      const item = makeItem();
      usePosCartStore.getState().addItem(item);

      const state = usePosCartStore.getState();
      expect(state.items).toHaveLength(1);
      expect(state.items[0]).toEqual({ item, quantity: 1 });
    });

    it('increments quantity when adding an existing item', () => {
      const item = makeItem();
      usePosCartStore.getState().addItem(item);
      usePosCartStore.getState().addItem(item);

      const state = usePosCartStore.getState();
      expect(state.items).toHaveLength(1);
      expect(state.items[0].quantity).toBe(2);
    });

    it('adds multiple different items', () => {
      usePosCartStore.getState().addItem(makeItem({ id: 1, name: 'Latte', price: 5 }));
      usePosCartStore.getState().addItem(makeItem({ id: 2, name: 'Mocha', price: 6 }));

      const state = usePosCartStore.getState();
      expect(state.items).toHaveLength(2);
      expect(state.items[0].item.name).toBe('Latte');
      expect(state.items[1].item.name).toBe('Mocha');
    });
  });

  describe('removeItem', () => {
    it('removes an item from the cart', () => {
      usePosCartStore.getState().addItem(makeItem({ id: 1 }));
      usePosCartStore.getState().addItem(makeItem({ id: 2 }));

      usePosCartStore.getState().removeItem(1);

      const state = usePosCartStore.getState();
      expect(state.items).toHaveLength(1);
      expect(state.items[0].item.id).toBe(2);
    });

    it('does nothing when removing a non-existent item', () => {
      usePosCartStore.getState().addItem(makeItem({ id: 1 }));
      usePosCartStore.getState().removeItem(99);

      expect(usePosCartStore.getState().items).toHaveLength(1);
    });
  });

  describe('updateQuantity', () => {
    it('updates quantity of an existing item', () => {
      usePosCartStore.getState().addItem(makeItem({ id: 1 }));
      usePosCartStore.getState().updateQuantity(1, 5);

      expect(usePosCartStore.getState().items[0].quantity).toBe(5);
    });

    it('removes item when quantity is set to 0', () => {
      usePosCartStore.getState().addItem(makeItem({ id: 1 }));
      usePosCartStore.getState().updateQuantity(1, 0);

      expect(usePosCartStore.getState().items).toHaveLength(0);
    });

    it('removes item when quantity is negative', () => {
      usePosCartStore.getState().addItem(makeItem({ id: 1 }));
      usePosCartStore.getState().updateQuantity(1, -3);

      expect(usePosCartStore.getState().items).toHaveLength(0);
    });
  });

  describe('clearCart', () => {
    it('clears all items and resets tip/charity', () => {
      usePosCartStore.getState().addItem(makeItem({ id: 1 }));
      usePosCartStore.getState().setSelectedTipPercent(15);
      usePosCartStore.getState().setCharityRoundUp(true);

      usePosCartStore.getState().clearCart();

      const state = usePosCartStore.getState();
      expect(state.items).toHaveLength(0);
      expect(state.selectedTipPercent).toBe(0);
      expect(state.charityRoundUp).toBe(false);
    });
  });

  describe('tip and charity setters', () => {
    it('sets selected tip percent', () => {
      usePosCartStore.getState().setSelectedTipPercent(20);
      expect(usePosCartStore.getState().selectedTipPercent).toBe(20);
    });

    it('sets charity round up', () => {
      usePosCartStore.getState().setCharityRoundUp(true);
      expect(usePosCartStore.getState().charityRoundUp).toBe(true);
    });

    it('sets tax allocation enabled', () => {
      usePosCartStore.getState().setTaxAllocationEnabled(false);
      expect(usePosCartStore.getState().taxAllocationEnabled).toBe(false);
    });
  });

  describe('computed totals', () => {
    it('calculates subtotal correctly', () => {
      usePosCartStore.getState().addItem(makeItem({ id: 1, price: 10 }));
      usePosCartStore.getState().addItem(makeItem({ id: 2, price: 5 }));
      usePosCartStore.getState().updateQuantity(2, 3);

      // 10*1 + 5*3 = 25
      expect(usePosCartStore.getState().subtotal()).toBe(25);
    });

    it('returns 0 subtotal for empty cart', () => {
      expect(usePosCartStore.getState().subtotal()).toBe(0);
    });

    it('calculates tip amount', () => {
      usePosCartStore.getState().addItem(makeItem({ id: 1, price: 100 }));
      usePosCartStore.getState().setSelectedTipPercent(15);

      // 15% of 100 = 15
      expect(usePosCartStore.getState().tipAmount()).toBe(15);
    });

    it('returns 0 tip when percent is 0', () => {
      usePosCartStore.getState().addItem(makeItem({ id: 1, price: 100 }));
      expect(usePosCartStore.getState().tipAmount()).toBe(0);
    });

    it('calculates tax amount (8.875%)', () => {
      usePosCartStore.getState().addItem(makeItem({ id: 1, price: 100 }));

      // 8.875% of 100 = 8.875 → rounded to 2dp = 8.88
      expect(usePosCartStore.getState().taxAmount()).toBe(8.88);
    });

    it('returns 0 tax when tax allocation is disabled', () => {
      usePosCartStore.getState().addItem(makeItem({ id: 1, price: 100 }));
      usePosCartStore.getState().setTaxAllocationEnabled(false);

      expect(usePosCartStore.getState().taxAmount()).toBe(0);
    });

    it('calculates charity round-up amount', () => {
      usePosCartStore.getState().addItem(makeItem({ id: 1, price: 9.50 }));
      usePosCartStore.getState().setCharityRoundUp(true);

      // subtotal 9.50, tip 0, tax = round2(9.50 * 0.08875) = round2(0.843125) = 0.84
      // preCharity = 9.50 + 0 + 0.84 = 10.34
      // charity = ceil(10.34) - 10.34 = 11 - 10.34 = 0.66
      const charity = usePosCartStore.getState().charityAmount();
      expect(charity).toBe(0.66);
    });

    it('returns 0 charity when round-up is disabled', () => {
      usePosCartStore.getState().addItem(makeItem({ id: 1, price: 9.50 }));
      expect(usePosCartStore.getState().charityAmount()).toBe(0);
    });

    it('calculates total correctly', () => {
      usePosCartStore.getState().addItem(makeItem({ id: 1, price: 25.00 }));
      usePosCartStore.getState().setSelectedTipPercent(10);
      usePosCartStore.getState().setCharityRoundUp(true);

      // subtotal: 25.00, tip: 2.50, tax: 2.21875, preCharity: 29.71875
      // charity: ceil(29.71875) - 29.71875 = 30 - 29.71875 = 0.28125
      // total: round2(25) + round2(2.50) + round2(2.21875) + round2(0.28125)
      //      = 25 + 2.5 + 2.22 + 0.28 = 30.00
      const total = usePosCartStore.getState().total();
      expect(total).toBe(30.00);
    });

    it('calculates total without tip or charity', () => {
      usePosCartStore.getState().addItem(makeItem({ id: 1, price: 10.00 }));

      // subtotal: 10, tip: 0, tax: 0.8875
      // total: round2(10) + round2(0) + round2(0.8875) = 10 + 0 + 0.89 = 10.89
      expect(usePosCartStore.getState().total()).toBe(10.89);
    });
  });
});
