'use client';

import { useState, useRef, useCallback, useEffect, type FormEvent } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Camera, Store, X, Heart, HandCoins, ShieldCheck, Wallet, Loader2, Check, AlertTriangle, ChevronDown } from 'lucide-react';
import { db } from '@/lib/db';
import { useCreateShopStore } from '@/lib/createShopStore';
import { useAppStore } from '@/lib/store';
import { getKnownTokens, type KnownToken, validateMint } from '@/lib/solanaTokens';
import { getConnection } from '@/lib/solanaPay';

const CHARITY_PARTNERS = ['GiveDirectly', 'Local Food Bank'];
const TIP_PERCENTAGES = [0, 10, 15, 20];

export default function CreateShopPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Token preset selector state
  const [tokenPreset, setTokenPreset] = useState<string>('custom'); // 'custom' | symbol
  const [showTokenDropdown, setShowTokenDropdown] = useState(false);
  const [validatingMint, setValidatingMint] = useState(false);
  const [mintValid, setMintValid] = useState<boolean | null>(null); // null = not checked, true = valid, false = invalid
  const [mintError, setMintError] = useState<string | null>(null);
  const [mintDecimals, setMintDecimals] = useState<number | null>(null);

  const knownTokens = getKnownTokens('devnet'); // default to devnet; could be made dynamic

  const {
    name, username, photoUrl, description,
    tipPresets, taxAllocationEnabled, charityEnabled,
    merchantWallet, taxWallet, charityWallet,
    splTokenMint, splTokenSymbol,
    setName, setUsername, setPhotoUrl, setDescription,
    toggleTipPreset, setTaxAllocationEnabled, setCharityEnabled,
    setMerchantWallet, setTaxWallet, setCharityWallet,
    setSplTokenMint, setSplTokenSymbol,
    reset,
  } = useCreateShopStore();

  const { setActiveShopId } = useAppStore();

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Clean up previous object URL
    if (photoUrl) URL.revokeObjectURL(photoUrl);
    const objectUrl = URL.createObjectURL(file);
    setPhotoUrl(objectUrl);
  };

  const handleRemovePhoto = () => {
    if (photoUrl) URL.revokeObjectURL(photoUrl);
    setPhotoUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // --- Token preset selection + validation --------------------------------

  const handleTokenPresetSelect = useCallback(
    (token: KnownToken) => {
      setTokenPreset(token.symbol);
      setShowTokenDropdown(false);
      setSplTokenMint(token.mint);
      setSplTokenSymbol(token.symbol);
      setMintDecimals(token.decimals);
      setMintValid(true);
      setMintError(null);
    },
    [setSplTokenMint, setSplTokenSymbol],
  );

  const handleCustomToken = useCallback(() => {
    setTokenPreset('custom');
    setSplTokenMint('');
    setSplTokenSymbol('');
    setMintValid(null);
    setMintError(null);
    setMintDecimals(null);
  }, [setSplTokenMint, setSplTokenSymbol]);

  // Debounced on-chain mint validation
  useEffect(() => {
    if (tokenPreset !== 'custom' || !splTokenMint.trim()) {
      // Preset tokens are pre-validated; empty field = no validation
      if (tokenPreset === 'custom' && !splTokenMint.trim()) {
        setMintValid(null);
        setMintError(null);
        setMintDecimals(null);
      }
      return;
    }

    const mint = splTokenMint.trim();
    // Minimum 32 chars for a Solana base58 pubkey
    if (mint.length < 32) {
      setMintValid(null);
      setMintError(null);
      setMintDecimals(null);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      setValidatingMint(true);
      setMintValid(null);
      setMintError(null);

      try {
        const connection = getConnection('devnet'); // default to devnet
        const result = await validateMint(mint, connection);
        if (!cancelled) {
          setMintValid(result.valid);
          setMintError(result.error ?? null);
          if (result.decimals != null) setMintDecimals(result.decimals);
        }
      } catch {
        if (!cancelled) {
          setMintValid(false);
          setMintError('Failed to validate mint on-chain. Check your connection.');
        }
      } finally {
        if (!cancelled) setValidatingMint(false);
      }
    }, 600); // 600ms debounce

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [splTokenMint, tokenPreset]);

  const slugFromName = (n: string) =>
    n.toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedName = name.trim();
    const trimmedUsername = username.trim();

    if (!trimmedName) {
      setError('Shop name is required.');
      return;
    }
    if (!trimmedUsername) {
      setError('Username / @ slug is required.');
      return;
    }
    if (tipPresets.length === 0) {
      setError('Select at least one tip preset.');
      return;
    }

    setSaving(true);
    try {
      const id = await db.shops.add({
        name: trimmedName,
        username: trimmedUsername,
        photoUrl: photoUrl ?? undefined,
        description: description.trim() || undefined,
        tipPresets,
        taxAllocationEnabled,
        charityEnabled,
        charityPartners: charityEnabled ? CHARITY_PARTNERS : [],
        merchantWallet: merchantWallet.trim() || undefined,
        taxWallet: taxWallet.trim() || undefined,
        charityWallet: charityWallet.trim() || undefined,
        splTokenMint: splTokenMint.trim() || undefined,
        splTokenSymbol: splTokenSymbol.trim() || undefined,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      setActiveShopId(id as number);
      reset();
      router.push('/');
    } catch (err) {
      setError('Failed to save shop. Please try again.');
      console.error('Save shop error:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col min-h-[calc(100vh-8rem)]">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-full p-2 -ml-2 text-gray-500 hover:bg-gray-100 transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Create Shop</h1>
          <p className="text-sm text-gray-500">Set up your merchant profile</p>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="flex-1 space-y-6">
        {/* Photo Upload */}
        <div className="flex flex-col items-center gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className={`relative flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border-2 border-dashed transition-colors ${
              photoUrl
                ? 'border-blue-400'
                : 'border-gray-300 hover:border-blue-400 bg-gray-50'
            }`}
          >
            {photoUrl ? (
              <>
                <Image
                  src={photoUrl}
                  alt="Shop photo preview"
                  fill sizes="96px" className="object-cover" unoptimized
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
          {photoUrl ? (
            <button
              type="button"
              onClick={handleRemovePhoto}
              className="text-xs text-gray-500 hover:text-red-500 transition-colors"
            >
              Remove photo
            </button>
          ) : (
            <span className="text-xs text-gray-500">Add shop photo</span>
          )}
        </div>

        {/* Shop Name */}
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
            className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-colors"
            autoFocus
          />
        </div>

        {/* Username / @ slug */}
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
              className="w-full rounded-lg border border-gray-300 pl-8 pr-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-colors"
            />
          </div>
          <p className="mt-1 text-xs text-gray-500">
            Your unique shop handle — used in links and payments.
          </p>
        </div>

        {/* One-line Description */}
        <div>
          <label htmlFor="shopDesc" className="block text-sm font-medium text-gray-700 mb-1.5">
            Description
          </label>
          <input
            id="shopDesc"
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Fresh groceries &amp; daily essentials"
            className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-colors"
            maxLength={120}
          />
          <p className="mt-1 text-xs text-gray-500">
            {description.length}/120 — a short tagline for your shop.
          </p>
        </div>

        {/* Tip Presets */}
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
                  className={`rounded-full px-4 py-2 text-sm font-medium transition-all ${
                    active
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {pct === 0 ? 'No tip' : `${pct}%`}
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-gray-500">
            Customers can choose from these tip amounts at checkout.
          </p>
        </fieldset>

        {/* Tax Allocation */}
        <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-green-50">
              <ShieldCheck className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">Tax allocation</p>
              <p className="text-xs text-gray-500">Auto-calculate and report sales tax</p>
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={taxAllocationEnabled}
            onClick={() => setTaxAllocationEnabled(!taxAllocationEnabled)}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none ${
              taxAllocationEnabled ? 'bg-blue-600' : 'bg-gray-200'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow ring-0 transition-transform ${
                taxAllocationEnabled ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* Charity Partner */}
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
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none ${
                charityEnabled ? 'bg-blue-600' : 'bg-gray-200'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow ring-0 transition-transform ${
                  charityEnabled ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {charityEnabled && (
            <div className="rounded-lg border border-rose-200 bg-rose-50/50 p-3">
              <p className="text-xs font-medium text-rose-800 mb-2">Partner charities</p>
              <div className="flex flex-wrap gap-2">
                {CHARITY_PARTNERS.map((partner) => (
                  <span
                    key={partner}
                    className="inline-flex items-center gap-1.5 rounded-full border border-rose-200 bg-white px-3 py-1 text-xs font-medium text-rose-700"
                  >
                    <Heart className="h-3 w-3 fill-rose-400 text-rose-400" />
                    {partner}
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

      {/* Solana Wallet Configuration */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Wallet className="h-4 w-4 text-purple-500" />
          <h2 className="text-sm font-semibold text-gray-900">Payment Setup (Solana)</h2>
        </div>
        <p className="text-xs text-gray-500 -mt-3">
          Configure wallets for atomic split payments. Required for POS checkout.
        </p>

        {/* Merchant Wallet */}
        <div>
          <label htmlFor="merchantWallet" className="block text-sm font-medium text-gray-700 mb-1.5">
            Merchant wallet
          </label>
          <input
            id="merchantWallet"
            type="text"
            value={merchantWallet}
            onChange={(e) => setMerchantWallet(e.target.value)}
            placeholder="Your Solana public key (base58)"
            className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-500 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 outline-none transition-colors font-mono"
          />
          <p className="mt-1 text-xs text-gray-500">Receives the subtotal + tip from each payment.</p>
        </div>

        {/* Tax Wallet */}
        <div>
          <label htmlFor="taxWallet" className="block text-sm font-medium text-gray-700 mb-1.5">
            Tax wallet (optional)
          </label>
          <input
            id="taxWallet"
            type="text"
            value={taxWallet}
            onChange={(e) => setTaxWallet(e.target.value)}
            placeholder="Tax authority public key"
            className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-500 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 outline-none transition-colors font-mono"
          />
          <p className="mt-1 text-xs text-gray-500">Receives the sales tax portion. Falls back to merchant wallet.</p>
        </div>

        {/* Charity Wallet */}
        <div>
          <label htmlFor="charityWallet" className="block text-sm font-medium text-gray-700 mb-1.5">
            Charity wallet (optional)
          </label>
          <input
            id="charityWallet"
            type="text"
            value={charityWallet}
            onChange={(e) => setCharityWallet(e.target.value)}
            placeholder="Charity public key"
            className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-500 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 outline-none transition-colors font-mono"
          />
          <p className="mt-1 text-xs text-gray-500">Receives charity round-up donations. Falls back to merchant wallet.</p>
        </div>

        {/* SPL Token Preset + Mint */}
        <div className="space-y-3">
          <label className="block text-sm font-medium text-gray-700">Payment token</label>

          {/* Token preset dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowTokenDropdown(!showTokenDropdown)}
              className="flex w-full items-center justify-between rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-900 hover:border-purple-400 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 outline-none transition-colors"
            >
              <span className={tokenPreset === 'custom' ? 'text-gray-500' : 'font-medium text-purple-700'}>
                {tokenPreset === 'custom' ? 'Select a token or enter custom…' : `${tokenPreset} — ${knownTokens.find((t: KnownToken) => t.symbol === tokenPreset)?.name ?? ''}`}
              </span>
              <ChevronDown className={`h-4 w-4 text-gray-500 transition-transform ${showTokenDropdown ? 'rotate-180' : ''}`} />
            </button>

            {showTokenDropdown && (
              <div className="absolute z-10 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg">
                {knownTokens.map((token: KnownToken) => (
                  <button
                    key={token.mint}
                    type="button"
                    onClick={() => handleTokenPresetSelect(token)}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-purple-50 transition-colors first:rounded-t-lg"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-100 text-xs font-bold text-purple-700">
                      {token.symbol.slice(0, 3)}
                    </div>
                    <div className="text-left">
                      <div className="font-medium">{token.symbol}</div>
                      <div className="text-xs text-gray-500">{token.name} · {token.decimals} decimals</div>
                    </div>
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    handleCustomToken();
                    setShowTokenDropdown(false);
                  }}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-gray-500 hover:bg-gray-50 transition-colors rounded-b-lg border-t border-gray-100"
                >
                  <Wallet className="h-4 w-4" />
                  Custom token…
                </button>
              </div>
            )}
          </div>

          {/* Mint address + symbol (always visible, auto-filled by preset) */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label htmlFor="splTokenMint" className="block text-xs font-medium text-gray-500 mb-1">
                Mint address
              </label>
              <div className="relative">
                <input
                  id="splTokenMint"
                  type="text"
                  value={splTokenMint}
                  onChange={(e) => {
                    setSplTokenMint(e.target.value);
                    if (tokenPreset !== 'custom') {
                      // User edited a preset → switch to custom mode
                      setTokenPreset('custom');
                      setSplTokenSymbol('');
                    }
                  }}
                  placeholder="Token mint address (base58)"
                  className={`w-full rounded-lg border px-4 py-2.5 text-sm font-mono placeholder:text-gray-500 focus:ring-2 outline-none transition-colors ${
                    mintValid === true
                      ? 'border-green-400 focus:border-green-500 focus:ring-green-500/20 pr-10'
                      : mintValid === false
                        ? 'border-red-300 focus:border-red-500 focus:ring-red-500/20 pr-10'
                        : 'border-gray-300 focus:border-purple-500 focus:ring-purple-500/20'
                  }`}
                />
                {/* Validation indicator */}
                {validatingMint && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-gray-500" />
                )}
                {!validatingMint && mintValid === true && (
                  <Check className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-green-500" />
                )}
                {!validatingMint && mintValid === false && (
                  <AlertTriangle className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-red-400" />
                )}
              </div>
              {/* Validation message */}
              {mintError && (
                <p className="mt-1 text-xs text-red-500">{mintError}</p>
              )}
              {mintValid === true && mintDecimals != null && (
                <p className="mt-1 text-xs text-green-600">
                  Mint verified · {mintDecimals} decimals
                </p>
              )}
            </div>
            <div>
              <label htmlFor="splTokenSymbol" className="block text-xs font-medium text-gray-500 mb-1">
                Symbol
              </label>
              <input
                id="splTokenSymbol"
                type="text"
                value={splTokenSymbol}
                onChange={(e) => setSplTokenSymbol(e.target.value)}
                placeholder="USDC"
                maxLength={10}
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-500 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 outline-none transition-colors text-center"
              />
            </div>
          </div>
          <p className="text-xs text-gray-500">
            The SPL token customers will pay with. Choose USDC or enter a custom mint address.
          </p>
        </div>
      </div>

      {/* Submit */}
      <div className="sticky bottom-20 -mx-4 bg-gray-50 px-4 py-4 border-t border-gray-100">
        <button
          type="submit"
          disabled={saving}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Store className="h-4 w-4" />
          {saving ? 'Creating shop...' : 'Create shop'}
        </button>
      </div>
    </form>
  );
}