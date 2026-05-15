'use client';

import { use } from 'react';
import Link from 'next/link';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Truck,
  XCircle,
  Copy,
  ExternalLink,
  HandCoins,
  Heart,
  ShieldCheck,
  ShoppingCart,
  TriangleAlert,
  AlertCircle,
} from 'lucide-react';
import { db } from '@/lib/db';
import { useAppStore } from '@/lib/store';

const STATUS_CONFIG: Record<string, { label: string; icon: typeof Clock; className: string }> = {
  pending: { label: 'Pending', icon: Clock, className: 'bg-yellow-50 text-yellow-700' },
  paid: { label: 'Paid', icon: CheckCircle2, className: 'bg-green-50 text-green-700' },
  shipped: { label: 'Shipped', icon: Truck, className: 'bg-blue-50 text-blue-700' },
  cancelled: { label: 'Cancelled', icon: XCircle, className: 'bg-red-50 text-red-700' },
  pending_review: { label: 'Needs Review', icon: AlertCircle, className: 'bg-amber-50 text-amber-700' },
};

function truncateTx(sig: string): string {
  if (sig.length <= 12) return sig;
  return `${sig.slice(0, 6)}...${sig.slice(-4)}`;
}

export default function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { activeShopId } = useAppStore();
  const orderId = parseInt(id, 10);

  const order = useLiveQuery(
    () =>
      activeShopId
        ? db.orders.where({ shopId: activeShopId, id: orderId }).first()
        : undefined,
    [activeShopId, orderId],
  );

  const shop = useLiveQuery(
    () => (activeShopId ? db.shops.get(activeShopId) : undefined),
    [activeShopId],
  );

  if (!order) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-500">
        <Clock className="mb-3 h-10 w-10" />
        <p className="text-sm font-medium">Order not found</p>
        <Link href="/orders" className="mt-4 text-sm text-blue-600 hover:text-blue-700">
          ← Back to orders
        </Link>
      </div>
    );
  }

  const statusCfg = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending;
  const StatusIcon = statusCfg.icon;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Link
          href="/orders"
          className="rounded-full p-2 -ml-2 text-gray-500 hover:bg-gray-100 transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Order #{order.id}</h1>
          <p className="text-sm text-gray-500">
            {new Date(order.createdAt).toLocaleString('en-US', {
              year: 'numeric', month: 'short', day: 'numeric',
              hour: '2-digit', minute: '2-digit',
            })}
          </p>
        </div>
      </div>

      {/* Status badge */}
      <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 ${statusCfg.className}`}>
        <StatusIcon className="h-4 w-4" />
        <span className="text-sm font-medium">{statusCfg.label}</span>
      </div>

      {/* Duplicate payment warning */}
      {order.duplicateTxIds && order.duplicateTxIds.length > 0 && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3">
          <div className="flex items-start gap-2">
            <TriangleAlert className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-amber-800">
                Duplicate payment{order.duplicateTxIds.length > 1 ? 's' : ''} detected
              </p>
              <p className="text-xs text-amber-700 mt-0.5">
                {order.duplicateTxIds.length} duplicate transaction{order.duplicateTxIds.length > 1 ? 's' : ''} received after this order was already paid.
              </p>
              <div className="mt-2 space-y-1">
                {order.duplicateTxIds.map((dupSig) => (
                  <div key={dupSig} className="flex items-center gap-1.5">
                    <code className="flex-1 text-[10px] text-amber-700 font-mono truncate">
                      {dupSig}
                    </code>
                    <button
                      onClick={() => navigator.clipboard.writeText(dupSig)}
                      className="shrink-0 rounded p-0.5 text-amber-500 hover:text-amber-700 hover:bg-amber-100 transition-colors"
                    >
                      <Copy className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Customer info */}
      {order.customerName && (
        <div className="rounded-lg border border-gray-200 bg-white p-3">
          <div className="text-[11px] text-gray-500 uppercase tracking-wide mb-1">Customer</div>
          <p className="text-sm font-semibold text-gray-900">{order.customerName}</p>
          {order.customerPhone && <p className="text-sm text-gray-500">{order.customerPhone}</p>}
        </div>
      )}

      {/* Items */}
      <div className="rounded-lg border border-gray-200 bg-white p-3">
        <div className="text-[11px] text-gray-500 uppercase tracking-wide mb-2">Items</div>
        <div className="space-y-2">
          {order.items.map((item, idx) => (
            <div key={idx} className="flex justify-between text-sm">
              <span className="text-gray-700">
                {item.name}
                <span className="text-gray-500 ml-1">×{item.quantity}</span>
              </span>
              <span className="font-medium text-gray-900">
                ${(item.price * item.quantity).toFixed(2)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Totals */}
      <div className="rounded-lg border border-gray-200 bg-white p-3 space-y-2">
        <div className="text-[11px] text-gray-500 uppercase tracking-wide mb-1">Breakdown</div>
        <div className="flex justify-between text-sm text-gray-600">
          <span>Subtotal</span>
          <span>${order.subtotal.toFixed(2)}</span>
        </div>
        {order.tip > 0 && (
          <div className="flex justify-between text-sm text-gray-600">
            <span className="inline-flex items-center gap-1">
              <HandCoins className="h-3.5 w-3.5 text-amber-500" />
              Tip ({order.tipPercent}%)
            </span>
            <span>${order.tip.toFixed(2)}</span>
          </div>
        )}
        {order.tax > 0 && (
          <div className="flex justify-between text-sm text-gray-600">
            <span className="inline-flex items-center gap-1">
              <ShieldCheck className="h-3.5 w-3.5 text-green-500" />
              Tax
            </span>
            <span>${order.tax.toFixed(2)}</span>
          </div>
        )}
        {order.charity > 0 && (
          <div className="flex justify-between text-sm text-gray-600">
            <span className="inline-flex items-center gap-1">
              <Heart className="h-3.5 w-3.5 text-rose-400" />
              Charity round-up
            </span>
            <span>${order.charity.toFixed(2)}</span>
          </div>
        )}
        <div className="flex justify-between text-sm font-bold text-gray-900 pt-2 border-t border-gray-100">
          <span>Total</span>
          <span>${order.total.toFixed(2)}</span>
        </div>
      </div>

      {/* Transaction */}
      {order.txSignature && (
        <div className="rounded-lg border border-gray-200 bg-white p-3">
          <div className="text-[11px] text-gray-500 uppercase tracking-wide mb-1">Transaction</div>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs text-gray-700 font-mono break-all">
              {order.txSignature}
            </code>
            <button
              onClick={() => navigator.clipboard.writeText(order.txSignature!)}
              className="shrink-0 rounded p-1.5 text-gray-500 hover:text-blue-500 hover:bg-blue-50 transition-colors"
            >
              <Copy className="h-3.5 w-3.5" />
            </button>
            <a
              href={`https://explorer.solana.com/tx/${order.txSignature}?cluster=devnet`}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 rounded p-1.5 text-gray-500 hover:text-blue-500 hover:bg-blue-50 transition-colors"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
          {order.paymentRef && (
            <p className="mt-1 text-[11px] text-gray-500">Ref: {order.paymentRef}</p>
          )}
        </div>
      )}
    </div>
  );
}
