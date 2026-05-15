import { create } from 'zustand';
import type { ItemType, ItemStatus, ListingRules } from '@/lib/db';
import { sanitizeTextField, sanitizeRichHtml, sanitizePhotoUrl, stripHtml } from '@/lib/security';

interface ItemEditorState {
  // fields
  type: ItemType;
  name: string;
  description: string;
  price: string; // string for controlled input
  cost: string;
  sku: string;
  barcode: string;
  stock: string;
  lowStockThreshold: string;
  notifyLowStock: boolean;
  category: string;
  status: ItemStatus;
  photoUrl: string | null;
  payUpfrontTemplate: string;
  listingRulesEnabled: boolean;
  notifyLowStock: boolean;

  // actions
  setType: (type: ItemType) => void;
  setName: (name: string) => void;
  setDescription: (desc: string) => void;
  setPrice: (price: string) => void;
  setCost: (cost: string) => void;
  setSku: (sku: string) => void;
  setBarcode: (barcode: string) => void;
  setStock: (stock: string) => void;
  setLowStockThreshold: (threshold: string) => void;
  setNotifyLowStock: (enabled: boolean) => void;
  setCategory: (cat: string) => void;
  setStatus: (status: ItemStatus) => void;
  setPhotoUrl: (url: string | null) => void;
  setPayUpfrontTemplate: (tmpl: string) => void;
  setListingRulesEnabled: (enabled: boolean) => void;
  reset: () => void;
  /** Populate from an existing Item for editing */
  loadItem: (item: {
    type: ItemType;
    name: string;
    description?: string;
    price: number;
    cost?: number;
    sku?: string;
    barcode?: string;
    stock: number;
    lowStockThreshold?: number;
    notifyLowStock?: boolean;
    category?: string;
    status: ItemStatus;
    photoUrl?: string;
    payUpfrontTemplate?: string;
    listingRules: ListingRules;
  }) => void;
}

export const useItemEditorStore = create<ItemEditorState>()((set) => ({
  type: 'product',
  name: '',
  description: '',
  price: '',
  cost: '',
  sku: '',
  barcode: '',
  stock: '0',
  lowStockThreshold: '',
  notifyLowStock: true,
  category: '',
  status: 'draft',
  photoUrl: null,
  payUpfrontTemplate: '',
  listingRulesEnabled: false,

  setType: (type) => set({ type }),

  setName: (name) => set({ name: sanitizeTextField(name) }),

  setDescription: (desc) => set({ description: sanitizeRichHtml(desc) }),

  setPrice: (price) => set({ price }),

  setCost: (cost) => set({ cost }),

  setSku: (sku) => set({ sku: sanitizeTextField(sku) }),

  setBarcode: (barcode) => set({ barcode: sanitizeTextField(barcode) }),

  setStock: (stock) => set({ stock }),

  setLowStockThreshold: (threshold) => set({ lowStockThreshold: threshold }),

  setNotifyLowStock: (enabled) => set({ notifyLowStock: enabled }),

  setCategory: (cat) => set({ category: sanitizeTextField(cat) }),

  setStatus: (status) => set({ status }),

  setPhotoUrl: (url) => {
    const safe = sanitizePhotoUrl(url);
    set({ photoUrl: safe || null });
  },

  setPayUpfrontTemplate: (tmpl) => set({ payUpfrontTemplate: stripHtml(tmpl).trim() }),

  setListingRulesEnabled: (enabled) => set({ listingRulesEnabled: enabled }),

  reset: () =>
    set({
      type: 'product',
      name: '',
      description: '',
      price: '',
      cost: '',
      sku: '',
      barcode: '',
      stock: '0',
      lowStockThreshold: '',
      notifyLowStock: true,
      category: '',
      status: 'draft',
      photoUrl: null,
      payUpfrontTemplate: '',
      listingRulesEnabled: false,
    }),

  loadItem: (item) =>
    set({
      type: item.type,
      name: item.name,
      description: item.description ?? '',
      price: String(item.price),
      cost: item.cost != null ? String(item.cost) : '',
      sku: item.sku ?? '',
      barcode: item.barcode ?? '',
      stock: String(item.stock),
      lowStockThreshold: item.lowStockThreshold != null ? String(item.lowStockThreshold) : '',
      notifyLowStock: item.notifyLowStock ?? true,
      category: item.category ?? '',
      status: item.status,
      photoUrl: item.photoUrl ?? null,
      payUpfrontTemplate: item.payUpfrontTemplate ?? '',
      listingRulesEnabled: item.listingRules.enabled,
    }),
}));
