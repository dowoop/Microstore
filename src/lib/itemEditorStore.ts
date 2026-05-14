import { create } from 'zustand';
import type { ItemType, ItemStatus, ListingRules } from '@/lib/db';

interface ItemEditorState {
  // fields
  type: ItemType;
  name: string;
  description: string;
  price: string;          // string for controlled input
  cost: string;
  sku: string;
  barcode: string;
  stock: string;
  lowStockThreshold: string;
  category: string;
  status: ItemStatus;
  photoUrl: string | null;
  payUpfrontTemplate: string;
  listingRulesEnabled: boolean;

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
  category: '',
  status: 'draft',
  photoUrl: null,
  payUpfrontTemplate: '',
  listingRulesEnabled: false,

  setType: (type) => set({ type }),

  setName: (name) => set({ name }),

  setDescription: (desc) => set({ description: desc }),

  setPrice: (price) => set({ price }),

  setCost: (cost) => set({ cost }),

  setSku: (sku) => set({ sku }),

  setBarcode: (barcode) => set({ barcode }),

  setStock: (stock) => set({ stock }),

  setLowStockThreshold: (threshold) => set({ lowStockThreshold: threshold }),

  setCategory: (cat) => set({ category: cat }),

  setStatus: (status) => set({ status }),

  setPhotoUrl: (url) => set({ photoUrl: url }),

  setPayUpfrontTemplate: (tmpl) => set({ payUpfrontTemplate: tmpl }),

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
      category: item.category ?? '',
      status: item.status,
      photoUrl: item.photoUrl ?? null,
      payUpfrontTemplate: item.payUpfrontTemplate ?? '',
      listingRulesEnabled: item.listingRules.enabled,
    }),
}));