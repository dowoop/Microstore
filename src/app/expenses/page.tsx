'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Plus,
  Receipt,
  Search,
  Calendar,
  Trash2,
} from 'lucide-react';
import { db, type Expense } from '@/lib/db';
import { useAppStore } from '@/lib/store';
import { useRouter } from 'next/navigation';

export default function ExpensesPage() {
  const { activeShopId } = useAppStore();
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [deleting, setDeleting] = useState<number | null>(null);

  const expenses = useLiveQuery(
    () =>
      activeShopId
        ? db.expenses.where('shopId').equals(activeShopId).reverse().sortBy('date')
        : [],
    [activeShopId],
  );

  const filteredExpenses = useMemo(() => {
    if (!expenses) return [];
    if (!search.trim()) return expenses;
    const q = search.toLowerCase();
    return expenses.filter(
      (e) =>
        e.category?.toLowerCase().includes(q) ||
        e.description?.toLowerCase().includes(q),
    );
  }, [expenses, search]);

  const total = useMemo(() => {
    if (!filteredExpenses) return 0;
    return filteredExpenses.reduce((sum, e) => sum + e.amount, 0);
  }, [filteredExpenses]);

  const handleDelete = async (id: number) => {
    setDeleting(id);
    await db.expenses.delete(id);
    setDeleting(null);
  };

  if (!activeShopId) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-500">
        <Receipt className="mb-3 h-10 w-10" />
        <p className="text-sm font-medium">No shop selected</p>
        <p className="mt-1 text-xs">Select a shop to view its expenses.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Expenses</h1>
          <p className="text-sm text-gray-500">
            {expenses ? `${expenses.length} expense${expenses.length !== 1 ? 's' : ''}` : 'Loading…'}
          </p>
        </div>
        <Link
          href="/expenses/new"
          className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Add
        </Link>
      </div>

      {filteredExpenses && filteredExpenses.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-white px-3 py-2">
          <div className="text-[11px] text-gray-500">Total expenses</div>
          <div className="text-lg font-bold text-gray-900">
            ${total.toFixed(2)}
          </div>
        </div>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search expenses by category or description…"
          className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm text-gray-900 placeholder:text-gray-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-colors"
        />
      </div>

      {!expenses ? (
        <div className="flex flex-col items-center justify-center py-16 text-gray-500">
          <Receipt className="mb-3 h-8 w-8 animate-pulse" />
          <p className="text-sm">Loading expenses…</p>
        </div>
      ) : filteredExpenses.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-gray-500">
          <Receipt className="mb-3 h-8 w-8" />
          <p className="text-sm font-medium">No expenses found</p>
          <p className="mt-1 text-xs">
            {search ? 'Try a different search.' : 'Track your business costs here.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredExpenses.map((expense) => (
            <div
              key={expense.id}
              className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-3 py-3"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-100">
                <Receipt className="h-5 w-5 text-gray-500" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-gray-900 truncate">
                    {expense.category || 'Uncategorized'}
                  </span>
                </div>
                <p className="text-xs text-gray-500 truncate">
                  {expense.description || 'No description'}
                </p>
                <p className="text-xs text-gray-500">
                  {new Date(expense.date).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <div className="text-sm font-bold text-gray-900">
                  ${expense.amount.toFixed(2)}
                </div>
                <button
                  onClick={() => handleDelete(expense.id)}
                  disabled={deleting === expense.id}
                  className="mt-1 text-red-400 hover:text-red-600 disabled:opacity-50 transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
