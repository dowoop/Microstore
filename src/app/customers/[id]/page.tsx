'use client';

import { useState, useMemo, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Phone,
  Calendar,
  DollarSign,
  ShoppingCart,
  Clock,
  Edit3,
  Save,
  X,
  ChevronRight,
} from 'lucide-react';
import { db, type Customer, type Order } from '@/lib/db';
import { useAppStore } from '@/lib/store';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatDateTime(date: Date): string {
  return new Date(date).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ---------------------------------------------------------------------------
// Customer Detail Page
// ---------------------------------------------------------------------------

export default function CustomerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { activeShopId } = useAppStore();
  const customerId = Number(params.id);

  const [editingNotes, setEditingNotes] = useState(false);
  const [notesDraft, setNotesDraft] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);

  // Load customer
  const customer = useLiveQuery(
    () => db.customers.get(customerId),
    [customerId],
  );

  // Load orders for this shop
  const orders = useLiveQuery(
    () =>
      activeShopId
        ? db.orders.where('shopId').equals(activeShopId).toArray()
        : [],
    [activeShopId],
  );

  // Filter orders for this customer (by customerId or name+phone fallback)
  const customerOrders = useMemo(() => {
    if (!orders || !customer) return [];
    return orders
      .filter(
        (o) =>
          (o.customerId && o.customerId === customer.id) ||
          (!o.customerId &&
            o.customerName?.toLowerCase() === customer.name.toLowerCase() &&
            (o.customerPhone === customer.phone ||
              (!o.customerPhone && !customer.phone))),
      )
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
  }, [orders, customer]);

  // Computed stats
  const stats = useMemo(() => {
    const completedOrders = customerOrders.filter(
      (o) => o.status !== 'cancelled',
    );
    const totalSpent = completedOrders.reduce((sum, o) => sum + o.total, 0);
    const firstVisit =
      customerOrders.length > 0
        ? new Date(
            Math.min(
              ...customerOrders.map((o) => new Date(o.createdAt).getTime()),
            ),
          )
        : null;
    const lastVisit =
      customerOrders.length > 0
        ? new Date(
            Math.max(
              ...customerOrders.map((o) => new Date(o.createdAt).getTime()),
            ),
          )
        : null;
    const avgOrderValue =
      completedOrders.length > 0 ? totalSpent / completedOrders.length : 0;

    const liveOrders = customerOrders.filter((o) => o.status !== 'cancelled');
    const pendingCount = liveOrders.filter(
      (o) => o.status === 'pending' || o.status === 'confirming',
    ).length;
    const completedCount = liveOrders.filter(
      (o) => o.status === 'paid' || o.status === 'shipped',
    ).length;

    return {
      totalSpent,
      orderCount: customerOrders.length,
      avgOrderValue,
      firstVisit,
      lastVisit,
      pendingCount,
      completedCount,
    };
  }, [customerOrders]);

  // Save notes
  const handleSaveNotes = useCallback(async () => {
    if (!customer) return;
    setSavingNotes(true);
    try {
      await db.customers.update(customer.id, { notes: notesDraft });
      setEditingNotes(false);
    } catch (err) {
      console.error('Failed to save notes:', err);
    } finally {
      setSavingNotes(false);
    }
  }, [customer, notesDraft]);

  const startEditing = () => {
    setNotesDraft(customer?.notes ?? '');
    setEditingNotes(true);
  };

  const cancelEditing = () => {
    setEditingNotes(false);
    setNotesDraft('');
  };

  // -----------------------------------------------------------------------
  // Not found / loading
  // -----------------------------------------------------------------------

  if (!customer) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-500">
        <p className="text-sm font-medium">Customer not found</p>
        <Link
          href="/customers"
          className="mt-2 text-sm text-blue-600 hover:underline"
        >
          Back to customers
        </Link>
      </div>
    );
  }

  // -----------------------------------------------------------------------
  // Main render
  // -----------------------------------------------------------------------

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="rounded-full p-2 -ml-2 text-gray-500 hover:bg-gray-100 transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-900">
            {customer.name}
          </h1>
          <p className="text-sm text-gray-500">Customer profile</p>
        </div>
      </div>

      {/* Profile card */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        {/* Avatar + name */}
        <div className="bg-blue-50 px-4 py-5 flex items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-blue-600 text-lg font-bold text-white">
            {customer.name
              .split(' ')
              .map((n) => n[0])
              .join('')
              .toUpperCase()
              .slice(0, 2)}
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">
              {customer.name}
            </h2>
            {customer.phone && (
              <p className="text-sm text-gray-600 flex items-center gap-1 mt-0.5">
                <Phone className="h-3.5 w-3.5" />
                {customer.phone}
              </p>
            )}
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-px bg-gray-100">
          <StatCell
            label="Total spent"
            value={`$${stats.totalSpent.toFixed(2)}`}
            icon={DollarSign}
          />
          <StatCell
            label="Orders"
            value={String(stats.orderCount)}
            icon={ShoppingCart}
          />
          <StatCell
            label="Avg. order"
            value={`$${stats.avgOrderValue.toFixed(2)}`}
            icon={DollarSign}
          />
          <StatCell
            label="Last visit"
            value={stats.lastVisit ? formatDate(stats.lastVisit) : '—'}
            icon={Calendar}
          />
        </div>

        {/* Notes */}
        <div className="px-4 py-3 border-t border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Notes
            </h3>
            {!editingNotes && (
              <button
                onClick={startEditing}
                className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
              >
                <Edit3 className="h-3 w-3" />
                {customer.notes ? 'Edit' : 'Add'}
              </button>
            )}
          </div>

          {editingNotes ? (
            <div className="space-y-2">
              <textarea
                value={notesDraft}
                onChange={(e) => setNotesDraft(e.target.value)}
                placeholder="Add notes about this customer… (e.g., preferences, allergies, regular orders)"
                rows={3}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none resize-none"
                autoFocus
              />
              <div className="flex items-center gap-2">
                <button
                  onClick={handleSaveNotes}
                  disabled={savingNotes}
                  className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  <Save className="h-3.5 w-3.5" />
                  {savingNotes ? 'Saving…' : 'Save'}
                </button>
                <button
                  onClick={cancelEditing}
                  className="inline-flex items-center gap-1 rounded-md bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-200 transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                  Cancel
                </button>
              </div>
            </div>
          ) : customer.notes ? (
            <p className="text-sm text-gray-700 whitespace-pre-wrap">
              {customer.notes}
            </p>
          ) : (
            <p className="text-sm text-gray-400 italic">No notes yet.</p>
          )}
        </div>
      </div>

      {/* Order history */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-2">
          Order history ({customerOrders.length})
        </h3>

        {customerOrders.length === 0 ? (
          <div className="rounded-lg border border-gray-200 bg-white px-4 py-8 text-center">
            <Clock className="mx-auto mb-2 h-8 w-8 text-gray-300" />
            <p className="text-sm text-gray-500">No orders yet</p>
            <p className="mt-1 text-xs text-gray-400">
              Orders attributed to this customer will appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {customerOrders.map((order) => {
              const statusColors: Record<string, string> = {
                pending: 'bg-yellow-50 text-yellow-700 border-yellow-200',
                paid: 'bg-green-50 text-green-700 border-green-200',
                shipped: 'bg-blue-50 text-blue-700 border-blue-200',
                cancelled: 'bg-red-50 text-red-700 border-red-200',
                confirming: 'bg-purple-50 text-purple-700 border-purple-200',
                failed: 'bg-red-50 text-red-700 border-red-200',
                pending_review:
                  'bg-orange-50 text-orange-700 border-orange-200',
              };

              return (
                <Link
                  key={order.id}
                  href={`/orders/${order.id}`}
                  className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-3 py-3 shadow-sm hover:border-blue-300 hover:shadow-md transition-all"
                >
                  {/* Order number */}
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-bold text-gray-700">
                    #{order.id}
                  </div>

                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-900">
                        {formatDateTime(order.createdAt)}
                      </span>
                      <span
                        className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${
                          statusColors[order.status] ??
                          'bg-gray-50 text-gray-600 border-gray-200'
                        }`}
                      >
                        {order.status}
                      </span>
                    </div>
                    <div className="mt-0.5 flex items-center gap-2 text-xs text-gray-500">
                      <span>
                        {order.items.length} item
                        {order.items.length !== 1 ? 's' : ''}
                      </span>
                      <span>·</span>
                      <span>
                        {order.items
                          .map((i) => `${i.name} ×${i.quantity}`)
                          .join(', ')}
                      </span>
                    </div>
                  </div>

                  {/* Total */}
                  <div className="shrink-0 text-right">
                    <span className="text-sm font-bold text-gray-900">
                      ${order.total.toFixed(2)}
                    </span>
                  </div>

                  <ChevronRight className="h-4 w-4 text-gray-400" />
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helper: Stat cell
// ---------------------------------------------------------------------------

function StatCell({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: typeof DollarSign;
}) {
  return (
    <div className="bg-white px-4 py-3">
      <p className="text-[11px] text-gray-500 flex items-center gap-1">
        <Icon className="h-3 w-3" />
        {label}
      </p>
      <p className="mt-0.5 text-sm font-semibold text-gray-900">{value}</p>
    </div>
  );
}
