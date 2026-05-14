'use client';

import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  ExternalLink,
  HandCoins,
  Heart,
  Loader2,
  Package,
  Printer,
  Share2,
  ShieldCheck,
  ShoppingCart,
  Store,
  XCircle,
} from 'lucide-react';
import { db, type Order, type Shop } from '@/lib/db';

// ---------------------------------------------------------------------------
// Receipt Page
// ---------------------------------------------------------------------------

export default function ReceiptPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const orderId = parseInt(id, 10);

  const [order, setOrder] = useState<Order | null>(null);
  const [shop, setShop] = useState<Shop | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        if (isNaN(orderId) || orderId <= 0) {
          setError('Invalid order ID.');
          setLoading(false);
          return;
        }

        const o = await db.orders.get(orderId);
        if (!o) {
          if (!cancelled) setError(`Order #${orderId} not found.`);
          if (!cancelled) setLoading(false);
          return;
        }

        const s = await db.shops.get(o.shopId);
        if (!cancelled) setOrder(o);
        if (!cancelled) setShop(s ?? null);
      } catch (err) {
        console.error('Receipt load error:', err);
        if (!cancelled) setError('Failed to load receipt.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [orderId]);

  // -----------------------------------------------------------------------
  // Loading
  // -----------------------------------------------------------------------

  if (loading) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center text-gray-400">
        <Loader2 className="mb-4 h-10 w-10 animate-spin text-blue-500" />
        <p className="text-sm font-medium text-gray-500">Loading receipt…</p>
      </div>
    );
  }

  // -----------------------------------------------------------------------
  // Error
  // -----------------------------------------------------------------------

  if (error || !order) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-50">
          <XCircle className="h-7 w-7 text-red-400" />
        </div>
        <h2 className="mt-4 text-lg font-bold text-gray-900">Receipt Not Found</h2>
        <p className="mt-1 text-sm text-gray-500">{error ?? 'Order not found.'}</p>
        <Link
          href="/orders"
          className="mt-4 inline-flex items-center gap-1 rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          View Orders
        </Link>
      </div>
    );
  }

  // -----------------------------------------------------------------------
  // Computed values
  // -----------------------------------------------------------------------

  const isPaid = order.status === 'paid';
  const isPending = order.status === 'pending';
  const isCancelled = order.status === 'cancelled';
  const networkFee = 0.001; // estimated (matching pay page)
  const grandTotal = order.total + networkFee;
  const tokenSymbol = order.splTokenSymbol ?? shop?.splTokenSymbol ?? 'SPL';
  const itemCount = order.items.reduce((sum, oi) => sum + oi.quantity, 0);

  // Determine if we have per-split transaction signatures
  const hasSplitSigs = !!(
    order.merchantTxSignature ||
    order.taxTxSignature ||
    order.charityTxSignature
  );

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <div className="mx-auto max-w-md space-y-5 pb-8">
      {/* Back navigation */}
      <Link
        href="/orders"
        className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Orders
      </Link>

      {/* Receipt header */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 text-center">
        {/* Status icon */}
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gray-50">
          {isPaid ? (
            <CheckCircle2 className="h-9 w-9 text-green-500" />
          ) : isCancelled ? (
            <XCircle className="h-9 w-9 text-red-400" />
          ) : (
            <Clock className="h-9 w-9 text-amber-400" />
          )}
        </div>

        <h1 className="mt-3 text-xl font-bold text-gray-900">
          {isPaid ? 'Payment Receipt' : isCancelled ? 'Cancelled' : 'Pending Payment'}
        </h1>

        <div className="mt-2 space-y-1 text-sm text-gray-500">
          <p>
            <span className="font-medium text-gray-700">{shop?.name ?? `Shop #${order.shopId}`}</span>
          </p>
          <p>
            Order #{order.id}
            {' • '}
            {new Date(order.createdAt).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </p>
          <p>
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                isPaid
                  ? 'bg-green-50 text-green-700'
                  : isCancelled
                  ? 'bg-red-50 text-red-700'
                  : 'bg-amber-50 text-amber-700'
              }`}
            >
              {isPaid ? 'Paid' : isCancelled ? 'Cancelled' : 'Pending'}
            </span>
          </p>
        </div>
      </div>

      {/* Itemized cart */}
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-gray-700">
          <ShoppingCart className="h-4 w-4" /> Itemized Cart
        </h2>

        <div className="space-y-2.5">
          {order.items.map((oi, i) => (
            <div key={i} className="flex items-center justify-between text-sm">
              <div className="min-w-0 flex-1">
                <span className="text-gray-900">{oi.name}</span>
                {oi.quantity > 1 && (
                  <span className="ml-1.5 text-xs text-gray-400">×{oi.quantity}</span>
                )}
              </div>
              <span className="ml-3 shrink-0 font-medium tabular-nums text-gray-900">
                ${(oi.price * oi.quantity).toFixed(2)}
              </span>
            </div>
          ))}
        </div>

        <div className="mt-3 border-t border-gray-100 pt-2 text-xs text-gray-400">
          {itemCount} item{itemCount !== 1 ? 's' : ''} total
        </div>
      </div>

      {/* Payment breakdown */}
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-gray-700">
          <Store className="h-4 w-4" /> Payment Breakdown
        </h2>

        <div className="space-y-2">
          {/* Subtotal */}
          <div className="flex items-center justify-between text-sm text-gray-600">
            <span className="inline-flex items-center gap-1.5">
              <Package className="h-3.5 w-3.5 opacity-50" />
              Subtotal
            </span>
            <span className="font-medium tabular-nums">${order.subtotal.toFixed(2)}</span>
          </div>

          {/* Tip */}
          {order.tip > 0 && (
            <div className="flex items-center justify-between text-sm text-amber-600">
              <span className="inline-flex items-center gap-1.5">
                <HandCoins className="h-3.5 w-3.5" />
                Tip ({order.tipPercent}%)
              </span>
              <span className="font-medium tabular-nums">${order.tip.toFixed(2)}</span>
            </div>
          )}

          {/* Tax */}
          {order.tax > 0 && (
            <div className="flex items-center justify-between text-sm text-green-600">
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5" />
                Tax
              </span>
              <span className="font-medium tabular-nums">${order.tax.toFixed(2)}</span>
            </div>
          )}

          {/* Charity / Donation */}
          {order.charity > 0 && (
            <div className="flex items-center justify-between text-sm text-rose-600">
              <span className="inline-flex items-center gap-1.5">
                <Heart className="h-3.5 w-3.5" />
                Donation
              </span>
              <span className="font-medium tabular-nums">${order.charity.toFixed(2)}</span>
            </div>
          )}
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
            <Clock className="h-3 w-3" />
            Network fee
          </span>
          <span className="font-medium tabular-nums text-gray-600">
            ~${networkFee.toFixed(3)}
          </span>
        </div>

        {/* Grand total */}
        <div className="mt-1.5 flex items-center justify-between rounded-lg bg-gray-900 px-3 py-2 text-xs">
          <span className="text-gray-400">{tokenSymbol} debited</span>
          <span className="font-bold tabular-nums text-white">
            {tokenSymbol} {grandTotal.toFixed(2)}
          </span>
        </div>
      </div>

      {/* On-chain verification */}
      {isPaid && (
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-gray-700">
            <ExternalLink className="h-4 w-4" /> On-Chain Verification
          </h2>

          {/* Per-split transaction links */}
          {hasSplitSigs ? (
            <div className="space-y-2">
              {order.merchantTxSignature && (
                <TxLink
                  label="Merchant + Tip transfer"
                  signature={order.merchantTxSignature}
                  amount={order.subtotal + order.tip}
                />
              )}
              {order.taxTxSignature && order.tax > 0 && (
                <TxLink
                  label="Tax transfer"
                  signature={order.taxTxSignature}
                  amount={order.tax}
                />
              )}
              {order.charityTxSignature && order.charity > 0 && (
                <TxLink
                  label="Charity donation transfer"
                  signature={order.charityTxSignature}
                  amount={order.charity}
                />
              )}
            </div>
          ) : order.txSignature ? (
            <TxLink
              label="Transaction"
              signature={order.txSignature}
              amount={order.total}
            />
          ) : (
            <p className="text-xs text-gray-400">
              On-chain verification links will appear once the transaction confirms.
            </p>
          )}

          <p className="mt-3 text-[10px] text-gray-400">
            Links open on Solscan (devnet). All transfers execute atomically —
            verified on the Solana blockchain.
          </p>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-2">
        <button
          onClick={() => window.print()}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-gray-300 bg-white py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <Printer className="h-4 w-4" />
          Print
        </button>
        <button
          onClick={() => {
            const text = [
              `Receipt — ${shop?.name} — Order #${order.id}`,
              `Date: ${new Date(order.createdAt).toLocaleString()}`,
              `Status: ${order.status}`,
              ...order.items.map((oi) => `${oi.name} ×${oi.quantity} — $${(oi.price * oi.quantity).toFixed(2)}`),
              `Subtotal: $${order.subtotal.toFixed(2)}`,
              order.tip > 0 ? `Tip: $${order.tip.toFixed(2)}` : null,
              order.tax > 0 ? `Tax: $${order.tax.toFixed(2)}` : null,
              order.charity > 0 ? `Donation: $${order.charity.toFixed(2)}` : null,
              `Total: $${order.total.toFixed(2)}`,
            ]
              .filter(Boolean)
              .join('\n');
            navigator.clipboard.writeText(text).catch(() => {});
          }}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
        >
          <Share2 className="h-4 w-4" />
          Copy
        </button>
      </div>

      {/* Powered by */}
      <div className="text-center">
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors"
        >
          <Store className="h-3 w-3" />
          Powered by Microstore
        </Link>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helper: transaction link row
// ---------------------------------------------------------------------------

function TxLink({
  label,
  signature,
  amount,
}: {
  label: string;
  signature: string;
  amount: number;
}) {
  const cluster = 'devnet'; // MVP uses devnet
  const solscanURL = `https://solscan.io/tx/${signature}?cluster=${cluster}`;
  const shortSig = `${signature.slice(0, 6)}…${signature.slice(-4)}`;

  return (
    <a
      href={solscanURL}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-sm hover:bg-blue-50 hover:border-blue-200 transition-colors"
    >
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-gray-700">{label}</p>
        <p className="text-[10px] text-gray-400 font-mono">{shortSig}</p>
      </div>
      <div className="ml-2 flex shrink-0 items-center gap-2">
        <span className="text-xs font-medium tabular-nums text-gray-600">
          ${amount.toFixed(2)}
        </span>
        <ExternalLink className="h-3.5 w-3.5 text-gray-400" />
      </div>
    </a>
  );
}
