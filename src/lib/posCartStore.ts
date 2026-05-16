import { create } from 'zustand';
import type { Item } from '@/lib/db';
import { db, type CartDraft, type CartDraftItem } from '@/lib/db';
import { computeOrderTotals, type OrderTotals } from '@/lib/solanaPay';

export interface CartItem {
  item: Item;
  quantity: number;
}

interface PosCartState {
  items: CartItem[];
  selectedTipPercent: number;
  charityRoundUp: boolean;
  /** Whether tax is collected/displayed (mirrors shop.taxEnabled). */
  taxEnabled: boolean;
  /** Shop-level tax rate (decimal, e.g. 0.08875). 0 = tax disabled. */
  taxRate: number;
  /** Shop-level tax label (display name, from shop.taxLabel). */
  taxLabel: string;
  /** Active shop for persistence scoping. */
  activeShopId: number | null;

  addItem: (item: Item) => void;
  removeItem: (itemId: number) => void;
  updateQuantity: (itemId: number, quantity: number) => void;
  clearCart: () => void;
  setSelectedTipPercent: (pct: number) => void;
  setCharityRoundUp: (enabled: boolean) => void;
  setTaxEnabled: (enabled: boolean) => void;
  setTaxRate: (rate: number) => void;
  setTaxLabel: (label: string) => void;
  setActiveShopId: (shopId: number | null) => void;
  /** Reconcile cart from Dexie (for tab-duplication / visibility-change). */
  reconcileFromDb: () => Promise<void>;

  // Computed — plain numbers
  subtotal: () => number;
  computedTotals: () => OrderTotals;
  tipAmount: () => number;
  taxAmount: () => number;
  charityAmount: () => number;
  total: () => number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toPersisted(items: CartItem[]): CartDraftItem[] {
  return items.map((ci) => ({
    itemId: ci.item.id,
    name: ci.item.name,
    price: ci.item.price,
    quantity: ci.quantity,
  }));
}

async function fromPersisted(persisted: CartDraftItem[]): Promise<CartItem[]> {
  const itemIds = persisted.map((p) => p.itemId);
  const liveItems = await db.items.bulkGet(itemIds);
  const liveMap = new Map<number, Item>();
  for (const item of liveItems) {
    if (item) liveMap.set(item.id, item);
  }

  return persisted.map((p) => {
    const live = liveMap.get(p.itemId);
    if (live) return { item: live, quantity: p.quantity };

    const stub: Item = {
      id: p.itemId,
      shopId: 0,
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

function schedulePersist(shopId: number, items: CartItem[]): void {
  if (_persistTimer) clearTimeout(_persistTimer);
  _persistTimer = setTimeout(async () => {
    _persistTimer = null;
    try {
      if (items.length === 0) {
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
  taxEnabled: true,
  taxRate: 0,
  taxLabel: 'Sales Tax',
  activeShopId: null,

  addItem: (item: Item) => {
    const current = get().items;
    const existing = current.find((ci) => ci.item.id === item.id);
    const next = existing
      ? current.map((ci) => (ci.item.id === item.id ? { ...ci, quantity: ci.quantity + 1 } : ci))
      : [...current, { item, quantity: 1 }];
    set({ items: next });
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
    const next = get().items.map((ci) => (ci.item.id === itemId ? { ...ci, quantity } : ci));
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
  setTaxEnabled: (enabled: boolean) => set({ taxEnabled: enabled }),
  setTaxRate: (rate: number) => set({ taxRate: rate }),
  setTaxLabel: (label: string) => set({ taxLabel: label }),

  setActiveShopId: (shopId: number | null) => {
    const prev = get().activeShopId;
    set({ activeShopId: shopId });

    if (shopId != null && shopId !== prev) {
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
      const draft = await db.cartDrafts.where('shopId').equals(shopId).first();
      if (draft && draft.items && draft.items.length > 0) {
        const restored = await fromPersisted(draft.items);
        set({ items: restored });
      } else {
        set({ items: [] });
      }
    } catch (err) {
      console.error('[posCartStore] Failed to reconcile cart:', err);
    }
  },

  subtotal: () => {
    const items = get().items;
    let sum = 0;
    for (const ci of items) sum += ci.item.price * ci.quantity;
    return Math.round(sum * 100) / 100;
  },

  computedTotals: () => {
    const { selectedTipPercent, taxEnabled, taxRate, charityRoundUp } = get();
    return computeOrderTotals({
      subtotal: get().subtotal(),
      tipPercent: selectedTipPercent,
      taxRate: taxEnabled ? taxRate : 0,
      charityRoundUp,
    });
  },

  tipAmount: () => get().computedTotals().tip,
  taxAmount: () => get().computedTotals().tax,
  charityAmount: () => get().computedTotals().charity,
  total: () => get().computedTotals().total,
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
