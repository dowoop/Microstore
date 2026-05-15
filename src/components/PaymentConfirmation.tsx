'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Download,
  ExternalLink,
  HandCoins,
  Heart,
  Loader2,
  RefreshCw,
  ShieldCheck,
  ShoppingBag,
  Store,
  Wallet,
  XCircle,
  Zap,
  Volume2,
} from 'lucide-react';
import { usePayStore, type PayErrorCode } from '@/lib/payStore';

// ---------------------------------------------------------------------------
// Audio feedback for payment finalization
// ---------------------------------------------------------------------------

/**
 * Plays a short chime sound when payment is finalized.
 * Non-negotiable for retail — the merchant needs audio feedback.
 * Uses the Web Audio API to generate a pleasant 200ms chime.
 */
function playFinalizedChime() {
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    // Two-tone chime: C5 → E5 (pleasant "ding-ding")
    osc.frequency.setValueAtTime(523.25, ctx.currentTime);      // C5
    osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.1); // E5

    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.3);
  } catch {
    // AudioContext may not be available (SSR, restrictive browser policies)
    // Silently continue — the visual confirmation is the fallback.
  }
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type { MonitorState } from '@/lib/txMonitor';

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
// Payment Confirmation — main component
// ---------------------------------------------------------------------------

export default function PaymentConfirmation() {
  const {
    order,
    shop,
    split,
    networkFee,
    confirmState,
    payState,
    txSignature,
    txBlockTime,
    amountMismatch,
    retryCount,
    error,
    paymentChain,
    startConfirmation,
    stopConfirmation,
    retryConfirmation,
  } = usePayStore();

  const [showSplitDetail, setShowSplitDetail] = useState(false);
  const soundPlayedRef = useRef(false);

  // Play chime sound when payment is finalized
  useEffect(() => {
    if (payState === 'finalized' && !soundPlayedRef.current) {
      soundPlayedRef.current = true;
      playFinalizedChime();
    }
  }, [payState]);

  // Start monitoring once order is loaded
  useEffect(() => {
    if (order && shop) {
      soundPlayedRef.current = false;
      startConfirmation();
      return () => stopConfirmation();
    }
  }, [order?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!order || !shop || !split) return null;

  const grandTotal = order.total + networkFee;
  const tokenSymbol = paymentChain === 'tari' ? 'XTM' : shop.splTokenSymbol;
  const isFinalized = payState === 'finalized';
  const isTerminal =
    payState === 'failed' ||
    payState === 'expired' ||
    payState === 'cancelled';
  const awaiting = payState === 'awaiting_scan' || payState === 'broadcasting' || payState === 'confirming';

  // -------------------------------------------------------------------
  // Success state — Payment Complete!
  // -------------------------------------------------------------------

  if (isFinalized && txSignature) {
    return (
      <div className="space-y-5">
        {/* Success header */}
        <SuccessBanner
          shopName={shop.name}
          total={grandTotal}
          tokenSymbol={tokenSymbol}
          txSignature={txSignature}
          txBlockTime={txBlockTime}
        />

        {/* Paid breakdown */}
        <PaidBreakdown order={order} split={split} networkFee={networkFee} />

        {/* Atomic split detail (collapsible) */}
        <SplitDetail
          split={split}
          show={showSplitDetail}
          onToggle={() => setShowSplitDetail((v) => !v)}
          tokenSymbol={tokenSymbol}
          taxEnabled={shop.taxAllocationEnabled}
          charityEnabled={shop.charityEnabled}
        />

        {/* Explorer link */}
        <ExplorerLink signature={txSignature} chain={paymentChain} />

        {/* Download receipt */}
        <DownloadReceiptButton order={order} shop={shop} chain={paymentChain} />
      </div>
    );
  }

  // -------------------------------------------------------------------
  // Awaiting confirmation — spinner + scanning prompt
  // -------------------------------------------------------------------

  if (awaiting) {
    return (
      <div className="space-y-5">
        <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-6 text-center">
          {payState === 'confirming' ? (
            <>
              <div className="mx-auto flex h-16 w-16 items-center justify-center">
                <Loader2 className="h-10 w-10 animate-spin text-blue-500" />
              </div>
              <h2 className="mt-4 text-lg font-bold text-gray-900">
                Confirming Payment…
              </h2>
              <p className="mt-1 text-sm text-gray-600">
                {paymentChain === 'tari'
                  ? 'Transaction detected on Tari network. Waiting for finality.'
                  : 'Transaction detected on Solana. Waiting for network confirmation.'}
              </p>
              <p className="mt-2 text-xs text-gray-400">
                This usually takes only a few seconds.
              </p>
            </>
          ) : (
            <>
              <div className="mx-auto flex h-16 w-16 items-center justify-center">
                <div className="relative">
                  <Loader2 className="h-10 w-10 animate-spin text-blue-400" />
                  <Wallet className="absolute inset-0 m-auto h-5 w-5 text-blue-600" />
                </div>
              </div>
              <h2 className="mt-4 text-lg font-bold text-gray-900">
                Awaiting Payment
              </h2>
              <p className="mt-1 text-sm text-gray-600">
                Scan the QR code with your {paymentChain === 'tari' ? 'Tari' : 'Solana'} wallet to pay{' '}
                <span className="font-semibold text-gray-900">
                  ${grandTotal.toFixed(2)}
                </span>{' '}
                to {shop.name}.
              </p>

              {retryCount > 0 && (
                <p className="mt-2 text-xs text-amber-600">
                  Retry {retryCount} of 3 — monitoring for your payment…
                </p>
              )}
            </>
          )}

          {/* Progress bar animation */}
          <div className="mt-4 h-1 w-full overflow-hidden rounded-full bg-blue-100">
            <div className="h-full w-1/2 animate-[pulse_2s_ease-in-out_infinite] rounded-full bg-blue-400" />
          </div>
        </div>

        {/* Mini summary while waiting */}
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">
              {order.items.length} item{order.items.length !== 1 ? 's' : ''}{' '}
              from {shop.name}
            </span>
            <span className="font-bold tabular-nums text-gray-900">
              ${grandTotal.toFixed(2)}
            </span>
          </div>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------------
  // Timeout / Failed — retry prompt
  // -------------------------------------------------------------------

  if (isTerminal) {
    return (
      <div className="space-y-5">
        <div
          className={`rounded-xl border p-6 text-center ${
            confirmState === 'wrong_amount'
              ? 'border-amber-200 bg-amber-50'
              : payState === 'expired'
                ? 'border-amber-100 bg-amber-50/50'
                : 'border-red-100 bg-red-50'
          }`}
        >
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-white">
            {confirmState === 'wrong_amount' ? (
              <AlertTriangle className="h-9 w-9 text-amber-500" />
            ) : payState === 'expired' ? (
              <Clock className="h-9 w-9 text-gray-500" />
            ) : (
              <XCircle className="h-9 w-9 text-red-400" />
            )}
          </div>

          <h2 className="mt-4 text-lg font-bold text-gray-900">
            {error ? errorTitle(error.code) : 'Payment Issue'}
          </h2>

          <p className="mt-1 max-w-xs mx-auto text-sm text-gray-600">
            {payState === 'expired'
              ? "No payment was detected on-chain. Your wallet may not have sent the transaction, or the network may be congested. Your funds are safe — nothing has been debited."
              : confirmState === 'wrong_amount' && amountMismatch
                ? `Incorrect amount sent: $${amountMismatch.received.toFixed(2)} instead of $${amountMismatch.expected.toFixed(2)}.`
                : error?.userMessage ??
                  'Something went wrong with the payment. No funds were transferred.'}
          </p>

          {/* Wrong amount specific info */}
          {confirmState === 'wrong_amount' && amountMismatch && (
            <div className="mt-3 rounded-lg bg-white border border-amber-200 px-4 py-3 text-left text-xs">
              <p className="font-semibold text-amber-800">Amount Mismatch</p>
              <table className="mt-2 w-full">
                <tbody>
                  <tr>
                    <td className="py-1 text-gray-500">Expected</td>
                    <td className="py-1 text-right font-mono font-medium text-gray-900">
                      ${amountMismatch.expected.toFixed(2)}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-1 text-gray-500">Received</td>
                    <td className="py-1 text-right font-mono font-medium text-amber-700">
                      ${amountMismatch.received.toFixed(2)}
                    </td>
                  </tr>
                  <tr className="border-t border-amber-100">
                    <td className="py-1 text-gray-500">Difference</td>
                    <td className="py-1 text-right font-mono font-bold text-amber-700">
                      $
                      {(
                        amountMismatch.received - amountMismatch.expected
                      ).toFixed(2)}
                    </td>
                  </tr>
                </tbody>
              </table>
              {amountMismatch.signature && (
                <a
                  href={`https://solscan.io/tx/${amountMismatch.signature}?cluster=devnet`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex items-center gap-1 text-amber-600 hover:text-amber-800"
                >
                  View transaction on Solscan{' '}
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          )}

          {/* Retry button (up to 3 attempts) */}
          {retryCount < 2 && payState !== 'cancelled' ? (
            <button
              onClick={retryConfirmation}
              className="mt-5 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 active:bg-blue-800 transition-colors"
            >
              <RefreshCw className="h-4 w-4" />
              Try Again
            </button>
          ) : (
            <p className="mt-4 text-xs text-gray-500">
              Maximum retry attempts reached. Please contact the merchant.
            </p>
          )}

          {/* Still confirming message for timeout */}
          {payState === 'expired' && (
            <p className="mt-3 text-xs text-gray-500">
              Still confirming? This page will keep watching for your payment.
              You can also check back later — your order is safe.
            </p>
          )}
        </div>
      </div>
    );
  }

  return null;
}

// ===========================================================================
// Sub-components
// ===========================================================================

// ---------------------------------------------------------------------------
// SuccessBanner — green checkmark + "Paid $XX.XX to <Shop>"
// ---------------------------------------------------------------------------

function SuccessBanner({
  shopName,
  total,
  tokenSymbol,
  txSignature,
  txBlockTime,
}: {
  shopName: string;
  total: number;
  tokenSymbol: string;
  txSignature: string;
  txBlockTime: number | null;
}) {
  return (
    <div className="rounded-xl border border-green-200 bg-green-50 p-6 text-center">
      {/* Animated green checkmark */}
      <div className="mx-auto flex h-20 w-20 items-center justify-center">
        <div className="animate-[checkBounce_0.5s_ease-out]">
          <CheckCircle2 className="h-16 w-16 text-green-500" />
        </div>
      </div>

      <h2 className="mt-3 text-2xl font-extrabold text-gray-900">
        Payment Complete!
      </h2>

      <p className="mt-2 text-lg text-gray-700">
        Paid{' '}
        <span className="font-bold tabular-nums text-gray-900">
          ${total.toFixed(2)}
        </span>{' '}
        to{' '}
        <span className="font-semibold text-gray-900">{shopName}</span>
      </p>

      <p className="mt-1 text-xs text-gray-500">
        {tokenSymbol} debited from your wallet
        {txBlockTime &&
          ` • ${new Date(txBlockTime * 1000).toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
          })}`}
      </p>

      {/* Inline success animation styles */}
      <style>{`
        @keyframes checkBounce {
          0%   { transform: scale(0); opacity: 0; }
          50%  { transform: scale(1.15); }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

// ---------------------------------------------------------------------------
// PaidBreakdown — friendly split summary
// ---------------------------------------------------------------------------

function PaidBreakdown({
  order,
  split,
  networkFee,
}: {
  order: {
    id: number;
    subtotal: number;
    tip: number;
    tipPercent?: number;
    tax: number;
    charity: number;
    total: number;
    items?: Array<{ name: string; quantity: number; price: number }>;
  };
  split: { merchant: { label: string; amount: number }; tax: { label: string; amount: number }; charity: { label: string; amount: number } };
  networkFee: number;
}) {
  const lines: Array<{
    icon?: React.ComponentType<{ className?: string }>;
    label: string;
    amount: number;
    accent: string;
  }> = [];

  // Subtotal
  lines.push({
    icon: ShoppingBag,
    label: 'Subtotal',
    amount: order.subtotal,
    accent: 'text-gray-600',
  });

  // Tip
  if (order.tip > 0) {
    lines.push({
      icon: HandCoins,
      label: `Tip (${order.tipPercent}%)`,
      amount: order.tip,
      accent: 'text-amber-600',
    });
  }

  // Tax
  if (order.tax > 0) {
    lines.push({
      icon: ShieldCheck,
      label: 'Tax',
      amount: order.tax,
      accent: 'text-green-600',
    });
  }

  // Charity
  if (order.charity > 0) {
    lines.push({
      icon: Heart,
      label: `Donation — ${split.charity.label}`,
      amount: order.charity,
      accent: 'text-rose-600',
    });
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-gray-700">
        <Store className="h-4 w-4" /> Payment Breakdown
      </h3>

      <div className="space-y-2">
        {lines.map((line, i) => (
          <div
            key={i}
            className={`flex items-center justify-between py-0.5 ${line.accent}`}
          >
            <span className="inline-flex items-center gap-1.5 text-sm">
              {line.icon && <line.icon className="h-3.5 w-3.5 opacity-70" />}
              {line.label}
            </span>
            <span className="text-sm font-medium tabular-nums">
              ${line.amount.toFixed(2)}
            </span>
          </div>
        ))}
      </div>

      {/* Divider */}
      <div className="my-3 border-t border-gray-200" />

      {/* Total */}
      <div className="flex items-center justify-between">
        <span className="text-base font-bold text-gray-900">Total</span>
        <span className="text-lg font-bold tabular-nums text-gray-900">
          ${order.total.toFixed(2)}
        </span>
      </div>

      {/* Network fee */}
      <div className="mt-2 flex items-center justify-between rounded-lg bg-gray-50 px-3 py-1.5 text-xs">
        <span className="inline-flex items-center gap-1 text-gray-500">
          <Clock className="h-3 w-3" /> Network fee
        </span>
        <span className="font-medium tabular-nums text-gray-600">
          ~${networkFee.toFixed(3)}
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SplitDetail — collapsible atomic split
// ---------------------------------------------------------------------------

function SplitDetail({
  split,
  show,
  onToggle,
  tokenSymbol,
  taxEnabled,
  charityEnabled,
}: {
  split: {
    merchant: { label: string; address: string; amount: number };
    tax: { label: string; address: string; amount: number };
    charity: { label: string; address: string; amount: number };
  };
  show: boolean;
  onToggle: () => void;
  tokenSymbol: string;
  taxEnabled: boolean;
  charityEnabled: boolean;
}) {
  const legCount =
    1 + (taxEnabled ? 1 : 0) + (charityEnabled ? 1 : 0);

  return (
    <div className="rounded-xl border border-blue-100 bg-blue-50/40 p-4">
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between text-left"
      >
        <div>
          <h3 className="flex items-center gap-1.5 text-sm font-semibold text-blue-800">
            <Zap className="h-4 w-4" /> Atomic Split
          </h3>
          <p className="mt-0.5 text-xs text-blue-600/70">
            {legCount} transfers executed atomically on Solana
          </p>
        </div>
        {show ? (
          <ChevronUp className="h-4 w-4 text-blue-500" />
        ) : (
          <ChevronDown className="h-4 w-4 text-blue-500" />
        )}
      </button>

      {show && (
        <div className="mt-3 space-y-2 border-t border-blue-100 pt-3 text-xs">
          <SplitRow
            icon={Store}
            label={split.merchant.label}
            amount={split.merchant.amount}
            address={split.merchant.address}
            tokenSymbol={tokenSymbol}
            accent="text-blue-700"
          />
          {taxEnabled && split.tax.amount > 0 && (
            <SplitRow
              icon={ShieldCheck}
              label={split.tax.label}
              amount={split.tax.amount}
              address={split.tax.address}
              tokenSymbol={tokenSymbol}
              accent="text-green-700"
            />
          )}
          {charityEnabled && split.charity.amount > 0 && (
            <SplitRow
              icon={Heart}
              label={split.charity.label}
              amount={split.charity.amount}
              address={split.charity.address}
              tokenSymbol={tokenSymbol}
              accent="text-rose-700"
            />
          )}
          <p className="text-[10px] text-blue-500/70">
            All transfers succeed or fail together — no partial payments.
          </p>
        </div>
      )}
    </div>
  );
}

function SplitRow({
  icon: Icon,
  label,
  amount,
  address,
  tokenSymbol,
  accent,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  amount: number;
  address: string;
  tokenSymbol: string;
  accent: string;
}) {
  const shortAddr = `${address.slice(0, 4)}…${address.slice(-4)}`;
  return (
    <div className={`flex items-center gap-2 ${accent}`}>
      <Icon className="h-3.5 w-3.5 shrink-0 opacity-70" />
      <div className="min-w-0 flex-1">
        <span className="font-medium">{label}</span>
        <code className="ml-1.5 text-[10px] opacity-60">{shortAddr}</code>
      </div>
      <span className="shrink-0 font-medium tabular-nums">
        {tokenSymbol} {amount.toFixed(2)}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ExplorerLink — chain-aware (Solscan for Solana, Tari explorer for Tari)
// ---------------------------------------------------------------------------

function ExplorerLink({ signature, chain }: { signature: string; chain: 'solana' | 'tari' }) {
  const shortSig = `${signature.slice(0, 6)}…${signature.slice(-4)}`;
  const url =
    chain === 'tari'
      ? `https://tariswap.io/transaction/${signature}`
      : `https://solscan.io/tx/${signature}?cluster=devnet`;
  const label = chain === 'tari' ? 'View on Tari Explorer' : 'View on Solscan';

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={
        chain === 'tari'
          ? 'flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm transition-colors hover:border-emerald-300 hover:bg-emerald-100'
          : 'flex items-center justify-between rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm transition-colors hover:border-blue-300 hover:bg-blue-100'
      }
    >
      <div className="min-w-0 flex-1">
        <p
          className={
            chain === 'tari'
              ? 'flex items-center gap-1.5 text-xs font-semibold text-emerald-700'
              : 'flex items-center gap-1.5 text-xs font-semibold text-blue-700'
          }
        >
          <ExternalLink className="h-3.5 w-3.5" /> {label}
        </p>
        <p
          className={
            chain === 'tari'
              ? 'mt-0.5 text-[11px] font-mono text-emerald-500'
              : 'mt-0.5 text-[11px] font-mono text-blue-500'
          }
        >
          {shortSig}
        </p>
      </div>
      <ArrowRight
        className={
          chain === 'tari'
            ? 'h-4 w-4 shrink-0 text-emerald-400'
            : 'h-4 w-4 shrink-0 text-blue-400'
        }
      />
    </a>
  );
}

// ---------------------------------------------------------------------------
// DownloadReceiptButton
// ---------------------------------------------------------------------------

function DownloadReceiptButton({
  order,
  shop,
  chain,
}: {
  order: {
    id: number;
    subtotal: number;
    tip: number;
    tipPercent?: number;
    tax: number;
    charity: number;
    total: number;
    txSignature?: string;
    confirmedAt?: Date;
    updatedAt?: Date;
    items: Array<{ name: string; quantity: number; price: number }>;
  };
  shop: { name: string };
  chain: 'solana' | 'tari';
}) {
  const [downloading, setDownloading] = useState(false);

  const handleDownload = useCallback(() => {
    setDownloading(true);
    try {
      const chainLabel = chain === 'tari' ? 'Tari' : 'Solana';
      const txLink = order.txSignature
        ? chain === 'tari'
          ? `https://tariswap.io/transaction/${order.txSignature}`
          : `https://solscan.io/tx/${order.txSignature}?cluster=devnet`
        : null;

      const lines = [
        `Receipt — ${shop.name} — Order #${order.id}`,
        `Date: ${new Date(order.confirmedAt ?? order.updatedAt ?? Date.now()).toLocaleString()}`,
        `Status: Paid (${chainLabel})`,
        '',
        '--- Items ---',
        ...order.items.map(
          (oi) =>
            `${oi.name} ×${oi.quantity} — $${(oi.price * oi.quantity).toFixed(2)}`,
        ),
        '',
        `Subtotal: $${order.subtotal.toFixed(2)}`,
        order.tip > 0
          ? `Tip (${order.tipPercent}%): $${order.tip.toFixed(2)}`
          : null,
        order.tax > 0 ? `Tax: $${order.tax.toFixed(2)}` : null,
        order.charity > 0 ? `Donation: $${order.charity.toFixed(2)}` : null,
        '',
        `Total: $${order.total.toFixed(2)}`,
        txLink ? `Transaction: ${txLink}` : null,
        '',
        `Powered by Microstore`,
      ]
        .filter(Boolean)
        .join('\n');

      const blob = new Blob([lines], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `receipt-${shop.name.replace(/[^a-zA-Z0-9]/g, '_')}-order-${order.id}.txt`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // Fail silently — receipt download is best-effort
    } finally {
      setTimeout(() => setDownloading(false), 500);
    }
  }, [order, shop, chain]);

  return (
    <button
      onClick={handleDownload}
      disabled={downloading}
      className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-300 bg-white px-4 py-3 text-sm font-medium text-gray-700 transition-colors hover:border-gray-400 hover:bg-gray-50 disabled:opacity-50"
    >
      {downloading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Download className="h-4 w-4" />
      )}
      {downloading ? 'Generating…' : 'Download Receipt'}
    </button>
  );
}
