'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Receipt, Save } from 'lucide-react';
import { db } from '@/lib/db';
import { useAppStore } from '@/lib/store';

const CATEGORIES = [
  'Rent',
  'Supplies',
  'Utilities',
  'Marketing',
  'Labor',
  'Equipment',
  'Insurance',
  'Taxes',
  'Other',
];

export default function NewExpensePage() {
  const router = useRouter();
  const { activeShopId } = useAppStore();
  const [category, setCategory] = useState('Supplies');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    const amountVal = parseFloat(amount);
    if (isNaN(amountVal) || amountVal <= 0) {
      setError('Enter a valid amount greater than $0.');
      return;
    }
    if (!activeShopId) {
      setError('No shop selected.');
      return;
    }

    setSaving(true);
    try {
      await db.expenses.add({
        shopId: activeShopId,
        category,
        amount: amountVal,
        description: description.trim() || undefined,
        date: new Date(date),
        createdAt: new Date(),
      });
      router.push('/expenses');
    } catch (err) {
      setError('Failed to save expense.');
      console.error('Save expense error:', err);
    } finally {
      setSaving(false);
    }
  };

  if (!activeShopId) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-400">
        <Receipt className="mb-3 h-10 w-10" />
        <p className="text-sm font-medium">No shop selected</p>
        <p className="mt-1 text-xs">Select a shop to add expenses.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-full p-2 -ml-2 text-gray-500 hover:bg-gray-100 transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">New Expense</h1>
          <p className="text-sm text-gray-500">Record a business expense</p>
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Amount
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">$</span>
            <input
              type="number"
              step="0.01"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="w-full rounded-lg border border-gray-300 pl-7 pr-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-colors"
              autoFocus
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Category
          </label>
          <div className="flex flex-wrap gap-1.5">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategory(cat)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                  category === cat
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label htmlFor="expDate" className="block text-sm font-medium text-gray-700 mb-1.5">
            Date
          </label>
          <input
            id="expDate"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-colors"
          />
        </div>

        <div>
          <label htmlFor="expDesc" className="block text-sm font-medium text-gray-700 mb-1.5">
            Description <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <textarea
            id="expDesc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What was this expense for?"
            rows={3}
            className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-colors resize-none"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={saving}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        <Save className="h-4 w-4" />
        {saving ? 'Saving…' : 'Save expense'}
      </button>
    </form>
  );
}
