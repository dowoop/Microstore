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
  // PIN protection
  pinHash: string | null;
  pinSalt: string | null;
  setPin: (hash: string, salt: string) => void;
  clearPin: () => void;
  // Cashier mode
  cashierMode: boolean;
  setCashierMode: (enabled: boolean) => void;
  // Session unlock (NOT persisted — cleared on page reload)
  sessionUnlocked: boolean;
  setSessionUnlocked: (unlocked: boolean) => void;
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
      // PIN — persisted
      pinHash: null,
      pinSalt: null,
      setPin: (hash, salt) => set({ pinHash: hash, pinSalt: salt }),
      clearPin: () => set({ pinHash: null, pinSalt: null, cashierMode: false }),
      // Cashier mode — persisted
      cashierMode: false,
      setCashierMode: (enabled) => set({ cashierMode: enabled }),
      // Session unlock — ephemeral, not persisted
      sessionUnlocked: false,
      setSessionUnlocked: (unlocked) => set({ sessionUnlocked: unlocked }),
    }),
    {
      name: 'microstore-app-state',
      partialize: (state) => {
        // Only persist what survives page reloads
        const { sessionUnlocked, ...persisted } = state;
        return persisted;
      },
    },
  ),
);
