'use client';

import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Store,
  Settings,
  HandCoins,
  Heart,
  ShieldCheck,
  Wallet,
  ExternalLink,
  Loader2,
  Package,
  AlertTriangle,
  Clock,
} from 'lucide-react';
import { db, type Shop } from '@/lib/db';

// ---------------------------------------------------------------------------
// Shop Detail Page
// ---------------------------------------------------------------------------

export default function ShopDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const shopId = parseInt(id, 10);

  const [shop, setShop] = useState<Shop | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        if (isNaN(shopId) || shopId <= 0) {
          if (!cancelled) setError('Invalid shop ID.');
          if (!cancelled) setLoading(false);
          return;
        }

        const s = await db.shops.get(shopId);
        if (!s) {
          if (!cancelled) setError(`Shop #${shopId} not found.`);
          if (!cancelled) setLoading(false);
          return;
        }

        if (!cancelled) setShop(s);
      } catch (err) {
        console.error('Shop detail load error:', err);
        if (!cancelled) setError('Failed to load shop details.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [shopId]);

  // -----------------------------------------------------------------------
  // Loading
  // -----------------------------------------------------------------------

  if (loading) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center text-gray-400">
        <Loader2 className="mb-4 h-10 w-10 animate-spin text-blue-500" />
        <p className="text-sm font-medium text-gray-500">Loading shop…</p>
      </div>
    );
  }

  // -----------------------------------------------------------------------
  // Error / Not Found
  // -----------------------------------------------------------------------

  if (error || !shop) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gray-100">
          <AlertTriangle className="h-7 w-7 text-gray-400" />
        </div>
        <h2 className="mt-4 text-lg font-bold text-gray-900">Shop Not Found</h2>
        <p className="mt-1 text-sm text-gray-500">{error ?? 'Shop not found.'}</p>
        <Link
          href="/shops"
          className="mt-4 inline-flex items-center gap-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Shops
        </Link>
      </div>
    );
  }

  // -----------------------------------------------------------------------
  // Computed
  // -----------------------------------------------------------------------

  const hasWalletConfig = !!(shop.merchantWallet && shop.splTokenMint);
  const createdAt = new Date(shop.createdAt);
  const updatedAt = new Date(shop.updatedAt);

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <div className="flex flex-col gap-5 pb-8">
      {/* Back + header */}
      <div className="flex items-center gap-3">
        <Link
          href="/shops"
          className="rounded-full p-2 -ml-2 text-gray-500 hover:bg-gray-100 transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-900">{shop.name}</h1>
          <p className="text-sm text-gray-500">@{shop.username}</p>
        </div>
        <Link
          href="/settings"
          className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <Settings className="h-3.5 w-3.5" />
          Edit
        </Link>
      </div>

      {/* Photo + description */}
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <div className="flex items-start gap-4">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gray-100">
            {shop.photoUrl ? (
              <img
                src={shop.photoUrl}
                alt={shop.name}
                className="h-full w-full object-cover"
              />
            ) : (
              <Store className="h-10 w-10 text-gray-300" />
            )}
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            {shop.description ? (
              <p className="text-sm text-gray-600">{shop.description}</p>
            ) : (
              <p className="text-sm text-gray-400 italic">No description</p>
            )}
            <div className="flex flex-wrap gap-1.5">
              <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2.5 py-0.5 text-[11px] font-medium text-green-700">
                <ShieldCheck className="h-3 w-3" />
                {shop.taxAllocationEnabled ? 'Tax enabled' : 'Tax disabled'}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-0.5 text-[11px] font-medium text-rose-700">
                <Heart className="h-3 w-3" />
                {shop.charityEnabled ? 'Charity enabled' : 'Charity disabled'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Tip presets */}
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-gray-700">
          <HandCoins className="h-4 w-4 text-amber-500" />
          Tip Presets
        </h2>
        <div className="flex flex-wrap gap-2">
          {shop.tipPresets.length > 0 ? (
            shop.tipPresets.sort((a, b) => a - b).map((pct) => (
              <span
                key={pct}
                className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-sm font-medium text-gray-700"
              >
                {pct === 0 ? 'No tip' : `${pct}%`}
              </span>
            ))
          ) : (
            <span className="text-sm text-gray-400">No tip presets configured</span>
          )}
        </div>
      </div>

      {/* Charity partners */}
      {shop.charityEnabled && shop.charityPartners.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-gray-700">
            <Heart className="h-4 w-4 text-rose-500" />
            Charity Partners
          </h2>
          <div className="flex flex-wrap gap-2">
            {shop.charityPartners.map((partner) => (
              <span
                key={partner}
                className="inline-flex items-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-sm font-medium text-rose-700"
              >
                <Heart className="h-3 w-3 fill-rose-400 text-rose-400" />
                {partner}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Wallet configuration */}
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-gray-700">
          <Wallet className="h-4 w-4 text-purple-500" />
          Payment Setup (Solana)
        </h2>

        {!hasWalletConfig ? (
          <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-700">
            Wallet not configured. Set up your merchant wallet and SPL token mint in Settings to accept payments.
          </div>
        ) : (
          <div className="space-y-3">
            <WalletRow
              label="Merchant Wallet"
              address={shop.merchantWallet!}
              description="Receives subtotal + tip"
            />
            {shop.taxWallet && shop.taxWallet !== shop.merchantWallet && (
              <WalletRow
                label="Tax Wallet"
                address={shop.taxWallet}
                description="Receives sales tax"
              />
            )}
            {shop.charityWallet && shop.charityWallet !== shop.merchantWallet && (
              <WalletRow
                label="Charity Wallet"
                address={shop.charityWallet}
                description="Receives round-up donations"
              />
            )}
          </div>
        )}

        {shop.splTokenMint && (
          <div className="mt-3 flex items-center gap-3 rounded-lg bg-gray-50 px-3 py-2 text-xs">
            <Package className="h-3.5 w-3.5 text-gray-400" />
            <div>
              <span className="text-gray-500">SPL Token: </span>
              <span className="font-mono text-gray-700">{shop.splTokenMint.slice(0, 8)}…{shop.splTokenMint.slice(-4)}</span>
              {shop.splTokenSymbol && (
                <span className="ml-1 font-semibold text-gray-900">({shop.splTokenSymbol})</span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Timestamps */}
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-gray-700">
          <Clock className="h-4 w-4 text-gray-400" />
          Details
        </h2>
        <div className="space-y-1 text-sm text-gray-500">
          <p>Shop ID: <span className="font-mono text-gray-700">#{shop.id}</span></p>
          <p>
            Created:{' '}
            {createdAt.toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            })}
          </p>
          <p>
            Updated:{' '}
            {updatedAt.toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </p>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helper: wallet row
// ---------------------------------------------------------------------------

function WalletRow({
  label,
  address,
  description,
}: {
  label: string;
  address: string;
  description: string;
}) {
  return (
    <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
      <div className="flex items-center justify-between mb-0.5">
        <span className="text-xs font-medium text-gray-700">{label}</span>
        <a
          href={`https://explorer.solana.com/address/${address}?cluster=devnet`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-gray-400 hover:text-blue-500 transition-colors"
        >
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>
      <p className="text-[11px] text-gray-400">{description}</p>
      <p className="mt-1 font-mono text-[11px] text-gray-500 truncate">{address}</p>
    </div>
  );
}
