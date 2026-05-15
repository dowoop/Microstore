'use client';

import { useState, useCallback, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowLeft, Plus, Minus, Save } from 'lucide-react';
import { db, type Item, type OrderItem, type Customer } from '@/lib/db';
import { useAppStore } from '@/lib/store';
import { CustomerSuggest, type CustomerSelection } from '@/components/customer-suggest';

export default function NewOrderPage() {
  const router = useRouter();
  const { activeShopId } = useAppStore();
  const [selectedItems, setSelectedItems] = useState<Map<number, number>>(new Map());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [customer, setCustomer] = useState<CustomerSelection | null>(null);

  // Upsert customer (find-or-create)
  const upsertCustomer = useCallback(
    async (sel: CustomerSelection): Promise<number> => {
      if (!activeShopId) return 0;
      if (sel.customerId) return sel.customerId;
      const existing = await db.customers
        .where('shopId')
        .equals(activeShopId)
        .filter(
          (c) =>
            c.name.toLowerCase() === sel.customerName.toLowerCase() &&
            (c.phone === sel.customerPhone ||
              (!c.phone && !sel.customerPhone)),
        )
        .first();
      if (existing) return existing.id;
      const id = await db.customers.add({
        shopId: activeShopId,
        name: sel.customerName,
        phone: sel.customerPhone || undefined,
        createdAt: new Date(),
      });
      return id as number;
    },
    [activeShopId],
  );

  const items = useLiveQuery(
    () =>
      activeShopId
        ? db.items.where('shopId').equals(activeShopId).filter((i) => i.status === 'live').toArray()
        : [],
    [activeShopId],
  );

  const shop = useLiveQuery(
    () => (activeShopId ? db.shops.get(activeShopId) : undefined),
    [activeShopId],
  );

  const addItem = (itemId: number) => {
    setSelectedItems((prev) => {
      const next = new Map(prev);
      next.set(itemId, (next.get(itemId) || 0) + 1);
      return next;
    });
  };

  const removeItem = (itemId: number) => {
    setSelectedItems((prev) => {
      const next = new Map(prev);
      const qty = next.get(itemId) || 1;
      if (qty <= 1) next.delete(itemId);
      else next.set(itemId, qty - 1);
      return next;
    });
  };

  const subtotal = Array.from(selectedItems.entries()).reduce((sum, [itemId, qty]) => {
    const item = items?.find((i) => i.id === itemId);
    return sum + (item?.price || 0) * qty;
  }, 0);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!activeShopId) { setError('No shop selected.'); return; }
    if (selectedItems.size === 0) { setError('Add at least one item.'); return; }

    setSaving(true);
    try {
      const orderItems: OrderItem[] = Array.from(selectedItems.entries()).map(([itemId, qty]) => {
        const item = items!.find((i) => i.id === itemId)!;
        return { itemId, name: item.name, price: item.price, quantity: qty };
      });

      const now = new Date();

      // Upsert customer if selected
      let custId: number | undefined;
      if (customer) {
        custId = await upsertCustomer(customer);
      }

      await db.orders.add({
        shopId: activeShopId,
        customerId: custId,
        customerName: customer?.customerName || undefined,
        customerPhone: customer?.customerPhone || undefined,
        status: 'pending',
        subtotal,
        tip: 0,
        tipPercent: 0,
        tax: 0,
        charity: 0,
        total: subtotal,
        items: orderItems,
        merchantWallet: shop?.merchantWallet,
        taxWallet: shop?.taxWallet,
        charityWallet: shop?.charityWallet,
        splTokenMint: shop?.splTokenMint,
        splTokenSymbol: shop?.splTokenSymbol,
        paymentRef: `manual:${shop?.id}:${Date.now()}`,
        createdAt: now,
        updatedAt: now,
      });
      router.push('/orders');
    } catch (err) {
      setError('Failed to create order.');
      console.error('Create order error:', err);
    } finally {
      setSaving(false);
    }
  };

  if (!activeShopId) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-500">
        <p className="text-sm font-medium">No shop selected</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => router.back()} className="rounded-full p-2 -ml-2 text-gray-500 hover:bg-gray-100 transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">New Order</h1>
          <p className="text-sm text-gray-500">Create a manual order</p>
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Customer</label>
          <CustomerSuggest
            shopId={activeShopId!}
            selected={customer}
            onSelect={setCustomer}
            onClear={() => setCustomer(null)}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Items</label>
          {!items ? (
            <p className="text-sm text-gray-500">Loading items…</p>
          ) : items.length === 0 ? (
            <p className="text-sm text-gray-500">No live items. Add items to inventory first.</p>
          ) : (
            <div className="space-y-1">
              {items.map((item) => {
                const qty = selectedItems.get(item.id) || 0;
                return (
                  <div key={item.id} className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white p-2">
                    <span className="flex-1 text-sm text-gray-900">{item.name}</span>
                    <span className="text-xs text-gray-500">${item.price.toFixed(2)}</span>
                    {qty > 0 ? (
                      <div className="flex items-center gap-1">
                        <button type="button" onClick={() => removeItem(item.id)} className="h-7 w-7 rounded bg-gray-100 flex items-center justify-center hover:bg-gray-200">
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="w-5 text-center text-sm font-medium">{qty}</span>
                        <button type="button" onClick={() => addItem(item.id)} className="h-7 w-7 rounded bg-gray-100 flex items-center justify-center hover:bg-gray-200">
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>
                    ) : (
                      <button type="button" onClick={() => addItem(item.id)} className="h-7 w-7 rounded bg-blue-50 text-blue-600 flex items-center justify-center hover:bg-blue-100">
                        <Plus className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {subtotal > 0 && (
          <div className="flex justify-between rounded-lg bg-blue-50 border border-blue-100 px-4 py-3">
            <span className="text-sm font-medium text-blue-800">Total</span>
            <span className="text-lg font-bold text-blue-800">${subtotal.toFixed(2)}</span>
          </div>
        )}
      </div>

      <button type="submit" disabled={saving || selectedItems.size === 0} className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors">
        <Save className="h-4 w-4" />{saving ? 'Creating…' : 'Create order'}
      </button>
    </form>
  );
}
