import { create } from 'zustand';

const DEFAULT_TIP_PRESETS = [0, 10, 15, 20];

interface CreateShopState {
  // fields
  name: string;
  username: string;
  photoUrl: string | null;
  description: string;
  tipPresets: number[];
  taxAllocationEnabled: boolean;
  charityEnabled: boolean;
  // Solana wallet config
  merchantWallet: string;
  taxWallet: string;
  charityWallet: string;
  splTokenMint: string;
  splTokenSymbol: string;

  // actions
  setName: (name: string) => void;
  setUsername: (slug: string) => void;
  setPhotoUrl: (url: string | null) => void;
  setDescription: (desc: string) => void;
  toggleTipPreset: (percent: number) => void;
  setTaxAllocationEnabled: (enabled: boolean) => void;
  setCharityEnabled: (enabled: boolean) => void;
  setMerchantWallet: (addr: string) => void;
  setTaxWallet: (addr: string) => void;
  setCharityWallet: (addr: string) => void;
  setSplTokenMint: (addr: string) => void;
  setSplTokenSymbol: (sym: string) => void;
  reset: () => void;
}

export const useCreateShopStore = create<CreateShopState>()((set) => ({
  name: '',
  username: '',
  photoUrl: null,
  description: '',
  tipPresets: [...DEFAULT_TIP_PRESETS],
  taxAllocationEnabled: false,
  charityEnabled: false,
  merchantWallet: '',
  taxWallet: '',
  charityWallet: '',
  splTokenMint: '',
  splTokenSymbol: '',

  setName: (name) => {
    set({ name });
    // auto-generate username slug from name if username is empty or was auto-generated
    set((state) => {
      const autoSlug = name
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .trim()
        .replace(/\s+/g, '-');
      // only auto-fill if username hasn't been manually edited
      if (!state.username || state.username === autoSlugFromName(state.name)) {
        return { username: autoSlug };
      }
      return {};
    });
  },

  setUsername: (username) =>
    set({ username: username.toLowerCase().replace(/[^a-z0-9-]/g, '').replace(/-+/g, '-') }),

  setPhotoUrl: (url) => set({ photoUrl: url }),

  setDescription: (desc) => set({ description: desc }),

  toggleTipPreset: (percent) =>
    set((state) => {
      const exists = state.tipPresets.includes(percent);
      return {
        tipPresets: exists
          ? state.tipPresets.filter((p) => p !== percent)
          : [...state.tipPresets, percent].sort((a, b) => a - b),
      };
    }),

  setTaxAllocationEnabled: (enabled) => set({ taxAllocationEnabled: enabled }),

  setCharityEnabled: (enabled) => set({ charityEnabled: enabled }),

  setMerchantWallet: (addr) => set({ merchantWallet: addr.trim() }),
  setTaxWallet: (addr) => set({ taxWallet: addr.trim() }),
  setCharityWallet: (addr) => set({ charityWallet: addr.trim() }),
  setSplTokenMint: (addr) => set({ splTokenMint: addr.trim() }),
  setSplTokenSymbol: (sym) => set({ splTokenSymbol: sym.trim().toUpperCase() }),

  reset: () =>
    set({
      name: '',
      username: '',
      photoUrl: null,
      description: '',
      tipPresets: [...DEFAULT_TIP_PRESETS],
      taxAllocationEnabled: false,
      charityEnabled: false,
      merchantWallet: '',
      taxWallet: '',
      charityWallet: '',
      splTokenMint: '',
      splTokenSymbol: '',
    }),
}));

/** Compute the auto-slug that would be generated from a given name */
function autoSlugFromName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}