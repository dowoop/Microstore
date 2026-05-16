import { create } from 'zustand';
import type { Item } from '@/lib/db';
import { db, type CartDraft, type CartDraftItem } from '@/lib/db';
import {
  type Money,
  zero,
  add,
  sub,
  mulPercent,
  ceilToDollar,
  fromDecimalString,
} from '@/lib/money';

export interface CartItem {
  item: Item;
  quantity: number;
}

// ---------------------------------------------------------------------------
// Money helpers — no number arithmetic here; everything is bigint + Money
// ---------------------------------------------------------------------------

const MONEY_DECIMALS = 6;

/** Convert an Item's `price: number` to Money (6 decimals for USDC compat). */
function itemPriceToMoney(price: number): Money {
  return fromDecimalString(price.toFixed(MONEY_DECIMALS), MONEY_DECIMALS);
}

/** Multiply a Money value by a positive integer quantity. */
function mulQuantity(m: Money, qty: number): Money {
  return { units: m.units * BigInt(Math.trunc(qty)), decimals: m.decimals };
}

/** Convert Money → number for backward-compat boundaries (DB, display). */
export function moneyToNumber(m: Money): number {
  return Number(m.units) / (10 ** m.decimals);
}

/** Money-based totals — replaces the old OrderTotals from solanaPay.ts. */
export interface CartTotals {
  subtotal: Money;
  tip: Money;
  reserve: Money;
  charity: Money;
  total: Money;
}

interface PosCartState {
  items: CartItem[];
  selectedTipPercent: number;
  charityRoundUp: boolean;
  reserveAllocationEnabled: boolean;
  /** Shop-level reserve rate (decimal, e.g. 0.08875 for 8.875%). 0 = reserve disabled. */
  reserveRate: number;
  /** Active shop for persistence scoping. */
  activeShopId: number | null;

  addItem: (item: Item) => void;
  removeItem: (itemId: number) => void;
  updateQuantity: (itemId: number, quantity: number) => void;
  clearCart: () => void;
  setSelectedTipPercent: (pct: number) => void;
  setCharityRoundUp: (enabled: boolean) => void;
  setReserveAllocationEnabled: (enabled: boolean) => void;
  setReserveRate: (rate: number) => void;
  setActiveShopId: (shopId: number | null) => void;
  /** Reconcile cart from Dexie (for tab-duplication / visibility-change). */
  reconcileFromDb: () => Promise<void>;

  // Computed — all return Money (no number arithmetic)
  subtotal: () => Money;
  /** Full computed totals via Money (single source of truth). */
  computedTotals: () => CartTotals;
  tipAmount: () => Money;
  reserveAmount: () => Money;
  charityAmount: () => Money;
  total: () => Money;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Extract a storable subset of the cart items array. */
function toPersisted(items: CartItem[]): CartDraftItem[] {
  return items.map((ci) => ({
    itemId: ci.item.id,
    name: ci.item.name,
    price: ci.item.price,
    quantity: ci.quantity,
  }));
}

/** Re-hydrate persisted items back into full CartItem objects.
 *  Looks up each item from the items table; constructs a minimal Item
 *  stub if the source item was deleted. */
async function fromPersisted(
  persisted: CartDraftItem[],
): Promise<CartItem[]> {
  const itemIds = persisted.map((p) => p.itemId);
  const liveItems = await db.items.bulkGet(itemIds);
  const liveMap = new Map<number, Item>();
  for (const item of liveItems) {
    if (item) liveMap.set(item.id, item);
  }

  return persisted.map((p) => {
    const live = liveMap.get(p.itemId);
    if (live) return { item: live, quantity: p.quantity };

    // Item was deleted — construct a stub so the cart entry isn't lost silently
    const stub: Item = {
      id: p.itemId,
      shopId: 0, // unknown — cart is scoped to a shop anyway
      type: 'product',
      name: p.name,
      price: p.price,
      stock: 0,
      status: 'draft',
      listingRules: { enabled: true },
      createdAt: new Date(0),
      updatedAt: new Date(0),
    };
    return { item: stub, quantity: p.quantity };
  });
}

// ---------------------------------------------------------------------------
// Persistence helpers (debounced write)
// ---------------------------------------------------------------------------

let _persistTimer: ReturnType<typeof setTimeout> | null = null;
const PERSIST_DEBOUNCE_MS = 300;

function schedulePersist(
  shopId: number,
  items: CartItem[],
): void {
  if (_persistTimer) clearTimeout(_persistTimer);
  _persistTimer = setTimeout(async () => {
    _persistTimer = null;
    try {
      if (items.length === 0) {
        // Delete draft for empty carts
        await db.cartDrafts.where('shopId').equals(shopId).delete();
      } else {
        await db.cartDrafts.put({
          shopId,
          items: toPersisted(items),
          updatedAt: Date.now(),
        });
      }
    } catch (err) {
      console.error('[posCartStore] Failed to persist cart:', err);
    }
  }, PERSIST_DEBOUNCE_MS);
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const usePosCartStore = create<PosCartState>()((set, get) => ({
  items: [],
  selectedTipPercent: 0,
  charityRoundUp: false,
  reserveAllocationEnabled: true,
  reserveRate: 0,
  activeShopId: null,

  // ---- actions ----

  addItem: (item: Item) => {
    const current = get().items;
    const existing = current.find((ci) => ci.item.id === item.id);
    const next = existing
      ? current.map((ci) =>
          ci.item.id === item.id
            ? { ...ci, quantity: ci.quantity + 1 }
            : ci,
        )
      : [...current, { item, quantity: 1 }];
    set({ items: next });
    // Persist
    const shopId = get().activeShopId;
    if (shopId != null) schedulePersist(shopId, next);
  },

  removeItem: (itemId: number) => {
    const next = get().items.filter((ci) => ci.item.id !== itemId);
    set({ items: next });
    const shopId = get().activeShopId;
    if (shopId != null) schedulePersist(shopId, next);
  },

  updateQuantity: (itemId: number, quantity: number) => {
    if (quantity <= 0) {
      get().removeItem(itemId);
      return;
    }
    const next = get().items.map((ci) =>
      ci.item.id === itemId ? { ...ci, quantity } : ci,
    );
    set({ items: next });
    const shopId = get().activeShopId;
    if (shopId != null) schedulePersist(shopId, next);
  },

  clearCart: () => {
    set({ items: [], selectedTipPercent: 0, charityRoundUp: false });
    const shopId = get().activeShopId;
    if (shopId != null) {
      schedulePersist(shopId, []);
    }
  },

  setSelectedTipPercent: (pct: number) => set({ selectedTipPercent: pct }),

  setCharityRoundUp: (enabled: boolean) => set({ charityRoundUp: enabled }),

  setReserveAllocationEnabled: (enabled: boolean) => set({ reserveAllocationEnabled: enabled }),

  setReserveRate: (rate: number) => set({ reserveRate: rate }),

  setActiveShopId: (shopId: number | null) => {
    const prev = get().activeShopId;
    set({ activeShopId: shopId });

    // Restore draft when switching to a shop
    if (shopId != null && shopId !== prev) {
      // Clear current cart before restoring
      set({ items: [], selectedTipPercent: 0, charityRoundUp: false });

      db.cartDrafts
        .where('shopId')
        .equals(shopId)
        .first()
        .then(async (draft: CartDraft | undefined) => {
          if (!draft || !draft.items || draft.items.length === 0) return;
          try {
            const restored = await fromPersisted(draft.items);
            set({ items: restored });
          } catch (err) {
            console.error('[posCartStore] Failed to restore cart draft:', err);
          }
        })
        .catch((err) => {
          console.error('[posCartStore] Failed to read cart draft:', err);
        });
    }

    // If switching away from a shop (shopId === null), persist the current
    // cart before leaving, then clear
    if (shopId === null && prev != null) {
      const current = get().items;
      if (current.length > 0) {
        schedulePersist(prev, current);
      }
      set({ items: [], selectedTipPercent: 0, charityRoundUp: false });
    }
  },

  reconcileFromDb: async () => {
    const shopId = get().activeShopId;
    if (shopId == null) return;

    try {
      const draft = await db.cartDrafts
        .where('shopId')
        .equals(shopId)
        .first();
      if (draft && draft.items && draft.items.length > 0) {
        const restored = await fromPersisted(draft.items);
        set({ items: restored });
      } else {
        // Another tab cleared the cart
        set({ items: [] });
      }
    } catch (err) {
      console.error('[posCartStore] Failed to reconcile cart:', err);
    }
  },

  // ---- computed (all Money, no number arithmetic) ----

  subtotal: () => {
    return get().items.reduce(
      (sum, ci) => add(sum, mulQuantity(itemPriceToMoney(ci.item.price), ci.quantity)),
      zero(MONEY_DECIMALS),
    );
  },

  computedTotals: () => {
    const {
      selectedTipPercent,
      reserveAllocationEnabled,
      reserveRate,
      charityRoundUp,
    } = get();
    const subtotalVal = get().subtotal();

    // Tip: subtotal * tipPercent% via mulPercent
    const tip = selectedTipPercent > 0
      ? mulPercent(subtotalVal, selectedTipPercent)
      : zero(MONEY_DECIMALS);

    // Reserve: subtotal * reserveRate via mulPercent
    // reserveRate is a decimal (e.g. 0.08875 = 8.875%), mulPercent takes a percentage
    const effectiveRate = reserveAllocationEnabled ? reserveRate : 0;
    const reserve = effectiveRate > 0
      ? mulPercent(subtotalVal, effectiveRate * 100)
      : zero(MONEY_DECIMALS);

    // Pre-charity sum
    const preCharity = add(add(subtotalVal, tip), reserve);

    // Charity: round up to next dollar via ceilToDollar, then subtract
    let charity: Money;
    if (charityRoundUp) {
      const ceil = ceilToDollar(preCharity);
      charity = sub(ceil, preCharity);
    } else {
      charity = zero(MONEY_DECIMALS);
    }

    const total = add(preCharity, charity);

    return { subtotal: subtotalVal, tip, reserve, charity, total };
  },

  tipAmount: () => {
    return get().computedTotals().tip;
  },

  reserveAmount: () => {
    return get().computedTotals().reserve;
  },

  charityAmount: () => {
    return get().computedTotals().charity;
  },

  total: () => {
    return get().computedTotals().total;
  },
}));

// ---------------------------------------------------------------------------
// Tab-duplication reconciliation: on focus/visibilitychange, re-read from
// Dexie so Tab B picks up changes made by Tab A.
// ---------------------------------------------------------------------------

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      const state = usePosCartStore.getState();
      if (state.activeShopId != null) {
        void state.reconcileFromDb();
      }
    }
  });
}
