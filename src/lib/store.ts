import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type SolanaCluster = 'devnet' | 'mainnet-beta';

function getDefaultCluster(): SolanaCluster {
  if (typeof window === 'undefined') return 'devnet';
  const env = process.env.NEXT_PUBLIC_SOLANA_CLUSTER;
  if (env === 'mainnet-beta') return 'mainnet-beta';
  return 'devnet';
}

interface AppState {
  activeShopId: number | null;
  setActiveShopId: (id: number | null) => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  solanaCluster: SolanaCluster;
  setSolanaCluster: (cluster: SolanaCluster) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      activeShopId: null,
      setActiveShopId: (id) => set({ activeShopId: id }),
      activeTab: 'home',
      setActiveTab: (tab) => set({ activeTab: tab }),
      solanaCluster: getDefaultCluster(),
      setSolanaCluster: (cluster) => set({ solanaCluster: cluster }),
    }),
    {
      name: 'microstore-app-state',
    }
  )
);
