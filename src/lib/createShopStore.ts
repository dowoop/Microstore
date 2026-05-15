import { create } from 'zustand';
import { sanitizeTextField, sanitizePhotoUrl, stripHtml } from '@/lib/security';
import type { AcceptedToken } from '@/lib/db';

const DEFAULT_TIP_PRESETS = [0, 10, 15, 20];

interface CreateShopState {
  name: string;
  username: string;
  photoUrl: string | null;
  description: string;
  tipPresets: number[];
  taxAllocationEnabled: boolean;
  taxRate: number;
  taxRegion: string;
  charityEnabled: boolean;
  merchantWallet: string;
  taxWallet: string;
  charityWallet: string;
  splTokenMint: string;
  splTokenSymbol: string;
  acceptedTokens: AcceptedToken[];
  tariWallet: string;
  tariNetwork: 'igor' | 'mainnet';
  tariAcceptedTokens: { symbol: string; assetId?: string; resourceAddress?: string }[];
  setName: (n: string) => void;
  setUsername: (s: string) => void;
  setPhotoUrl: (u: string | null) => void;
  setDescription: (d: string) => void;
  toggleTipPreset: (p: number) => void;
  setTaxAllocationEnabled: (e: boolean) => void;
  setTaxRate: (r: number) => void;
  setTaxRegion: (r: string) => void;
  setCharityEnabled: (e: boolean) => void;
  setMerchantWallet: (a: string) => void;
  setTaxWallet: (a: string) => void;
  setCharityWallet: (a: string) => void;
  setSplTokenMint: (a: string) => void;
  setSplTokenSymbol: (s: string) => void;
  addAcceptedToken: (t: AcceptedToken) => void;
  removeAcceptedToken: (m: string) => void;
  reorderAcceptedTokens: (f: number, t: number) => void;
  setAcceptedTokens: (t: AcceptedToken[]) => void;
  setTariWallet: (a: string) => void;
  setTariNetwork: (n: 'igor' | 'mainnet') => void;
  addTariAcceptedToken: (t: { symbol: string; assetId?: string; resourceAddress?: string }) => void;
  removeTariAcceptedToken: (symbol: string) => void;
  setTariAcceptedTokens: (
    t: { symbol: string; assetId?: string; resourceAddress?: string }[],
  ) => void;
  reset: () => void;
}

export const useCreateShopStore = create<CreateShopState>()((set) => ({
  name: '',
  username: '',
  photoUrl: null,
  description: '',
  tipPresets: [...DEFAULT_TIP_PRESETS],
  taxAllocationEnabled: false,
  taxRate: 0,
  taxRegion: '',
  charityEnabled: false,
  merchantWallet: '',
  taxWallet: '',
  charityWallet: '',
  splTokenMint: '',
  splTokenSymbol: '',
  acceptedTokens: [],
  tariWallet: '',
  tariNetwork: 'igor',
  tariAcceptedTokens: [],
  setName: (name) => {
    set({ name: sanitizeTextField(name) });
    set((state) => {
      const slug = name
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .trim()
        .replace(/\s+/g, '-');
      return !state.username || state.username === autoSlug(state.name) ? { username: slug } : {};
    });
  },
  setUsername: (u) =>
    set({
      username: u
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, '')
        .replace(/-+/g, '-'),
    }),
  setPhotoUrl: (url) => {
    const s = sanitizePhotoUrl(url);
    set({ photoUrl: s || null });
  },
  setDescription: (d) => set({ description: stripHtml(d).trim() }),
  toggleTipPreset: (p) =>
    set((s) => ({
      tipPresets: s.tipPresets.includes(p)
        ? s.tipPresets.filter((x) => x !== p)
        : [...s.tipPresets, p].sort((a, b) => a - b),
    })),
  setTaxAllocationEnabled: (e) => set({ taxAllocationEnabled: e }),
  setTaxRate: (r) => set({ taxRate: Math.max(0, Math.min(0.5, r)) }),
  setTaxRegion: (r) => set({ taxRegion: r }),
  setCharityEnabled: (e) => set({ charityEnabled: e }),
  setMerchantWallet: (a) => set({ merchantWallet: a.trim() }),
  setTaxWallet: (a) => set({ taxWallet: a.trim() }),
  setCharityWallet: (a) => set({ charityWallet: a.trim() }),
  setSplTokenMint: (a) => set({ splTokenMint: a.trim() }),
  setSplTokenSymbol: (s) => set({ splTokenSymbol: s.trim().toUpperCase() }),
  addAcceptedToken: (t) =>
    set((s) =>
      s.acceptedTokens.some((x) => x.mint === t.mint)
        ? s
        : { acceptedTokens: [...s.acceptedTokens, t] },
    ),
  removeAcceptedToken: (m) =>
    set((s) => ({ acceptedTokens: s.acceptedTokens.filter((x) => x.mint !== m) })),
  reorderAcceptedTokens: (f, to) =>
    set((s) => {
      const a = [...s.acceptedTokens];
      if (f < 0 || f >= a.length || to < 0 || to >= a.length) return s;
      const [m] = a.splice(f, 1);
      a.splice(to, 0, m);
      return { acceptedTokens: a };
    }),
  setAcceptedTokens: (t) => set({ acceptedTokens: t }),
  setTariWallet: (a) => set({ tariWallet: a.trim() }),
  setTariNetwork: (n) => set({ tariNetwork: n }),
  addTariAcceptedToken: (t) =>
    set((s) =>
      s.tariAcceptedTokens.includes(t) ? s : { tariAcceptedTokens: [...s.tariAcceptedTokens, t] },
    ),
  removeTariAcceptedToken: (symbol) =>
    set((s) => ({ tariAcceptedTokens: s.tariAcceptedTokens.filter((x) => x.symbol !== symbol) })),
  setTariAcceptedTokens: (t) => set({ tariAcceptedTokens: t }),
  reset: () =>
    set({
      name: '',
      username: '',
      photoUrl: null,
      description: '',
      tipPresets: [...DEFAULT_TIP_PRESETS],
      taxAllocationEnabled: false,
      taxRate: 0,
      taxRegion: '',
      charityEnabled: false,
      merchantWallet: '',
      taxWallet: '',
      charityWallet: '',
      splTokenMint: '',
      splTokenSymbol: '',
      acceptedTokens: [],
      tariWallet: '',
      tariNetwork: 'igor',
      tariAcceptedTokens: [],
    }),
}));

function autoSlug(n: string): string {
  return n
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}
