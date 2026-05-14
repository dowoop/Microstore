import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AppState {
  activeShopId: number | null;
  setActiveShopId: (id: number | null) => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      activeShopId: null,
      setActiveShopId: (id) => set({ activeShopId: id }),
      activeTab: 'home',
      setActiveTab: (tab) => set({ activeTab: tab }),
    }),
    {
      name: 'microstore-app-state',
    }
  )
);
