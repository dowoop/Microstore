'use client';

import { useState, useRef, useEffect, type FormEvent } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Camera,
  Store,
  Heart,
  HandCoins,
  ShieldCheck,
  Wallet,
  Check,
  Lock,
} from 'lucide-react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { db } from '@/lib/db';
import { useCreateShopStore } from '@/lib/createShopStore';
import { usePhotoUrl } from '@/lib/usePhotoUrl';
import { useAppStore } from '@/lib/store';
import TokenPicker from '@/components/TokenPicker';
import { US_TAX_REGIONS, CUSTOM_TAX_CODE, formatTaxRate, findRegionByRate } from '@/lib/taxRegions';
import { hashPin, isValidPin } from '@/lib/pinCrypto';

const CHARITY_PARTNERS = ['GiveDirectly', 'Local Food Bank'];

/** Hardcoded charity wallet address options. Defaults to first entry. */
const CHARITY_WALLET_OPTIONS = [
  { label: 'GiveDirectly (Primary)', address: 'GvHeR432g7MjN9uKyX3FaxSTgEps1U5UjSm8sYmXMjHG' },
  { label: 'Local Food Bank', address: 'FooD4pK6tXnZQJsvqFieHkn9XN4T8vJ2D3uWvJbK8tVx' },
  { label: 'Custom...', address: '' },
];
const TIP_PERCENTAGES = [0, 10, 15, 20];

export default function CreateShopPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    name,
    username,
    photoUrl,
    description,
    tipPresets,
    taxEnabled,
    taxRate,
    taxLabel,
    taxRegion,
    taxSetAsideWallet,
    charityEnabled,
    merchantWallet,
    charityWallet,
    acceptedTokens,
    tariWallet,
    tariNetwork,
    tariAcceptedTokens,
    setName,
    setUsername,
    setPhotoUrl,
    setDescription,
    toggleTipPreset,
    setTaxEnabled,
    setTaxRate,
    setTaxLabel,
    setTaxRegion,
    setTaxSetAsideWallet,
    setCharityEnabled,
    setMerchantWallet,
    setCharityWallet,
    addAcceptedToken,
    removeAcceptedToken,
    reorderAcceptedTokens,
    setTariWallet,
    setTariNetwork,
    addTariAcceptedToken,
    removeTariAcceptedToken,
    reset,
  } = useCreateShopStore();

  const shopPhotoUrl = usePhotoUrl(photoUrl);

  const { setActiveShopId } = useAppStore();
  const setPin = useAppStore((s) => s.setPin);

  // PIN setup (optional, on shop creation)
  const [shopPin, setShopPin] = useState('');
  const [shopPinError, setShopPinError] = useState<string | null>(null);

  // ---- Wallet adapter integration ----
  const { publicKey, connected } = useWallet();
  const [charityWalletMode, setCharityWalletMode] = useState<'preset' | 'custom'>('preset');

  // Auto-populate merchant wallet when wallet connects
  useEffect(() => {
    if (connected && publicKey) {
      setMerchantWallet(publicKey.toBase58());
    }
  }, [connected, publicKey, setMerchantWallet]);

  // Smart default: tax set-aside wallet defaults to merchant wallet
  useEffect(() => {
    if (merchantWallet && !taxSetAsideWallet) {
      setTaxSetAsideWallet(merchantWallet);
    }
  }, [merchantWallet, taxSetAsideWallet, setTaxSetAsideWallet]);

  // Smart default: charity wallet defaults to first hardcoded option
  useEffect(() => {
    if (!charityWallet && charityWalletMode === 'preset') {
      setCharityWallet(CHARITY_WALLET_OPTIONS[0].address);
    }
  }, [charityWallet, charityWalletMode, setCharityWallet]);

  const truncateAddress = (addr: string): string => {
    if (addr.length <= 8) return addr;
    return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoUrl(file);
  };

  const handleRemovePhoto = () => {
    setPhotoUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const state = useCreateShopStore.getState();
    const trimmedName = state.name.trim();
    const trimmedUsername = state.username.trim();
    if (!trimmedName) {
      setError('Shop name is required.');
      return;
    }
    if (!trimmedUsername) {
      setError('Username / @ slug is required.');
      return;
    }
    if (state.tipPresets.length === 0) {
      setError('Select at least one tip preset.');
      return;
    }
    setSaving(true);
    try {
      const firstToken = state.acceptedTokens[0];
      const id = await db.shops.add({
        name: trimmedName,
        username: trimmedUsername,
        photoUrl: state.photoUrl ?? undefined,
        description: state.description.trim() || undefined,
        tipPresets: state.tipPresets,
        taxEnabled: state.taxEnabled,
        taxRate: state.taxEnabled ? state.taxRate : 0,
        taxRegion: state.taxEnabled ? state.taxRegion : undefined,
        taxLabel: state.taxLabel || 'Sales Tax',
        charityEnabled: state.charityEnabled,
        charityPartners: state.charityEnabled ? CHARITY_PARTNERS : [],
        merchantWallet: state.merchantWallet.trim() || undefined,
        taxSetAsideWallet: state.taxSetAsideWallet.trim() || undefined,
        charityWallet: state.charityWallet.trim() || undefined,
        splTokenMint: (firstToken?.mint ?? state.splTokenMint.trim()) || undefined,
        splTokenSymbol: (firstToken?.symbol ?? state.splTokenSymbol.trim()) || undefined,
        acceptedTokens: state.acceptedTokens.length > 0 ? state.acceptedTokens : undefined,
        tariWallet: state.tariWallet.trim() || undefined,
        tariNetwork: state.tariNetwork,
        tariAcceptedTokens:
          state.tariAcceptedTokens.length > 0 ? state.tariAcceptedTokens : undefined,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      setActiveShopId(id as number);

      // Hash and store PIN if provided
      if (shopPin && isValidPin(shopPin)) {
        const { hash, salt } = await hashPin(shopPin);
        setPin(hash, salt);
      }

      reset();
      router.push('/');
    } catch (err) {
      setError('Failed to save shop.');
      console.error('Save shop error:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col min-h-[calc(100vh-8rem)]">
      <div className="flex items-center gap-3 mb-6">
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-full p-2 -ml-2 text-gray-500 hover:bg-gray-100"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Create Shop</h1>
          <p className="text-sm text-gray-500">Set up your merchant profile</p>
        </div>
      </div>
      {error && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      <div className="flex-1 space-y-6">
        <div className="flex flex-col items-center gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className={`relative flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border-2 border-dashed transition-colors ${shopPhotoUrl ? 'border-blue-400' : 'border-gray-300 hover:border-blue-400 bg-gray-50'}`}
          >
            {shopPhotoUrl ? (
              <>
                <Image
                  src={shopPhotoUrl}
                  alt="Shop photo"
                  fill
                  sizes="96px"
                  className="object-cover"
                  unoptimized
                />
                <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 hover:opacity-100 transition-opacity rounded-full">
                  <Camera className="h-6 w-6 text-white" />
                </div>
              </>
            ) : (
              <Camera className="h-8 w-8 text-gray-500" />
            )}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handlePhotoUpload}
            className="hidden"
          />
          {shopPhotoUrl ? (
            <button
              type="button"
              onClick={handleRemovePhoto}
              className="text-xs text-gray-500 hover:text-red-500"
            >
              Remove photo
            </button>
          ) : (
            <span className="text-xs text-gray-500">Add shop photo</span>
          )}
        </div>
        <div>
          <label htmlFor="shopName" className="block text-sm font-medium text-gray-700 mb-1.5">
            Shop name
          </label>
          <input
            id="shopName"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="My Corner Store"
            autoFocus
            className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none"
          />
        </div>
        <div>
          <label htmlFor="shopUsername" className="block text-sm font-medium text-gray-700 mb-1.5">
            Username
          </label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-gray-500 select-none">
              @
            </span>
            <input
              id="shopUsername"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="my-corner-store"
              className="w-full rounded-lg border border-gray-300 pl-8 pr-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none"
            />
          </div>
          <p className="mt-1 text-xs text-gray-500">Your unique shop handle.</p>
        </div>
        <div>
          <label htmlFor="shopDesc" className="block text-sm font-medium text-gray-700 mb-1.5">
            Description
          </label>
          <input
            id="shopDesc"
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Fresh groceries & daily essentials"
            maxLength={120}
            className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none"
          />
          <p className="mt-1 text-xs text-gray-500">{description.length}/120</p>
        </div>
        <fieldset>
          <legend className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-3">
            <HandCoins className="h-4 w-4 text-amber-500" />
            Tip presets
          </legend>
          <div className="flex flex-wrap gap-2">
            {TIP_PERCENTAGES.map((pct) => {
              const active = tipPresets.includes(pct);
              return (
                <button
                  key={pct}
                  type="button"
                  onClick={() => toggleTipPreset(pct)}
                  className={`rounded-full px-4 py-2 text-sm font-medium transition-all ${active ? 'bg-blue-600 text-white shadow-sm' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                >
                  {pct === 0 ? 'No tip' : `${pct}%`}
                </button>
              );
            })}
          </div>
        </fieldset>
        <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-green-50">
              <ShieldCheck className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">Tax</p>
              <p className="text-xs text-gray-500">Auto-calculate tax</p>
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={taxEnabled}
            onClick={() => setTaxEnabled(!taxEnabled)}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${taxEnabled ? 'bg-blue-600' : 'bg-gray-200'}`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow ring-0 transition-transform ${taxEnabled ? 'translate-x-5' : 'translate-x-0'}`}
            />
          </button>
        </div>
        {taxEnabled && (
          <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-4 space-y-3">
            <div>
              <label htmlFor="taxRegion" className="block text-sm font-medium text-gray-700 mb-1.5">
                Tax region
              </label>
              <select
                id="taxRegion"
                value={taxRegion}
                onChange={(e) => {
                  const code = e.target.value;
                  if (code === CUSTOM_TAX_CODE) {
                    setTaxRegion(CUSTOM_TAX_CODE);
                  } else {
                    const region = US_TAX_REGIONS.find((r) => r.code === code);
                    if (region) {
                      setTaxRegion(code);
                      setTaxRate(region.rate);
                    }
                  }
                }}
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none"
              >
                <option value="">Select a region…</option>
                {US_TAX_REGIONS.map((r) => (
                  <option key={r.code} value={r.code}>
                    {r.name} ({r.code}) — {formatTaxRate(r.rate)}
                  </option>
                ))}
                <option value={CUSTOM_TAX_CODE}>Custom rate %</option>
              </select>
            </div>
            {taxRegion === CUSTOM_TAX_CODE && (
              <div>
                <label htmlFor="taxRate" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Custom tax rate (%)
                </label>
                <input
                  id="taxRate"
                  type="number"
                  min="0"
                  max="50"
                  step="0.001"
                  value={taxRate === 0 ? '' : taxRate * 100}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value);
                    if (!isNaN(v) && v >= 0 && v <= 50) {
                      setTaxRate(v / 100);
                    } else if (e.target.value === '') {
                      setTaxRate(0);
                    }
                  }}
                  placeholder="e.g. 8.875"
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none"
                />
                <p className="mt-1 text-xs text-gray-500">Enter the tax percentage.</p>
              </div>
            )}
            {taxRegion && taxRegion !== CUSTOM_TAX_CODE && (
              <div className="flex items-center gap-2 text-sm text-blue-700">
                <span className="font-medium">Rate: {formatTaxRate(taxRate)}</span>
              </div>
            )}
            {/* Tax label input */}
            <div className="mt-3">
              <label htmlFor="taxLabel" className="block text-sm font-medium text-gray-700 mb-1.5">
                Tax Display Label
              </label>
              <input
                id="taxLabel"
                type="text"
                value={taxLabel}
                onChange={(e) => setTaxLabel(e.target.value)}
                placeholder="e.g. Sales Tax, VAT, GST"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none"
              />
            </div>

            {/* Disclaimer */}
            <div className="mt-3 rounded bg-blue-50 border border-blue-200 px-3 py-2 text-xs text-blue-700">
              Funds reserved for tax remittance. Microstore does not file or pay taxes on your
              behalf.
            </div>

            {(!taxRegion || taxRate === 0) && (
              <div className="rounded bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-700">
                No tax region selected. Please select a region or enter a custom rate.
              </div>
            )}
          </div>
        )}
        <div className="space-y-3">
          <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-rose-50">
                <Heart className="h-5 w-5 text-rose-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">Charity round-up</p>
                <p className="text-xs text-gray-500">Let customers round up to donate</p>
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={charityEnabled}
              onClick={() => setCharityEnabled(!charityEnabled)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${charityEnabled ? 'bg-blue-600' : 'bg-gray-200'}`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow ring-0 transition-transform ${charityEnabled ? 'translate-x-5' : 'translate-x-0'}`}
              />
            </button>
          </div>
          {charityEnabled && (
            <div className="rounded-lg border border-rose-200 bg-rose-50/50 p-3">
              <p className="text-xs font-medium text-rose-800 mb-2">Partner charities</p>
              <div className="flex flex-wrap gap-2">
                {CHARITY_PARTNERS.map((p) => (
                  <span
                    key={p}
                    className="inline-flex items-center gap-1.5 rounded-full border border-rose-200 bg-white px-3 py-1 text-xs font-medium text-rose-700"
                  >
                    <Heart className="h-3 w-3 fill-rose-400 text-rose-400" />
                    {p}
                  </span>
                ))}
              </div>
              <p className="mt-2 text-xs text-rose-600/70">
                Donations are split equally between these partners.
              </p>
            </div>
          )}
        </div>
      </div>
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Wallet className="h-4 w-4 text-purple-500" />
          <h2 className="text-sm font-semibold text-gray-900">Payment Setup (Solana)</h2>
        </div>

        {/* ---- Connect Wallet ---- */}
        <div className="rounded-lg border border-purple-200 bg-purple-50/50 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-purple-900">Merchant wallet</p>
              <p className="text-xs text-purple-600/70">
                {connected
                  ? 'Your connected wallet will receive payments.'
                  : 'Connect your Solana wallet to auto-fill this field.'}
              </p>
            </div>
            <WalletMultiButton className="!rounded-lg !bg-purple-600 !py-2 !px-4 !text-sm !font-medium !h-auto hover:!bg-purple-700" />
          </div>
          {connected && publicKey && (
            <div className="flex items-center gap-2 rounded-md bg-white border border-purple-200 px-3 py-2">
              <Check className="h-4 w-4 text-green-500 shrink-0" />
              <span className="text-sm font-mono text-gray-700 select-all">
                {publicKey.toBase58()}
              </span>
              <span className="text-xs text-gray-400 shrink-0">
                ({truncateAddress(publicKey.toBase58())})
              </span>
            </div>
          )}
          {/* Manual entry fallback — always visible so user can override */}
          <details className="group">
            <summary className="text-xs text-gray-500 cursor-pointer hover:text-purple-600 select-none">
              {connected
                ? 'Override with a different wallet...'
                : 'Or paste a wallet address manually...'}
            </summary>
            <div className="mt-2">
              <input
                id="merchantWallet"
                type="text"
                value={merchantWallet}
                onChange={(e) => setMerchantWallet(e.target.value)}
                placeholder="Your Solana public key"
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-mono placeholder:text-gray-500 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 outline-none"
              />
            </div>
          </details>
        </div>

        <div>
          <label
            htmlFor="taxSetAsideWallet"
            className="block text-sm font-medium text-gray-700 mb-1.5"
          >
            Tax wallet (optional)
          </label>
          <input
            id="taxSetAsideWallet"
            type="text"
            value={taxSetAsideWallet}
            onChange={(e) => setTaxSetAsideWallet(e.target.value)}
            placeholder="Tax wallet public key"
            className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-mono placeholder:text-gray-500 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 outline-none"
          />
          {taxSetAsideWallet && merchantWallet && taxSetAsideWallet === merchantWallet && (
            <p className="mt-1 text-xs text-purple-600">
              Defaults to merchant wallet. Edit above to override.
            </p>
          )}
        </div>
        <div>
          <label htmlFor="charityWallet" className="block text-sm font-medium text-gray-700 mb-1.5">
            Charity wallet (optional)
          </label>
          <select
            id="charityWalletSelect"
            value={
              charityWalletMode === 'custom'
                ? 'custom'
                : (CHARITY_WALLET_OPTIONS.find((o) => o.address === charityWallet)?.address ?? '')
            }
            onChange={(e) => {
              const val = e.target.value;
              if (val === 'custom') {
                setCharityWalletMode('custom');
              } else {
                setCharityWalletMode('preset');
                setCharityWallet(val);
              }
            }}
            className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-900 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 outline-none"
          >
            {CHARITY_WALLET_OPTIONS.map((opt) => (
              <option key={opt.label} value={opt.address || 'custom'}>
                {opt.label}
              </option>
            ))}
          </select>
          {charityWalletMode === 'custom' && (
            <div className="mt-2">
              <input
                id="charityWallet"
                type="text"
                value={charityWallet}
                onChange={(e) => setCharityWallet(e.target.value)}
                placeholder="Charity public key"
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-mono placeholder:text-gray-500 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 outline-none"
              />
            </div>
          )}
          {charityWalletMode === 'preset' && charityWallet && (
            <p className="mt-1 text-xs text-purple-600">
              Defaults to{' '}
              {CHARITY_WALLET_OPTIONS.find((o) => o.address === charityWallet)?.label ??
                'charity wallet'}
              .
            </p>
          )}
        </div>
        <TokenPicker
          selected={acceptedTokens}
          onAdd={addAcceptedToken}
          onRemove={removeAcceptedToken}
          onReorder={reorderAcceptedTokens}
          cluster="devnet"
        />
        <p className="text-xs text-gray-500">
          Select one or more SPL tokens your shop accepts. Drag to reorder -- the first token is the
          default.
        </p>
      </div>
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Wallet className="h-4 w-4 text-emerald-500" />
          <h2 className="text-sm font-semibold text-gray-900">Payment Setup (Tari)</h2>
          <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">
            Optional
          </span>
        </div>
        <div>
          <label htmlFor="tariWallet" className="block text-sm font-medium text-gray-700 mb-1.5">
            Tari wallet (optional)
          </label>
          <input
            id="tariWallet"
            type="text"
            value={tariWallet}
            onChange={(e) => setTariWallet(e.target.value)}
            placeholder="Tari public key"
            className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-mono placeholder:text-gray-500 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none"
          />
        </div>
        <div>
          <label htmlFor="tariNetwork" className="block text-sm font-medium text-gray-700 mb-1.5">
            Tari network
          </label>
          <select
            id="tariNetwork"
            value={tariNetwork}
            onChange={(e) => setTariNetwork(e.target.value as 'igor' | 'mainnet')}
            className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-900 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none"
          >
            <option value="igor">Igor (Testnet)</option>
            <option value="nextnet">NextNet</option>
            <option value="mainnet">MainNet</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Accepted Tari tokens (comma-separated)
          </label>
          <input
            type="text"
            value={tariAcceptedTokens.map((t) => t.symbol).join(', ')}
            onChange={(e) => {
              const tokens = e.target.value
                .split(',')
                .map((t) => t.trim())
                .filter(Boolean)
                .map((symbol) => ({ symbol }));
              useCreateShopStore.getState().setTariAcceptedTokens(tokens);
            }}
            placeholder="XTR, TARI"
            className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm placeholder:text-gray-500 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none"
          />
          <p className="mt-1 text-xs text-gray-500">
            Tari tokens your shop accepts. Leave empty to accept native TARI only.
          </p>
        </div>
      </div>

      {/* PIN Setup (optional) */}
      <div className="space-y-3 rounded-lg border border-blue-200 bg-blue-50/50 p-4">
        <div className="flex items-center gap-2">
          <Lock className="h-4 w-4 text-blue-600" />
          <h3 className="text-sm font-semibold text-gray-900">Security PIN (optional)</h3>
        </div>
        <p className="text-xs text-gray-600">
          Set a 4&ndash;6 digit PIN to lock admin settings. You can also set this later.
        </p>
        <input
          type="password"
          inputMode="numeric"
          autoComplete="new-password"
          value={shopPin}
          onChange={(e) => {
            const v = e.target.value.replace(/\D/g, '').slice(0, 6);
            setShopPin(v);
            if (v.length > 0 && (v.length < 4 || v.length > 6)) {
              setShopPinError('PIN must be 4–6 digits');
            } else {
              setShopPinError(null);
            }
          }}
          placeholder="4–6 digit PIN"
          className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm placeholder:text-gray-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none"
        />
        {shopPinError && <p className="text-xs text-red-600">{shopPinError}</p>}
        {shopPin.length >= 4 && shopPin.length <= 6 && !shopPinError && (
          <p className="text-xs text-blue-600">PIN looks good — will be saved with your shop.</p>
        )}
      </div>

      <div className="sticky bottom-20 -mx-4 bg-gray-50 px-4 py-4 border-t border-gray-100">
        <button
          type="submit"
          disabled={saving}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Store className="h-4 w-4" />
          {saving ? 'Creating shop...' : 'Create shop'}
        </button>
      </div>
    </form>
  );
}
