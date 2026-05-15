'use client';

import { useEffect, useState, useMemo, Suspense } from 'react';
import Image from 'next/image';
import { useSearchParams } from 'next/navigation';
import {
  AlertTriangle,
  ArrowRight,
  Clock,
  ExternalLink,
  HandCoins,
  Heart,
  Loader2,
  QrCode,
  ShieldCheck,
  ShoppingCart,
  Store,
  Wallet,
  Zap,
} from 'lucide-react';
import { usePayStore, type PayErrorCode } from '@/lib/payStore';
import {
  createSolanaPayURL,
  generateQRCode,
  computeAtomicSplit,
} from '@/lib/solanaPay';

// ---------------------------------------------------------------------------
// Suspense fallback
// ---------------------------------------------------------------------------

function PayPageFallback() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-gray-400">
      <Loader2 className="mb-4 h-10 w-10 animate-spin text-blue-500" />
      <p className="text-sm font-medium text-gray-500">Loading payment…</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helper: Compute the display values from order + split
// ---------------------------------------------------------------------------

function useComputedBreakdown() {
  const { order, shop, split, networkFee } = usePayStore();

  return useMemo(() => {
    if (!order || !split) return null;

    const subtotal = order.subtotal;
    const tip = order.tip;
    const tax = order.tax;
    const charity = order.charity;
    const total = order.total;
    const grandTotal = total + networkFee;
    const tokenSymbol = shop?.splTokenSymbol ?? 'SPL';

    return {
      subtotal,
      tip,
      tax,
      charity,
      total,
      networkFee,
      grandTotal,
      tokenSymbol,
      merchantAmount: split.merchant.amount,
      taxAmount: split.tax.amount,
      charityAmount: split.charity.amount,
    };
  }, [order, split, shop, networkFee]);
}

// ---------------------------------------------------------------------------
// Helper: individual breakdown rows
// ---------------------------------------------------------------------------

function SplitRow({
  icon: Icon,
  label,
  amount,
  accent,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  label: string;
  amount: number;
  accent: string;
}) {
  return (
    <div className={`flex items-center justify-between py-1.5 ${accent}`}>
      <span className="inline-flex items-center gap-1.5 text-sm">
        {Icon && <Icon className="h-3.5 w-3.5 opacity-70" />}
        {label}
      </span>
      <span className="text-sm font-medium tabular-nums">
        ${amount.toFixed(2)}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helper: human-readable title for each error code
// ---------------------------------------------------------------------------

function errorTitle(code: PayErrorCode): string {
  switch (code) {
    case 'ORDER_NOT_FOUND':
      return 'Payment Not Found';
    case 'SHOP_NOT_FOUND':
      return 'Shop Unavailable';
    case 'WALLET_REJECTED':
      return 'Transaction Rejected';
    case 'NETWORK_ERROR':
      return 'Network Error';
    case 'DB_LOAD_FAILED':
      return 'Loading Failed';
  }
}

// ---------------------------------------------------------------------------
// Pay Confirmation Page
// ---------------------------------------------------------------------------

export default function PayPage() {
  return (
    <Suspense fallback={<PayPageFallback />}>
      <PayPageInner />
    </Suspense>
  );
}

function PayPageInner() {
  const searchParams = useSearchParams();
  const orderIdParam = searchParams.get('orderId');
  const { order, shop, split, loading, error, loadOrder, reset } = usePayStore();
  const breakdown = useComputedBreakdown();

  const [qrDataURL, setQrDataURL] = useState<string | null>(null);
  const [qrGenerating, setQrGenerating] = useState(false);

  // Load order on mount + orderId change
  useEffect(() => {
    if (orderIdParam) {
      const id = parseInt(orderIdParam, 10);
      if (!isNaN(id) && id > 0) {
        loadOrder(id);
      }
    }
    return () => reset();
  }, [orderIdParam]); // eslint-disable-line react-hooks/exhaustive-deps

  // Generate QR code for the full payment amount
  useEffect(() => {
    if (!breakdown || !shop) return;

    let cancelled = false;

    async function genQR() {
      setQrGenerating(true);
      try {
        const payURL = createSolanaPayURL({
          recipient: shop!.merchantWallet,
          amount: breakdown!.total,
          splToken: order?.splTokenMint,
          label: shop!.name,
          message: `Payment to ${shop!.name} — ${order?.items.length ?? 0} item(s)`,
          memo: `microshop:${order?.shopId}:${order?.id}`,
        });
        const qr = await generateQRCode(payURL, { width: 240 });
        if (!cancelled) setQrDataURL(qr);
      } catch {
        // Silently fail — QR is supplemental
      } finally {
        if (!cancelled) setQrGenerating(false);
      }
    }

    genQR();
    return () => { cancelled = true; };
  }, [breakdown, shop, order]); // eslint-disable-line react-hooks/exhaustive-deps

  // -----------------------------------------------------------------------
  // Loading state
  // -----------------------------------------------------------------------

  if (loading) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center text-gray-400">
        <Loader2 className="mb-4 h-10 w-10 animate-spin text-blue-500" />
        <p className="text-sm font-medium text-gray-500">Loading payment details…</p>
      </div>
    );
  }

  // -----------------------------------------------------------------------
  // Error state
  // -----------------------------------------------------------------------

  if (error) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
        <div
          className={`flex h-14 w-14 items-center justify-center rounded-full ${
            error.code === 'NETWORK_ERROR' || error.code === 'DB_LOAD_FAILED'
              ? 'bg-amber-50'
              : 'bg-red-50'
          }`}
        >
          <AlertTriangle
            className={`h-7 w-7 ${
              error.code === 'NETWORK_ERROR' || error.code === 'DB_LOAD_FAILED'
                ? 'text-amber-400'
                : 'text-red-400'
            }`}
          />
        </div>
        <h2 className="mt-4 text-lg font-bold text-gray-900">
          {errorTitle(error.code)}
        </h2>
        <p className="mt-1 max-w-xs text-sm text-gray-500">
          {error.userMessage}
        </p>
        <p className="mt-4 text-xs text-gray-400">
          {error.code === 'NETWORK_ERROR'
            ? 'Network error — retrying automatically. If this persists, check your connection.'
            : error.code === 'WALLET_REJECTED'
              ? 'Transaction rejected by wallet. You can try again or use a different wallet.'
              : 'If this problem persists, please contact the merchant.'}
        </p>
      </div>
    );
  }

  // -----------------------------------------------------------------------
  // No orderId param
  // -----------------------------------------------------------------------

  if (!orderIdParam) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gray-100">
          <QrCode className="h-7 w-7 text-gray-400" />
        </div>
        <h2 className="mt-4 text-lg font-bold text-gray-900">No Payment Found</h2>
        <p className="mt-1 text-sm text-gray-500">
          Scan a payment QR code from a Microstore merchant to pay.
        </p>
      </div>
    );
  }

  // -----------------------------------------------------------------------
  // No order loaded
  // -----------------------------------------------------------------------

  if (!order || !breakdown || !shop) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center text-gray-400">
        <p className="text-sm">Order not available.</p>
      </div>
    );
  }

  // -----------------------------------------------------------------------
  // Already paid
  // -----------------------------------------------------------------------

  const isPaid = order.status === 'paid';

  // -----------------------------------------------------------------------
  // Main render
  // -----------------------------------------------------------------------

  return (
    <div className="mx-auto max-w-md space-y-5 pb-8">
      {/* Header */}
      <div className="text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-blue-50">
          <Zap className="h-7 w-7 text-blue-600" />
        </div>
        <h1 className="mt-3 text-xl font-bold text-gray-900">
          {isPaid ? 'Payment Complete' : 'Scan to Pay'}
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          {isPaid
            ? 'This order has been paid.'
            : `Confirm your payment to ${shop.name}`}
        </p>
      </div>

      {/* Order summary */}
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-gray-700">
          <ShoppingCart className="h-4 w-4" /> Order Summary
        </h2>
        <div className="space-y-2">
          {order.items.map((oi, i) => (
            <div key={i} className="flex items-center justify-between text-sm">
              <span className="text-gray-700">
                {oi.name}
                {oi.quantity > 1 && (
                  <span className="ml-1 text-xs text-gray-400">×{oi.quantity}</span>
                )}
              </span>
              <span className="font-medium tabular-nums text-gray-900">
                ${(oi.price * oi.quantity).toFixed(2)}
              </span>
            </div>
          ))}
        </div>
        <div className="mt-3 border-t border-gray-100 pt-2 text-sm text-gray-500">
          {order.items.length} item{order.items.length !== 1 ? 's' : ''} from{' '}
          <span className="font-medium text-gray-700">{shop.name}</span>
        </div>
      </div>

      {/* Atomic Split Breakdown */}
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-gray-700">
          <Zap className="h-4 w-4 text-blue-500" /> Atomic Split Breakdown
        </h2>

        <div className="space-y-0.5 divide-y divide-gray-50">
          {/* Subtotal */}
          <SplitRow
            label="Subtotal"
            amount={breakdown.subtotal}
            accent="text-gray-600"
          />

          {/* Tip */}
          {breakdown.tip > 0 && (
            <SplitRow
              icon={HandCoins}
              label={`Tip (${order.tipPercent}%)`}
              amount={breakdown.tip}
              accent="text-amber-600"
            />
          )}

          {/* Tax */}
          {shop.taxAllocationEnabled && breakdown.tax > 0 && (
            <SplitRow
              icon={ShieldCheck}
              label="Tax (8.875%)"
              amount={breakdown.tax}
              accent="text-green-600"
            />
          )}

          {/* Charity / Donation */}
          {shop.charityEnabled && breakdown.charity > 0 && (
            <SplitRow
              icon={Heart}
              label={`Donation — ${split?.charity.label ?? 'Charity'}`}
              amount={breakdown.charity}
              accent="text-rose-600"
            />
          )}
        </div>

        {/* Divider */}
        <div className="my-3 border-t border-gray-200" />

        {/* Total */}
        <div className="flex items-center justify-between">
          <span className="text-base font-bold text-gray-900">Total</span>
          <span className="text-lg font-bold tabular-nums text-gray-900">
            ${breakdown.total.toFixed(2)}
          </span>
        </div>

        {/* Network fee */}
        <div className="mt-2 flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 text-xs">
          <span className="inline-flex items-center gap-1 text-gray-500">
            <Clock className="h-3 w-3" />
            Estimated network fee
          </span>
          <span className="font-medium tabular-nums text-gray-600">
            ~${breakdown.networkFee.toFixed(3)}
          </span>
        </div>

        {/* Balance after payment (informational) */}
        <div className="mt-2 flex items-center justify-between rounded-lg bg-blue-50 px-3 py-2 text-xs">
          <span className="inline-flex items-center gap-1 text-blue-700">
            <Wallet className="h-3 w-3" />
            {breakdown.tokenSymbol} to debit from wallet
          </span>
          <span className="font-bold tabular-nums text-blue-700">
            {breakdown.tokenSymbol} {breakdown.grandTotal.toFixed(2)}
          </span>
        </div>
      </div>

      {/* Split destination addresses */}
      {split && (
        <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-4">
          <p className="mb-2 text-xs font-semibold text-blue-800">
            Transaction will atomically split into:
          </p>
          <div className="space-y-2 text-xs">
            <AddressRow
              label={split.merchant.label}
              address={split.merchant.address}
              amount={split.merchant.amount}
              accent="text-blue-700"
            />
            {shop.taxAllocationEnabled && split.tax.amount > 0 && (
              <AddressRow
                label={split.tax.label}
                address={split.tax.address}
                amount={split.tax.amount}
                accent="text-green-700"
              />
            )}
            {shop.charityEnabled && split.charity.amount > 0 && (
              <AddressRow
                label={split.charity.label}
                address={split.charity.address}
                amount={split.charity.amount}
                accent="text-rose-700"
              />
            )}
          </div>
          <p className="mt-2 text-[10px] text-blue-500/70">
            {(() => {
              const legCount =
                1 +
                (split.tax.amount > 0 ? 1 : 0) +
                (split.charity.amount > 0 ? 1 : 0);
              return `${legCount} transfer${legCount !== 1 ? 's' : ''} execute atomically — either all succeed or all fail.`;
            })()}
          </p>
        </div>
      )}

      {/* QR Code (for wallet scanning) */}
      <div className="rounded-xl border border-gray-200 bg-white p-4 text-center">
        <h2 className="mb-3 flex items-center justify-center gap-1.5 text-sm font-semibold text-gray-700">
          <QrCode className="h-4 w-4" /> Scan with Wallet
        </h2>

        {qrGenerating ? (
          <div className="flex h-[240px] items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-gray-300" />
          </div>
        ) : qrDataURL ? (
          <div className="flex justify-center">
            <div className="overflow-hidden rounded-xl border-2 border-gray-200">
              <Image
                src={qrDataURL}
                alt="Payment QR Code"
                width={240} height={240} unoptimized
              />
            </div>
          </div>
        ) : null}

        <p className="mt-3 text-xs text-gray-400">
          Scan this QR code with your Solana wallet to confirm payment.
        </p>
      </div>

      {/* Status badges */}
      {isPaid && (
        <div className="rounded-xl border border-green-200 bg-green-50 p-3 text-center">
          <p className="text-sm font-medium text-green-700">
            ✅ This order was paid on {new Date(order.updatedAt).toLocaleDateString()}
          </p>
          {order.txSignature && (
            <a
              href={`https://solscan.io/tx/${order.txSignature}?cluster=devnet`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-flex items-center gap-1 text-xs text-green-600 hover:text-green-800"
            >
              View on Solscan <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      )}

      {/* Back to merchant link */}
      <div className="text-center">
        <a
          href="/"
          className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors"
        >
          <Store className="h-3 w-3" />
          Powered by Microstore
        </a>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helper: address row for split destinations
// ---------------------------------------------------------------------------

function AddressRow({
  label,
  address,
  amount,
  accent,
}: {
  label: string;
  address: string;
  amount: number;
  accent: string;
}) {
  const shortAddr = `${address.slice(0, 4)}…${address.slice(-4)}`;
  return (
    <div className={`flex items-center justify-between ${accent}`}>
      <div className="min-w-0 flex-1">
        <span className="font-medium">{label}</span>
        <span className="ml-1.5 text-[10px] opacity-60">{shortAddr}</span>
      </div>
      <span className="ml-2 shrink-0 font-medium tabular-nums">
        ${amount.toFixed(2)}
      </span>
    </div>
  );
}
