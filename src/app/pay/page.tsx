'use client';

import { useEffect, useState, useMemo, Suspense } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  AlertTriangle,
  Clock,
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
import { usePayStore, type PayErrorCode, type PaymentChain } from '@/lib/payStore';
import { createSolanaPayURL, generateQRCode } from '@/lib/solanaPay';
import { generateTariQR } from '@/lib/tariPay';
import PaymentConfirmation from '@/components/PaymentConfirmation';

// ---------------------------------------------------------------------------
// Suspense fallback
// ---------------------------------------------------------------------------

function PayPageFallback() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-gray-500">
      <Loader2 className="mb-4 h-10 w-10 animate-spin text-blue-500" />
      <p className="text-sm font-medium text-gray-500">Loading payment…</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helper: Compute the display values from order + split
// ---------------------------------------------------------------------------

function useComputedBreakdown() {
  const { order, shop, split, networkFee, paymentChain } = usePayStore();

  return useMemo(() => {
    if (!order || !split) return null;

    const subtotal = order.subtotal;
    const tip = order.tip;
    const tax = order.tax;
    const charity = order.charity;
    const total = order.total;
    const grandTotal = total + networkFee;
    const tokenSymbol =
      paymentChain === 'tari' ? (order.tariTokenSymbol ?? 'XTM') : (shop?.splTokenSymbol ?? 'SPL');
    const chain: PaymentChain = paymentChain;

    return {
      subtotal,
      tip,
      tax,
      charity,
      total,
      networkFee,
      grandTotal,
      tokenSymbol,
      chain,
      merchantAmount: split.merchant.amount,
      taxAmount: split.tax.amount,
      charityAmount: split.charity.amount,
    };
  }, [order, split, shop, networkFee, paymentChain]);
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
      <span className="text-sm font-medium tabular-nums">${amount.toFixed(2)}</span>
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
    case 'TX_FAILED':
      return 'Transaction Failed';
    case 'TX_TIMEOUT':
      return 'Payment Not Detected';
    case 'WRONG_AMOUNT':
      return 'Incorrect Amount';
    default:
      return 'Payment Issue';
  }
}

// ---------------------------------------------------------------------------
// Pay Page
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
  const {
    order,
    shop,
    split,
    loading,
    error,
    confirmState,
    payState,
    paymentRefPubkey,
    loadOrder,
    reset,
    paymentChain,
    tariDeepLink,
  } = usePayStore();
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
        if (paymentChain === 'tari' && tariDeepLink) {
          // Tari QR — use precomputed deep link from payStore
          const qr = await generateTariQR(tariDeepLink, { width: 240 });
          if (!cancelled) setQrDataURL(qr);
        } else {
          const payURL = createSolanaPayURL({
            recipient: shop!.merchantWallet,
            amount: breakdown!.total,
            splToken: order?.splTokenMint,
            reference: paymentRefPubkey ?? undefined,
            label: shop!.name,
            message: `Payment to ${shop!.name} — ${order?.items.length ?? 0} item(s)`,
            memo: `microshop:${order?.shopId}:${order?.id}`,
          });
          const qr = await generateQRCode(payURL, { width: 240 });
          if (!cancelled) setQrDataURL(qr);
        }
      } catch {
        // Silently fail — QR is supplemental
      } finally {
        if (!cancelled) setQrGenerating(false);
      }
    }

    genQR();
    return () => {
      cancelled = true;
    };
  }, [breakdown, shop, order, paymentChain, tariDeepLink, paymentRefPubkey]);

  // Derive header state from the payment state machine
  const isFinalized = payState === 'finalized';
  const isWaiting = payState === 'awaiting_scan' || payState === 'broadcasting';
  const isConfirming = payState === 'confirming';
  const isTerminal = payState === 'expired' || payState === 'failed' || payState === 'cancelled';

  // State machine header labels
  function stateLabel(): string {
    switch (payState) {
      case 'awaiting_scan': return 'Scan to Pay';
      case 'broadcasting': return 'Transaction Detected';
      case 'confirming': return 'Confirming Payment';
      case 'finalized': return 'Paid ✓';
      case 'expired': return 'Payment Expired';
      case 'failed': return 'Payment Failed';
      case 'cancelled': return 'Cancelled';
      default: return 'Scan to Pay';
    }
  }

  function stateSubtitle(): string {
    switch (payState) {
      case 'awaiting_scan': return `Scan the QR code with your wallet to pay ${shop!.name}`;
      case 'broadcasting': return 'Transaction seen on-chain, awaiting confirmation…';
      case 'confirming': return 'Transaction confirmed, waiting for finality…';
      case 'finalized': return `Payment to ${shop!.name} confirmed on-chain.`;
      case 'expired': return 'No payment detected within the timeout window.';
      case 'failed': return 'The transaction did not complete successfully.';
      case 'cancelled': return 'This payment was cancelled.';
      default: return `Confirm your payment to ${shop!.name}`;
    }
  }

  function stateIcon() {
    if (isFinalized) return <CheckCircleIcon className="h-7 w-7 text-green-500" />;
    if (isConfirming) return <Loader2 className="h-7 w-7 animate-spin text-blue-500" />;
    if (isWaiting) return <Zap className="h-7 w-7 text-blue-600" />;
    return <AlertTriangle className="h-7 w-7 text-amber-400" />;
  }

  function stateBg(): string {
    if (isFinalized) return 'bg-green-50';
    if (isConfirming) return 'bg-blue-50';
    if (isWaiting) return 'bg-blue-50';
    if (isTerminal) return 'bg-amber-50';
    return 'bg-gray-50';
  }

  // -----------------------------------------------------------------------
  // Loading state
  // -----------------------------------------------------------------------

  if (loading) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center text-gray-500">
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
        <h2 className="mt-4 text-lg font-bold text-gray-900">{errorTitle(error.code)}</h2>
        <p className="mt-1 max-w-xs text-sm text-gray-500">{error.userMessage}</p>
        <p className="mt-4 text-xs text-gray-500">
          {error.code === 'NETWORK_ERROR'
            ? 'Network error — retrying automatically. If this persists, check your connection.'
            : error.code === 'WALLET_REJECTED'
              ? 'Transaction rejected by wallet. You can try again or use a different wallet.'
              : error.code === 'TX_TIMEOUT'
                ? 'Payment not detected on-chain. Your funds are safe — nothing has been debited.'
                : error.code === 'TX_FAILED'
                  ? 'Transaction failed on the Solana network. No funds were transferred.'
                  : error.code === 'WRONG_AMOUNT'
                    ? 'The amount sent does not match the order total. Please try again with the correct amount.'
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
          <QrCode className="h-7 w-7 text-gray-500" />
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
      <div className="flex min-h-[60vh] flex-col items-center justify-center text-gray-500">
        <p className="text-sm">Order not available.</p>
      </div>
    );
  }

  // -----------------------------------------------------------------------
  // Main render: Order + QR + Confirmation Monitor
  // -----------------------------------------------------------------------

  return (
    <div className="mx-auto max-w-md space-y-5 pb-8">
      {/* Header */}
      <div className="text-center">
        <div
          className={`mx-auto flex h-14 w-14 items-center justify-center rounded-full ${stateBg()}`}
        >
          {stateIcon()}
        </div>
        <h1 className="mt-3 text-xl font-bold text-gray-900">{stateLabel()}</h1>
        <p className="mt-1 text-sm text-gray-500">{stateSubtitle()}</p>
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
                  <span className="ml-1 text-xs text-gray-500">×{oi.quantity}</span>
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
          <SplitRow label="Subtotal" amount={breakdown.subtotal} accent="text-gray-600" />
          {breakdown.tip > 0 && (
            <SplitRow
              icon={HandCoins}
              label={`Tip (${order.tipPercent}%)`}
              amount={breakdown.tip}
              accent="text-amber-600"
            />
          )}
          {shop.taxAllocationEnabled && breakdown.tax > 0 && (
            <SplitRow
              icon={ShieldCheck}
              label="Tax (8.875%)"
              amount={breakdown.tax}
              accent="text-green-600"
            />
          )}
          {shop.charityEnabled && breakdown.charity > 0 && (
            <SplitRow
              icon={Heart}
              label={`Donation — ${split?.charity.label ?? 'Charity'}`}
              amount={breakdown.charity}
              accent="text-rose-600"
            />
          )}
        </div>

        <div className="my-3 border-t border-gray-200" />

        <div className="flex items-center justify-between">
          <span className="text-base font-bold text-gray-900">Total</span>
          <span className="text-lg font-bold tabular-nums text-gray-900">
            ${breakdown.total.toFixed(2)}
          </span>
        </div>

        <div className="mt-2 flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 text-xs">
          <span className="inline-flex items-center gap-1 text-gray-500">
            <Clock className="h-3 w-3" />
            Estimated network fee
          </span>
          <span className="font-medium tabular-nums text-gray-600">
            ~${breakdown.networkFee.toFixed(3)}
          </span>
        </div>

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
                1 + (split.tax.amount > 0 ? 1 : 0) + (split.charity.amount > 0 ? 1 : 0);
              return `${legCount} transfer${legCount !== 1 ? 's' : ''} execute atomically — either all succeed or all fail.`;
            })()}
          </p>
        </div>
      )}

      {/* QR Code — hidden after finalized */}
      {!isFinalized && (
        <div className="rounded-xl border border-gray-200 bg-white p-4 text-center">
          <div className="mb-3 flex items-center justify-center gap-3">
            <h2 className="flex items-center gap-1.5 text-sm font-semibold text-gray-700">
              <QrCode className="h-4 w-4" /> Scan with Wallet
            </h2>
            {/* Chain badge */}
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${
                paymentChain === 'tari'
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-blue-100 text-blue-700'
              }`}
            >
              {paymentChain === 'tari' ? 'Tari' : 'Solana'}
            </span>
            {/* Ootle Token badge — shown when paying with a non-native Tari token */}
            {paymentChain === 'tari' &&
              order.tariTokenSymbol &&
              order.tariTokenSymbol !== 'XTM' && (
                <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                  Ootle Token
                </span>
              )}
          </div>

          {qrGenerating ? (
            <div className="flex h-[240px] items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-gray-300" />
            </div>
          ) : qrDataURL ? (
            <div className="flex justify-center">
              <div className="overflow-hidden rounded-xl border-2 border-gray-200">
                <Image src={qrDataURL} alt="Payment QR Code" width={240} height={240} unoptimized />
              </div>
            </div>
          ) : null}

          <p className="mt-3 text-xs text-gray-500">
            {paymentChain === 'tari'
              ? 'Scan this QR code with your Tari wallet to confirm payment.'
              : 'Scan this QR code with your Solana wallet to confirm payment.'}
          </p>
        </div>
      )}

      {/* Payment Confirmation Monitor */}
      <PaymentConfirmation />

      {/* Back to merchant link */}
      <div className="text-center">
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-xs text-gray-500 transition-colors hover:text-gray-600"
        >
          <Store className="h-3 w-3" />
          Powered by Microstore
        </Link>
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
      <span className="ml-2 shrink-0 font-medium tabular-nums">${amount.toFixed(2)}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// CheckCircleIcon — inline SVG to avoid extra icon import
// ---------------------------------------------------------------------------

function CheckCircleIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}
