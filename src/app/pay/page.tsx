'use client';

import { useEffect, useState, useMemo, Suspense } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Loader2,
  QrCode,
  RefreshCw,
  Store,
} from 'lucide-react';
import { usePayStore, type PayErrorCode, type PaymentChain } from '@/lib/payStore';
import { createSolanaPayURL, generateQRCode } from '@/lib/solanaPay';
import { generateTariQR } from '@/lib/tariPay';

// ---------------------------------------------------------------------------
// Suspense fallback
// ---------------------------------------------------------------------------

function PayPageFallback() {
  return (
    <div className="flex min-h-[80vh] flex-col items-center justify-center">
      <Loader2 className="mb-4 h-10 w-10 animate-spin text-blue-500" />
      <p className="text-sm font-medium text-gray-400">Loading payment…</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Error title helper
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
// Pay Page — Presenter / Customer View
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
    payState,
    networkFee,
    paymentRefPubkey,
    regenerationCount,
    currentBlockhash,
    regenerating,
    loadOrder,
    reset,
    paymentChain,
    tariDeepLink,
    startConfirmation,
    stopConfirmation,
    retryConfirmation,
    retryCount,
    regenerateQR,
  } = usePayStore();

  const [qrDataURL, setQrDataURL] = useState<string | null>(null);
  const [qrGenerating, setQrGenerating] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const [qrRefreshed, setQrRefreshed] = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);

  const MAX_REGENERATIONS = 3;

  // ── Derived values ──────────────────────────────────────────────────

  const total = useMemo(() => {
    if (!order) return 0;
    return order.total + networkFee;
  }, [order, networkFee]);

  const tokenSymbol = useMemo((): string => {
    if (!order || !shop) return '';
    if (paymentChain === 'tari') return order.tariTokenSymbol ?? 'XTM';
    return shop.splTokenSymbol ?? 'SPL';
  }, [order, shop, paymentChain]);

  // ATA cost disclosure: show when Solana payment has non-zero
  // tax/charity legs going to wallets that may need associated token accounts
  const showATANotice = useMemo(() => {
    if (paymentChain !== 'solana' || !split) return false;
    const hasTaxLeg = split.tax.amount > 0;
    const hasCharityLeg = split.charity.amount > 0;
    return hasTaxLeg || hasCharityLeg;
  }, [paymentChain, split]);

  // ── Load order on mount ─────────────────────────────────────────────

  useEffect(() => {
    if (orderIdParam) {
      const id = parseInt(orderIdParam, 10);
      if (!isNaN(id) && id > 0) loadOrder(id);
    }
    return () => reset();
  }, [orderIdParam]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Start confirmation polling once order is loaded ──────────────────

  useEffect(() => {
    if (order && shop) {
      startConfirmation();
      return () => stopConfirmation();
    }
  }, [order?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Generate QR code ────────────────────────────────────────────────

  useEffect(() => {
    if (!order || !shop) return;

    let cancelled = false;

    async function genQR() {
      setQrGenerating(true);
      try {
        if (paymentChain === 'tari' && tariDeepLink) {
          const qr = await generateTariQR(tariDeepLink, { width: 280 });
          if (!cancelled) setQrDataURL(qr);
        } else {
          const payURL = createSolanaPayURL({
            recipient: shop!.merchantWallet,
            amount: order!.total,
            splToken: order?.splTokenMint,
            reference: paymentRefPubkey ?? undefined,
            label: shop!.name,
            message: `Payment to ${shop!.name}`,
            memo: `microstore:${order!.shopId}:${order!.id}`,
            blockhash: currentBlockhash ?? undefined,
          });
          const qr = await generateQRCode(payURL, { width: 280 });
          if (!cancelled) setQrDataURL(qr);
        }
      } catch {
        // QR is supplemental — silently fail
      } finally {
        if (!cancelled) setQrGenerating(false);
      }
    }

    genQR();
    return () => {
      cancelled = true;
    };
  }, [order, shop, paymentChain, tariDeepLink, paymentRefPubkey, currentBlockhash]);

  // ── Countdown timer + auto-regeneration ──────────────────────────────

  useEffect(() => {
    // Reset countdown when blockhash changes (new QR generated).
    // TODO(post-phase-0): replace with the "derive from props" pattern to avoid
    // the set-state-in-effect lint violation. See React docs §"You Might Not Need an Effect".
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCountdown(60);

    setQrRefreshed(false);
  }, [currentBlockhash]);

  useEffect(() => {
    // Only run countdown when QR is visible and payment is pending
    if (
      sessionExpired ||
      payState === 'finalized' ||
      payState === 'expired' ||
      payState === 'failed' ||
      payState === 'cancelled' ||
      paymentChain !== 'solana'
    ) {
      return;
    }

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          // Time's up — trigger regeneration
          clearInterval(timer);
          void regenerateQR().then((success) => {
            if (!success) {
              // Max regenerations reached
              setSessionExpired(true);
            } else {
              // Show brief "QR refreshed" indicator
              setQrRefreshed(true);
              setTimeout(() => setQrRefreshed(false), 2500);
            }
          });
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [payState, paymentChain, regenerationCount, sessionExpired, regenerateQR]);

  // ── State helpers ───────────────────────────────────────────────────

  const isFinalized = payState === 'finalized';
  const isTerminal = payState === 'expired' || payState === 'failed' || payState === 'cancelled';
  const isProcessing = payState === 'broadcasting' || payState === 'confirming';

  function stateLabel(): string {
    switch (payState) {
      case 'awaiting_scan':
        return 'Scan to pay';
      case 'broadcasting':
        return 'Approving in your wallet…';
      case 'confirming':
        return 'Confirming payment…';
      case 'finalized':
        return 'Paid ✓';
      case 'expired':
        return 'Payment expired';
      case 'failed':
        return 'Payment failed — please try again';
      case 'cancelled':
        return 'Payment cancelled';
      default:
        return 'Scan to pay';
    }
  }

  function stateColor(): string {
    if (isFinalized) return 'text-green-600';
    if (isProcessing) return 'text-blue-600';
    if (isTerminal) return 'text-red-500';
    return 'text-gray-700';
  }

  // ── Loading ─────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex min-h-[80vh] flex-col items-center justify-center">
        <Loader2 className="mb-4 h-10 w-10 animate-spin text-blue-500" />
        <p className="text-sm font-medium text-gray-400">Loading payment details…</p>
      </div>
    );
  }

  // ── Error ───────────────────────────────────────────────────────────

  if (error) {
    return (
      <div className="flex min-h-[80vh] flex-col items-center justify-center px-4 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-50">
          <AlertTriangle className="h-8 w-8 text-red-400" />
        </div>
        <h2 className="mt-4 text-xl font-bold text-gray-900">{errorTitle(error.code)}</h2>
        <p className="mt-2 max-w-xs text-sm text-gray-500">{error.userMessage}</p>
        <p className="mt-4 text-xs text-gray-400">
          {error.code === 'NETWORK_ERROR'
            ? 'Network error — retrying automatically. If this persists, check your connection.'
            : error.code === 'WALLET_REJECTED'
              ? 'Transaction rejected by wallet. You can try again or use a different wallet.'
              : error.code === 'TX_TIMEOUT'
                ? 'Payment not detected on-chain. Your funds are safe — nothing has been debited.'
                : error.code === 'TX_FAILED'
                  ? 'Transaction failed on the network. No funds were transferred.'
                  : error.code === 'WRONG_AMOUNT'
                    ? 'The amount sent does not match the order total. Please try again with the correct amount.'
                    : 'If this problem persists, please contact the merchant.'}
        </p>
      </div>
    );
  }

  // ── Missing orderId ─────────────────────────────────────────────────

  if (!orderIdParam) {
    return (
      <div className="flex min-h-[80vh] flex-col items-center justify-center px-4 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
          <QrCode className="h-8 w-8 text-gray-400" />
        </div>
        <h2 className="mt-4 text-xl font-bold text-gray-900">No Payment Found</h2>
        <p className="mt-2 text-sm text-gray-500">
          Scan a payment QR code from a Microstore merchant to pay.
        </p>
      </div>
    );
  }

  // ── No order loaded ─────────────────────────────────────────────────

  if (!order || !shop) {
    return (
      <div className="flex min-h-[80vh] flex-col items-center justify-center">
        <p className="text-sm text-gray-400">Order not available.</p>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════
  // PRESENTER MODE — Customer-facing, no chrome, no split breakdown
  // ═══════════════════════════════════════════════════════════════════════

  return (
    <div className="flex flex-col items-center justify-center min-h-[85vh] space-y-8">
      {/* ── Shop name ──────────────────────────────────────────────── */}
      <div className="text-center">
        <div className="mb-1 inline-flex items-center gap-1.5 text-gray-400">
          <Store className="h-3.5 w-3.5" />
          <span className="text-xs font-medium uppercase tracking-wider">Pay to</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">{shop.name}</h1>
      </div>

      {/* ── Total amount ───────────────────────────────────────────── */}
      <div className="text-center">
        <p className="mb-1 text-sm text-gray-400">Total</p>
        <p className="text-5xl font-extrabold tabular-nums tracking-tight text-gray-900">
          ${total.toFixed(2)}
        </p>
        <p className="mt-1 text-sm font-medium text-gray-400">{tokenSymbol}</p>

        {/* Ootle Token badge — shown when paying with a non-native Tari token */}
        {paymentChain === 'tari' && order.tariTokenSymbol && order.tariTokenSymbol !== 'XTM' && (
          <span className="mt-1.5 inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
            Ootle Token
          </span>
        )}
      </div>

      {/* ── QR Code (hidden after finalized / terminal) ────────────── */}
      {!isFinalized && !isTerminal && !sessionExpired && (
        <div className="flex flex-col items-center">
          {regenerating ? (
            <div className="flex h-[280px] w-[280px] flex-col items-center justify-center rounded-2xl border-2 border-amber-200 bg-amber-50">
              <Loader2 className="mb-3 h-8 w-8 animate-spin text-amber-500" />
              <p className="text-sm font-medium text-amber-600">Regenerating…</p>
            </div>
          ) : qrGenerating ? (
            <div className="flex h-[280px] w-[280px] items-center justify-center rounded-2xl border-2 border-gray-100 bg-gray-50">
              <Loader2 className="h-8 w-8 animate-spin text-gray-300" />
            </div>
          ) : qrDataURL ? (
            <div className="overflow-hidden rounded-2xl border-2 border-gray-200 bg-white shadow-sm">
              <Image
                src={qrDataURL}
                alt="Payment QR Code"
                width={280}
                height={280}
                unoptimized
                priority
              />
            </div>
          ) : (
            <div className="flex h-[280px] w-[280px] items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50">
              <QrCode className="h-10 w-10 text-gray-300" />
            </div>
          )}

          {/* ── Countdown timer ─────────────────────────────────────── */}
          {paymentChain === 'solana' && !regenerating && !qrGenerating && qrDataURL && (
            <div className="mt-3 flex items-center gap-1.5">
              <Clock
                className={`h-3.5 w-3.5 ${countdown <= 10 ? 'text-red-500' : 'text-gray-400'}`}
              />
              <span
                className={`text-xs font-medium tabular-nums ${
                  countdown <= 10 ? 'text-red-500' : 'text-gray-400'
                }`}
              >
                QR expires in {countdown}s
              </span>
            </div>
          )}

          {/* ── QR refreshed indicator ──────────────────────────────── */}
          {qrRefreshed && (
            <div className="mt-1 animate-[fadeIn_0.3s_ease-out] rounded-full bg-green-50 px-2.5 py-0.5">
              <span className="text-[11px] font-semibold text-green-600">✓ QR refreshed</span>
            </div>
          )}

          {/* ── Regeneration counter pill ───────────────────────────── */}
          {regenerationCount > 0 && regenerationCount < MAX_REGENERATIONS && (
            <div className="mt-1">
              <span className="text-[10px] text-gray-400">
                {regenerationCount}/{MAX_REGENERATIONS} regenerations used
              </span>
            </div>
          )}

          {/* Chain badge */}
          <span
            className={`mt-3 inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
              paymentChain === 'tari'
                ? 'bg-emerald-100 text-emerald-700'
                : 'bg-blue-100 text-blue-700'
            }`}
          >
            {paymentChain === 'tari' ? 'Tari' : 'Solana'} Payment
          </span>

          {/* ATA cost disclosure */}
          {showATANotice && (
            <p className="mt-2 max-w-[280px] text-center text-[10px] leading-relaxed text-gray-400">
              The first payment to a new destination may include a small one-time fee (~0.002 SOL)
              to create a token account.
            </p>
          )}
        </div>
      )}

      {/* ── Session expired state ───────────────────────────────────── */}
      {sessionExpired && (
        <div className="flex flex-col items-center">
          <div className="flex h-24 w-24 items-center justify-center rounded-full bg-amber-50 shadow-sm">
            <Clock className="h-12 w-12 text-amber-400" />
          </div>
          <p className="mt-4 text-lg font-bold text-gray-800">Session expired</p>
          <p className="mt-1 max-w-xs text-center text-sm text-gray-500">
            Please create a new order.
          </p>
          <Link
            href="/"
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
          >
            <Store className="h-4 w-4" />
            New Order
          </Link>
        </div>
      )}

      {/* ── Finalized icon ─────────────────────────────────────────── */}
      {isFinalized && (
        <div className="flex flex-col items-center">
          <div className="flex h-24 w-24 items-center justify-center rounded-full bg-green-100 shadow-sm">
            <CheckCircle2 className="h-14 w-14 text-green-500" />
          </div>
        </div>
      )}

      {/* ── Terminal icon ──────────────────────────────────────────── */}
      {isTerminal && (
        <div className="flex flex-col items-center">
          <div className="flex h-24 w-24 items-center justify-center rounded-full bg-red-50 shadow-sm">
            <AlertTriangle className="h-14 w-14 text-red-400" />
          </div>
        </div>
      )}

      {/* ── State label ────────────────────────────────────────────── */}
      <div className="text-center">
        <p className={`text-xl font-bold ${stateColor()}`}>{stateLabel()}</p>

        {isProcessing && (
          <div className="mt-3 flex justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
          </div>
        )}

        {/* Progress bar — only when processing */}
        {isProcessing && (
          <div className="mx-auto mt-4 h-1 w-48 overflow-hidden rounded-full bg-gray-100">
            <div className="h-full w-1/2 animate-[pulse_2s_ease-in-out_infinite] rounded-full bg-blue-400" />
          </div>
        )}

        {/* Retry button — terminal states, under retry limit */}
        {isTerminal && retryCount < 2 && payState !== 'cancelled' && (
          <button
            onClick={retryConfirmation}
            className="mt-5 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 active:bg-blue-800"
          >
            <RefreshCw className="h-4 w-4" />
            Try Again
          </button>
        )}

        {/* Max retries message */}
        {isTerminal && retryCount >= 2 && (
          <p className="mt-4 text-xs text-gray-400">
            Maximum retry attempts reached. Please contact the merchant.
          </p>
        )}
      </div>

      {/* ── Wallet hints ───────────────────────────────────────────── */}
      {!isFinalized && !isTerminal && !sessionExpired && (
        <div className="flex items-center gap-3 text-xs text-gray-400">
          {paymentChain !== 'tari' ? (
            <>
              <span>Phantom</span>
              <span className="text-gray-300">·</span>
              <span>Solflare</span>
              <span className="text-gray-300">·</span>
              <span>Backpack</span>
            </>
          ) : (
            <span>Tari Wallet</span>
          )}
        </div>
      )}

      {/* ── Footer ─────────────────────────────────────────────────── */}
      <div className="text-center">
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-xs text-gray-400 transition-colors hover:text-gray-500"
        >
          <Store className="h-3 w-3" />
          Powered by Microstore
        </Link>
      </div>
    </div>
  );
}
