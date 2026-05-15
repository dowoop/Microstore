import { create } from 'zustand';
import type { Item } from '@/lib/db';

export interface LowStockAlert {
  itemId: number;
  itemName: string;
  stock: number;
  threshold: number;
  alertedAt: Date;
}

interface LowStockState {
  lowStockItems: Item[];
  setLowStockItems: (items: Item[]) => void;
  lowStockCount: number;
  alertHistory: LowStockAlert[];
  addAlert: (alert: LowStockAlert) => void;
  clearAlertHistory: () => void;
}

export const useLowStockStore = create<LowStockState>()((set, get) => ({
  lowStockItems: [],
  setLowStockItems: (items) => set({ lowStockItems: items, lowStockCount: items.length }),
  lowStockCount: 0,
  alertHistory: [],
  addAlert: (alert) =>
    set({ alertHistory: [...get().alertHistory.slice(-99), alert] }),
  clearAlertHistory: () => set({ alertHistory: [] }),
}));
