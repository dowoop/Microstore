'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Receipt,
  Wallet,
  Plus,
  Trash2,
  ShieldCheck,
  HandCoins,
  Heart,
  RefreshCw,
  PiggyBank,
  ExternalLink,
  AlertTriangle,
  Package,
} from 'lucide-react';
import { db, type Order, type Expense } from '@/lib/db';
import { useAppStore } from '@/lib/store';
import { useLowStockStore } from '@/lib/lowStockStore';
import {
  fetchWalletBalances,
  getConnection,
  type WalletBalances,
} from '@/lib/solanaPay';
import type { Cluster } from '@solana/web3.js';
import { getTokenPrices, formatUsd, isStablecoin } from '@/lib/priceOracle';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type Period = 'today' | 'week' | 'month' | 'all';

function periodStart(p: Period): Date {
  const now = new Date();
  switch (p) {
    case 'today':
      return new Date(now.getFullYear(), now.getMonth(), now.getDate());
    case 'week': {
      const d = new Date(now);
      d.setDate(d.getDate() - d.getDay());
      d.setHours(0, 0, 0, 0);
      return d;
    }
    case 'month':
      return new Date(now.getFullYear(), now.getMonth(), 1);
    default:
      return new Date(0);
  }
}

function formatSOL(sol: number): string {
  if (sol === 0) return '0 SOL';
  if (sol < 0.001) return `${(sol * 1e6).toFixed(2)} lamports`;
  return `${sol.toFixed(4)} SOL`;
}

function formatTokenWithUsd(uiAmount: number, symbol: string, mint: string, prices: Map<string, number>): string {
  const price = prices.get(mint);
  if (!price || price === 0) return `${uiAmount.toLocaleString()} ${symbol}`;
  return `${uiAmount.toLocaleString()} ${symbol} (≈ ${formatUsd(uiAmount * price)})`;
}

function formatTokenWithUsd(
  uiAmount: number,
  symbol: string,
  mint: string,
  prices: Map<string, number>,
): string {
  const price = prices.get(mint);
  if (!price || price === 0) return `${uiAmount.toLocaleString()} ${symbol}`;
  const usdValue = uiAmount * price;
  if (isStablecoin(symbol) && Math.abs(price - 1) < 0.02) {
    // Stablecoin ~$1 — don't show redundant ~$ prefix
    return `${uiAmount.toLocaleString()} ${symbol} (≈ ${formatUsd(usdValue)})`;
  }
  return `${uiAmount.toLocaleString()} ${symbol} (≈ ${formatUsd(usdValue)})`;
}

// ---------------------------------------------------------------------------
// Expense categories
// ---------------------------------------------------------------------------

const EXPENSE_CATEGORIES = [
  'Rent',
  'Utilities',
  'Supplies',
  'Marketing',
  'Payroll',
  'Software',
  'Travel',
  'Other',
];

// ---------------------------------------------------------------------------
// Money Dashboard
// ---------------------------------------------------------------------------

export default function MoneyPage() {
  const { activeShopId } = useAppStore();
  const lowStockCount = useLowStockStore((s) => s.lowStockCount);
  const lowStockItems = useLowStockStore((s) => s.lowStockItems);
  const [period, setPeriod] = useState<Period>('month');
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [balances, setBalances] = useState<Record<string, WalletBalances>>({});
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [balanceError, setBalanceError] = useState<string | null>(null);
  const [tokenPrices, setTokenPrices] = useState<Map<string, number>>(new Map());
  const [tokenPrices, setTokenPrices] = useState<Map<string, number>>(new Map());

  // Add expense form state
  const [expenseCategory, setExpenseCategory] = useState('Supplies');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseDesc, setExpenseDesc] = useState('');
  const [expenseDate, setExpenseDate] = useState(
    () => new Date().toISOString().slice(0, 10),
  );
  const [expenseSaving, setExpenseSaving] = useState(false);

  // Load shop
  const shop = useLiveQuery(
    () => (activeShopId ? db.shops.get(activeShopId) : undefined),
    [activeShopId],
  );

  // Load orders for the active shop
  const orders = useLiveQuery(
    () =>
      activeShopId
        ? db.orders.where('shopId').equals(activeShopId).toArray()
        : [],
    [activeShopId],
  );

  // Load expenses for the active shop
  const expenses = useLiveQuery(
    () =>
      activeShopId
        ? db.expenses.where('shopId').equals(activeShopId).toArray()
        : [],
    [activeShopId],
  );

  // -----------------------------------------------------------------------
  // Computed financial data
  // -----------------------------------------------------------------------

  const financials = useMemo(() => {
    if (!orders) return null;

    const start = periodStart(period);
    const inPeriod: Order[] = orders.filter(
      (o) => o.createdAt >= start && o.status !== 'cancelled',
    );

    const allTime = orders.filter((o) => o.status !== 'cancelled');

    const totalInPeriod = inPeriod.reduce((sum, o) => sum + o.total, 0);
    const taxInPeriod = inPeriod.reduce((sum, o) => sum + (o.tax ?? 0), 0);

    // Estimate tips: if total includes tax, approximate tip as 10-20% of subtotal
    // Since we don't store tip separately, we estimate from the total
    // (total - tax) * avgTipRate. But this is rough; we show it as "est."
    const subtotalInPeriod = totalInPeriod - taxInPeriod;
    const tipEstimate = subtotalInPeriod * 0.10; // rough 10% average tip

    // Estimate donations (charity round-up): ~1% of transaction count
    const donationEstimate = inPeriod.length * 0.50; // rough $0.50 avg per order

    // Revenue breakdown
    const merchantRevenue = subtotalInPeriod - tipEstimate;

    // All-time stats
    const allTimeTotal = allTime.reduce((sum, o) => sum + o.total, 0);
    const allTimeCount = allTime.length;

    return {
      orderCount: inPeriod.length,
      totalRevenue: totalInPeriod,
      taxCollected: taxInPeriod,
      tipEstimate,
      donationEstimate,
      merchantRevenue,
      averageOrder: inPeriod.length > 0 ? totalInPeriod / inPeriod.length : 0,
      allTimeTotal,
      allTimeCount,
    };
  }, [orders, period]);

  const expenseData = useMemo(() => {
    if (!expenses) return null;

    const start = periodStart(period);
    const inPeriod: Expense[] = expenses.filter((e) => e.date >= start);
    const totalInPeriod = inPeriod.reduce((sum, e) => sum + e.amount, 0);

    const allTimeTotal = expenses.reduce((sum, e) => sum + e.amount, 0);

    return {
      count: inPeriod.length,
      total: totalInPeriod,
      allTimeTotal,
    };
  }, [expenses, period]);

  // -----------------------------------------------------------------------
  // Wallet balance fetching
  // -----------------------------------------------------------------------

  const walletsToCheck = useMemo(() => {
    const addrs: { key: string; label: string; address: string }[] = [];
    if (shop?.merchantWallet) {
      addrs.push({ key: 'merchant', label: 'Merchant', address: shop.merchantWallet });
    }
    if (shop?.taxWallet && shop.taxWallet !== shop.merchantWallet) {
      addrs.push({ key: 'tax', label: 'Tax', address: shop.taxWallet });
    }
    if (shop?.charityWallet && shop.charityWallet !== shop.merchantWallet) {
      addrs.push({ key: 'charity', label: 'Charity', address: shop.charityWallet });
    }
    return addrs;
  }, [shop]);

  const refreshBalances = useCallback(async () => {
    if (walletsToCheck.length === 0) return;
    setBalanceLoading(true);
    setBalanceError(null);

    const results: Record<string, WalletBalances> = {};
    const cluster: Cluster = 'devnet';

    for (const w of walletsToCheck) {
      try {
        results[w.key] = await fetchWalletBalances(w.address, cluster);
      } catch (err) {
        console.error(`Failed to fetch balance for ${w.key}:`, err);
        results[w.key] = { sol: 0, tokens: [], fetchedAt: new Date() };
      }
    }

    if (Object.keys(results).length === 0) {
      setBalanceError('Could not fetch any wallet balances.');
    }

    setBalances(results);
    setBalanceLoading(false);
  }, [walletsToCheck]);

  // Auto-refresh on shop change
  useEffect(() => {
    if (walletsToCheck.length > 0) {
      refreshBalances();
    }
  }, [shop?.merchantWallet]); // eslint-disable-line react-hooks/exhaustive-deps

  // Periodic auto-refresh every 30s
  useEffect(() => {
    if (walletsToCheck.length === 0) return;
    const interval = setInterval(() => { refreshBalances(); }, 30_000);
    return () => clearInterval(interval);
  }, [refreshBalances, walletsToCheck.length]);

  // Fetch token prices when wallet balances change
  useEffect(() => {
    const mintsToPrice: { mint: string; symbol: string }[] = [];
    mintsToPrice.push({ mint: 'So11111111111111111111111111111111111111112', symbol: 'SOL' });
    for (const b of Object.values(balances)) {
      for (const t of b.tokens) {
        if (!mintsToPrice.some((m) => m.mint === t.mint)) mintsToPrice.push({ mint: t.mint, symbol: t.symbol });
      }
    }
    if (shop?.acceptedTokens) {
      for (const t of shop.acceptedTokens) {
        if (!mintsToPrice.some((m) => m.mint === t.mint)) mintsToPrice.push({ mint: t.mint, symbol: t.symbol });
      }
    }
    if (mintsToPrice.length > 0) { getTokenPrices(mintsToPrice).then(setTokenPrices).catch(() => {}); }
  }, [balances, shop?.acceptedTokens]);

  // Periodic auto-refresh every 30s
  useEffect(() => {
    if (walletsToCheck.length === 0) return;
    const interval = setInterval(() => {
      refreshBalances();
    }, 30_000);
    return () => clearInterval(interval);
  }, [refreshBalances, walletsToCheck.length]);

  // Fetch token prices when wallet balances change
  useEffect(() => {
    // Collect all unique mints from wallet balances and accepted tokens
    const mintsToPrice: { mint: string; symbol: string }[] = [];

    // Add SOL (as synthetic token)
    mintsToPrice.push({ mint: 'So11111111111111111111111111111111111111112', symbol: 'SOL' });

    // Add tokens from wallet balances
    for (const b of Object.values(balances)) {
      for (const t of b.tokens) {
        if (!mintsToPrice.some((m) => m.mint === t.mint)) {
          mintsToPrice.push({ mint: t.mint, symbol: t.symbol });
        }
      }
    }

    // Add shop's accepted tokens
    if (shop?.acceptedTokens) {
      for (const t of shop.acceptedTokens) {
        if (!mintsToPrice.some((m) => m.mint === t.mint)) {
          mintsToPrice.push({ mint: t.mint, symbol: t.symbol });
        }
      }
    }

    if (mintsToPrice.length > 0) {
      getTokenPrices(mintsToPrice).then(setTokenPrices).catch(() => {});
    }
  }, [balances, shop?.acceptedTokens]);

  // -----------------------------------------------------------------------
  // Add expense
  // -----------------------------------------------------------------------

  const handleAddExpense = async () => {
    if (!activeShopId || !expenseAmount || !expenseCategory) return;

    const amount = parseFloat(expenseAmount);
    if (isNaN(amount) || amount <= 0) return;

    setExpenseSaving(true);
    try {
      await db.expenses.add({
        shopId: activeShopId,
        category: expenseCategory,
        amount,
        description: expenseDesc || undefined,
        date: new Date(expenseDate),
        createdAt: new Date(),
      });

      // Reset form
      setExpenseAmount('');
      setExpenseDesc('');
      setExpenseCategory('Supplies');
      setExpenseDate(new Date().toISOString().slice(0, 10));
      setShowAddExpense(false);
    } finally {
      setExpenseSaving(false);
    }
  };

  const handleDeleteExpense = async (id: number) => {
    if (!confirm('Delete this expense?')) return;
    await db.expenses.delete(id);
  };

  // -----------------------------------------------------------------------
  // No shop selected
  // -----------------------------------------------------------------------

  if (!activeShopId) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-500">
        <DollarSign className="mb-3 h-10 w-10" />
        <p className="text-sm font-medium">No shop selected</p>
        <p className="mt-1 text-xs">Select a shop to view financial data.</p>
      </div>
    );
  }

  // -----------------------------------------------------------------------
  // Main render
  // -----------------------------------------------------------------------

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Money</h1>
          <p className="text-sm text-gray-500">
            {shop?.name ?? `Shop #${activeShopId}`}
          </p>
        </div>
      </div>

      {/* Period selector */}
      <div className="flex gap-1 rounded-lg bg-gray-100 p-0.5 w-fit">
        {(['today', 'week', 'month', 'all'] as const).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
              period === p
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {p.charAt(0).toUpperCase() + p.slice(1)}
          </button>
        ))}
      </div>

      {/* Low stock alert */}
      {lowStockCount > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-amber-800">
                {lowStockCount} item{lowStockCount !== 1 ? 's' : ''} running low
              </p>
              <div className="mt-1 flex flex-wrap gap-1">
                {lowStockItems.slice(0, 3).map((item) => (
                  <span
                    key={item.id}
                    className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800"
                  >
                    {item.name} ({item.stock})
                  </span>
                ))}
                {lowStockItems.length > 3 && (
                  <span className="text-xs text-amber-600">
                    +{lowStockItems.length - 3} more
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Revenue summary */}
      <div>
        <h2 className="mb-2 text-sm font-semibold text-gray-500 uppercase tracking-wide">
          Revenue
        </h2>
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg border border-gray-200 bg-white p-3">
            <div className="flex items-center gap-1.5 text-[11px] text-gray-500">
              <DollarSign className="h-3 w-3 text-green-500" />
              Total Revenue
            </div>
            <div className="mt-1 text-lg font-bold text-gray-900">
              ${financials?.totalRevenue.toFixed(2) ?? '—'}
            </div>
            <div className="text-[10px] text-gray-500">
              {financials?.orderCount ?? 0} orders
            </div>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-3">
            <div className="flex items-center gap-1.5 text-[11px] text-gray-500">
              <TrendingUp className="h-3 w-3 text-blue-500" />
              Avg Order
            </div>
            <div className="mt-1 text-lg font-bold text-gray-900">
              ${financials?.averageOrder.toFixed(2) ?? '—'}
            </div>
            <div className="text-[10px] text-gray-500">
              All-time: ${financials?.allTimeTotal.toFixed(2) ?? '0.00'}
            </div>
          </div>
        </div>
      </div>

      {/* Allocation breakdown */}
      <div>
        <h2 className="mb-2 text-sm font-semibold text-gray-500 uppercase tracking-wide">
          Allocation
        </h2>
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg border border-gray-200 bg-white p-3">
            <div className="flex items-center gap-1.5 text-[11px] text-gray-500">
              <ShieldCheck className="h-3 w-3 text-indigo-500" />
              Tax Collected
            </div>
            <div className="mt-1 text-lg font-bold text-gray-900">
              ${financials?.taxCollected.toFixed(2) ?? '—'}
            </div>
            <div className="text-[10px] text-gray-500">8.875% rate</div>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-3">
            <div className="flex items-center gap-1.5 text-[11px] text-gray-500">
              <HandCoins className="h-3 w-3 text-amber-500" />
              Tips (est.)
            </div>
            <div className="mt-1 text-lg font-bold text-gray-900">
              ${financials?.tipEstimate.toFixed(2) ?? '—'}
            </div>
            <div className="text-[10px] text-gray-500">~10% avg</div>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-3">
            <div className="flex items-center gap-1.5 text-[11px] text-gray-500">
              <Heart className="h-3 w-3 text-rose-500" />
              Donations (est.)
            </div>
            <div className="mt-1 text-lg font-bold text-gray-900">
              ${financials?.donationEstimate.toFixed(2) ?? '—'}
            </div>
            <div className="text-[10px] text-gray-500">Round-up</div>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-3">
            <div className="flex items-center gap-1.5 text-[11px] text-gray-500">
              <PiggyBank className="h-3 w-3 text-green-600" />
              Merchant Net
            </div>
            <div className="mt-1 text-lg font-bold text-gray-900">
              ${financials?.merchantRevenue.toFixed(2) ?? '—'}
            </div>
            <div className="text-[10px] text-gray-500">After tax & tips</div>
          </div>
        </div>
      </div>

      {/* Expenses */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
            Expenses
          </h2>
          <button
            onClick={() => setShowAddExpense(!showAddExpense)}
            className="inline-flex items-center gap-1 rounded-md bg-white border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <Plus className="h-3 w-3" />
            Add
          </button>
        </div>

        {/* Stats */}
        <div className="mb-2 rounded-lg border border-gray-200 bg-white p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-[11px] text-gray-500">
              <TrendingDown className="h-3 w-3 text-red-500" />
              {period.charAt(0).toUpperCase() + period.slice(1)} Expenses
            </div>
            <span className="text-sm font-bold text-gray-900">
              ${expenseData?.total.toFixed(2) ?? '—'}
            </span>
          </div>
          <div className="text-[10px] text-gray-500 mt-0.5">
            All-time: ${expenseData?.allTimeTotal.toFixed(2) ?? '0.00'}
          </div>
        </div>

        {/* Add expense form */}
        {showAddExpense && (
          <div className="rounded-lg border border-gray-200 bg-white p-3 space-y-3 mb-2">
            <div className="flex gap-2">
              <select
                value={expenseCategory}
                onChange={(e) => setExpenseCategory(e.target.value)}
                className="flex-1 rounded-md border border-gray-300 px-2.5 py-2 text-sm text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none"
              >
                {EXPENSE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <input
                type="number"
                value={expenseAmount}
                onChange={(e) => setExpenseAmount(e.target.value)}
                placeholder="Amount"
                step="0.01"
                min="0.01"
                className="w-28 rounded-md border border-gray-300 px-2.5 py-2 text-sm text-gray-900 placeholder:text-gray-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none"
              />
            </div>
            <input
              type="text"
              value={expenseDesc}
              onChange={(e) => setExpenseDesc(e.target.value)}
              placeholder="Description (optional)"
              className="w-full rounded-md border border-gray-300 px-2.5 py-2 text-sm text-gray-900 placeholder:text-gray-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none"
            />
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={expenseDate}
                onChange={(e) => setExpenseDate(e.target.value)}
                className="flex-1 rounded-md border border-gray-300 px-2.5 py-2 text-sm text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none"
              />
              <button
                onClick={handleAddExpense}
                disabled={
                  expenseSaving || !expenseAmount || !expenseCategory
                }
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {expenseSaving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        )}

        {/* Expense list */}
        {expenses && expenses.length > 0 && (
          <div className="space-y-1">
            {expenses
              .filter((e) => {
                const start = periodStart(period);
                return e.date >= start;
              })
              .sort((a, b) => b.date.getTime() - a.date.getTime())
              .slice(0, 20)
              .map((exp) => (
                <div
                  key={exp.id}
                  className="flex items-center gap-2 rounded-md border border-gray-100 bg-white px-3 py-2"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 truncate">
                      {exp.category}
                      {exp.description && (
                        <span className="text-gray-500 ml-1 font-normal">
                          — {exp.description}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-gray-500">
                      {new Date(exp.date).toLocaleDateString()}
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-red-600">
                    -${exp.amount.toFixed(2)}
                  </span>
                  <button
                    onClick={() => handleDeleteExpense(exp.id!)}
                    className="shrink-0 text-gray-300 hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            {expenses.filter((e) => {
              const start = periodStart(period);
              return e.date >= start;
            }).length === 0 && (
              <p className="py-3 text-center text-xs text-gray-500">
                No expenses for this period.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Wallet balances */}
      {walletsToCheck.length > 0 && (
        <div>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
              Wallet Balances
            </h2>
            <button
              onClick={refreshBalances}
              disabled={balanceLoading}
              className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 disabled:opacity-50"
            >
              <RefreshCw
                className={`h-3 w-3 ${balanceLoading ? 'animate-spin' : ''}`}
              />
              Refresh
            </button>
          </div>

          {balanceError && (
            <p className="text-xs text-red-500 mb-2">{balanceError}</p>
          )}

          <div className="space-y-2">
            {walletsToCheck.map((w) => {
              const b = balances[w.key];
              const isFirstLoad = !b && !balanceLoading;

              return (
                <div
                  key={w.key}
                  className="rounded-lg border border-gray-200 bg-white p-3"
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <Wallet className="h-4 w-4 text-gray-500" />
                      <span className="text-sm font-medium text-gray-900">
                        {w.label} Wallet
                      </span>
                    </div>
                    <a
                      href={`https://explorer.solana.com/address/${w.address}?cluster=devnet`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gray-500 hover:text-blue-500 transition-colors"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </div>

                  <div className="font-mono text-[10px] text-gray-500 truncate mb-1.5">
                    {w.address}
                  </div>

                  {isFirstLoad ? (
                    <p className="text-xs text-gray-500 italic">
                      Tap Refresh to load balances
                    </p>
                  ) : balanceLoading && !b ? (
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <RefreshCw className="h-3 w-3 animate-spin" />
                      Loading…
                    </div>
                  ) : b ? (
                    <div className="space-y-1">
                      <div className="flex items-baseline gap-2">
                        <span className="text-sm font-bold text-gray-900">
                          {formatSOL(b.sol)}
                        </span>
                        {b.solUsd && (
                          <span className="text-[11px] text-gray-500">
                            ~${b.solUsd.toFixed(2)}
                          </span>
                        )}
                      </div>
                      {b.tokens.length > 0 && (
                        <div className="space-y-0.5">
                          {b.tokens.map((t) => (
                            <div
                              key={t.mint}
                              className="flex items-baseline gap-2 text-xs"
                            >
                              <span className="font-medium text-gray-700">
                                {t.uiAmount.toLocaleString()} {t.symbol}
                              </span>
                              <span className="text-[10px] text-gray-500 font-mono">
                                {t.mint.slice(0, 4)}…{t.mint.slice(-4)}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="text-[10px] text-gray-300">
                        Updated {b.fetchedAt.toLocaleTimeString()}
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* No wallets configured */}
      {walletsToCheck.length === 0 && shop && (
        <div className="rounded-lg border border-gray-200 bg-white p-4 text-center">
          <Wallet className="mx-auto mb-2 h-5 w-5 text-gray-300" />
          <p className="text-sm text-gray-500">No wallets configured</p>
          <p className="text-xs text-gray-500 mt-1">
            Configure your merchant, tax, and charity wallets in Shop Settings
            to see live balances.
          </p>
        </div>
      )}
    </div>
  );
}