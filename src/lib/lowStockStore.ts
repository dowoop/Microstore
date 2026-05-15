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
  /** Current low-stock items */
  lowStockItems: Item[];
  setLowStockItems: (items: Item[]) => void;

  /** Low stock count (readable by tabs, home, etc.) */
  lowStockCount: number;

  /** Alert history for settings panel */
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
