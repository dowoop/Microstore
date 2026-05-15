'use client';

import { useState, useCallback, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Download,
  Upload,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Store,
  Camera,
  Save,
  X,
  RefreshCw,
} from 'lucide-react';
import { db, markDbInitialized } from '@/lib/db';
import { useAppStore } from '@/lib/store';
import { useRouter } from 'next/navigation';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TAX_RATE = 8.875;

// ---------------------------------------------------------------------------
// Settings Page
// ---------------------------------------------------------------------------

export default function SettingsPage() {
  const { activeShopId, setActiveShopId } = useAppStore();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load shops
  const shops = useLiveQuery(() => db.shops.toArray(), []);
  const shop = useLiveQuery(
    () => (activeShopId ? db.shops.get(activeShopId) : undefined),
    [activeShopId],
  );

  // Shop edit form state
  const [editing, setEditing] = useState(false);
  const [shopName, setShopName] = useState('');
  const [shopUsername, setShopUsername] = useState('');
  const [shopDescription, setShopDescription] = useState('');
  const [shopPhotoUrl, setShopPhotoUrl] = useState('');
  const [shopCurrency, setShopCurrency] = useState('USD');
  const [tipPresets, setTipPresets] = useState('0,10,15,20');

  // Wallet config
  const [merchantWallet, setMerchantWallet] = useState('');
  const [taxWallet, setTaxWallet] = useState('');
  const [charityWallet, setCharityWallet] = useState('');
  const [splTokenMint, setSplTokenMint] = useState('');
  const [splTokenSymbol, setSplTokenSymbol] = useState('');

  // Toggles
  const [taxAllocationEnabled, setTaxAllocationEnabled] = useState(true);
  const [charityEnabled, setCharityEnabled] = useState(false);
  const [charityPartners, setCharityPartners] = useState('');

  // Saving state
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // Delete state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);

  // Import state
  const [importMessage, setImportMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // -----------------------------------------------------------------------
  // Switch shop
  // -----------------------------------------------------------------------

  const handleSwitchShop = (id: number) => {
    setActiveShopId(id);
  };

  // -----------------------------------------------------------------------
  // Start editing
  // -----------------------------------------------------------------------

  const startEditing = useCallback(() => {
    if (!shop) return;
    setShopName(shop.name);
    setShopUsername(shop.username);
    setShopDescription(shop.description ?? '');
    setShopPhotoUrl(shop.photoUrl ?? '');
    setShopCurrency(shop.currency ?? 'USD');
    setTipPresets(shop.tipPresets.join(','));
    setMerchantWallet(shop.merchantWallet ?? '');
    setTaxWallet(shop.taxWallet ?? '');
    setCharityWallet(shop.charityWallet ?? '');
    setSplTokenMint(shop.splTokenMint ?? '');
    setSplTokenSymbol(shop.splTokenSymbol ?? '');
    setTaxAllocationEnabled(shop.taxAllocationEnabled);
    setCharityEnabled(shop.charityEnabled);
    setCharityPartners(shop.charityPartners.join(', '));
    setSaveMessage(null);
    setEditing(true);
  }, [shop]);

  const cancelEditing = () => {
    setEditing(false);
    setSaveMessage(null);
  };

  // -----------------------------------------------------------------------
  // Photo upload (file → object URL)
  // -----------------------------------------------------------------------

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Revoke previous object URL to avoid memory leaks
    if (shopPhotoUrl && shopPhotoUrl.startsWith('blob:')) {
      URL.revokeObjectURL(shopPhotoUrl);
    }

    const url = URL.createObjectURL(file);
    setShopPhotoUrl(url);
  };

  const clearPhoto = () => {
    if (shopPhotoUrl && shopPhotoUrl.startsWith('blob:')) {
      URL.revokeObjectURL(shopPhotoUrl);
    }
    setShopPhotoUrl('');
  };

  // -----------------------------------------------------------------------
  // Save shop
  // -----------------------------------------------------------------------

  const handleSave = async () => {
    if (!activeShopId || !shop) return;

    if (!shopName.trim()) {
      setSaveMessage({ type: 'error', text: 'Shop name is required.' });
      return;
    }

    if (!shopUsername.trim()) {
      setSaveMessage({ type: 'error', text: 'Username / @ slug is required.' });
      return;
    }

    setSaving(true);
    setSaveMessage(null);

    try {
      const tips = tipPresets
        .split(',')
        .map((s) => parseInt(s.trim(), 10))
        .filter((n) => !isNaN(n) && n >= 0 && n <= 100);

      const partners = charityPartners
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      await db.shops.update(activeShopId, {
        name: shopName.trim(),
        username: shopUsername.trim(),
        description: shopDescription.trim() || undefined,
        photoUrl: shopPhotoUrl || undefined,
        currency: shopCurrency,
        tipPresets: tips.length > 0 ? tips : [0],
        merchantWallet: merchantWallet.trim() || undefined,
        taxWallet: taxWallet.trim() || undefined,
        charityWallet: charityWallet.trim() || undefined,
        splTokenMint: splTokenMint.trim() || undefined,
        splTokenSymbol: splTokenSymbol.trim() || undefined,
        taxAllocationEnabled,
        charityEnabled,
        charityPartners: partners,
        updatedAt: new Date(),
      });

      setSaveMessage({ type: 'success', text: 'Shop settings saved.' });
      setEditing(false);
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (err) {
      console.error('Save error:', err);
      setSaveMessage({ type: 'error', text: 'Failed to save. Check console.' });
    } finally {
      setSaving(false);
    }
  };

  // -----------------------------------------------------------------------
  // Delete shop
  // -----------------------------------------------------------------------

  const handleDelete = async () => {
    if (!activeShopId) return;

    setDeleting(true);
    try {
      // Delete all related data
      await db.orders.where('shopId').equals(activeShopId).delete();
      await db.items.where('shopId').equals(activeShopId).delete();
      await db.expenses.where('shopId').equals(activeShopId).delete();
      await db.shops.delete(activeShopId);

      setActiveShopId(null);
      setShowDeleteConfirm(false);
      router.push('/');
    } catch (err) {
      console.error('Delete error:', err);
      setDeleting(false);
    }
  };

  // -----------------------------------------------------------------------
  // Export JSON
  // -----------------------------------------------------------------------

  const handleExport = async () => {
    if (!activeShopId || !shop) return;

    try {
      const [shopData, items, orders, expenses] = await Promise.all([
        db.shops.get(activeShopId),
        db.items.where('shopId').equals(activeShopId).toArray(),
        db.orders.where('shopId').equals(activeShopId).toArray(),
        db.expenses.where('shopId').equals(activeShopId).toArray(),
      ]);

      const exportData = {
        version: 1,
        exportedAt: new Date().toISOString(),
        shop: shopData,
        items,
        orders: orders.map((o) => ({
          ...o,
          createdAt:
            o.createdAt instanceof Date
              ? o.createdAt.toISOString()
              : o.createdAt,
          updatedAt:
            o.updatedAt instanceof Date
              ? o.updatedAt.toISOString()
              : o.updatedAt,
        })),
        expenses: expenses.map((e) => ({
          ...e,
          date: e.date instanceof Date ? e.date.toISOString() : e.date,
          createdAt:
            e.createdAt instanceof Date
              ? e.createdAt.toISOString()
              : e.createdAt,
        })),
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `microstore-${shop.username}-${new Date()
        .toISOString()
        .slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);

      setImportMessage({
        type: 'success',
        text: `Exported ${items.length} items, ${orders.length} orders, ${expenses.length} expenses.`,
      });
      setTimeout(() => setImportMessage(null), 4000);
    } catch (err) {
      console.error('Export error:', err);
      setImportMessage({ type: 'error', text: 'Export failed.' });
    }
  };

  // -----------------------------------------------------------------------
  // Import JSON
  // -----------------------------------------------------------------------

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportMessage(null);

    try {
      const text = await file.text();
      const data = JSON.parse(text);

      if (!data.version || !data.shop) {
        throw new Error('Invalid export file format.');
      }

      if (!confirm(`Import "${data.shop.name}"? This will create a new shop with all its data. Existing data will not be overwritten.`)) {
        return;
      }

      // Create new shop (assign new ID)
      const shopImport = { ...data.shop };
      delete shopImport.id; // Dexie auto-increments
      shopImport.createdAt = new Date(shopImport.createdAt);
      shopImport.updatedAt = new Date();

      const newShopId = await db.shops.add(shopImport);

      // Import items
      if (data.items?.length > 0) {
        await db.items.bulkAdd(
          data.items.map((item: Record<string, unknown>) => ({
            ...item,
            id: undefined,
            shopId: newShopId,
            createdAt: new Date((item as { createdAt: string }).createdAt),
            updatedAt: new Date(),
          })),
        );
      }

      // Import orders
      if (data.orders?.length > 0) {
        await db.orders.bulkAdd(
          data.orders.map((order: Record<string, unknown>) => ({
            ...order,
            id: undefined,
            shopId: newShopId,
            createdAt: new Date((order as { createdAt: string }).createdAt),
            updatedAt: new Date(),
          })),
        );
      }

      // Import expenses
      if (data.expenses?.length > 0) {
        await db.expenses.bulkAdd(
          data.expenses.map((expense: Record<string, unknown>) => ({
            ...expense,
            id: undefined,
            shopId: newShopId,
            date: new Date((expense as { date: string }).date),
            createdAt: new Date((expense as { createdAt: string }).createdAt),
          })),
        );
      }

      setActiveShopId(newShopId);
      markDbInitialized();
      setImportMessage({
        type: 'success',
        text: `Imported "${shopImport.name}" — ${data.items?.length ?? 0} items, ${data.orders?.length ?? 0} orders, ${data.expenses?.length ?? 0} expenses.`,
      });
      setTimeout(() => setImportMessage(null), 5000);
    } catch (err) {
      console.error('Import error:', err);
      setImportMessage({
        type: 'error',
        text: `Import failed: ${err instanceof Error ? err.message : 'Invalid file'}`,
      });
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // -----------------------------------------------------------------------
  // No shop selected
  // -----------------------------------------------------------------------

  if (!activeShopId) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-xl font-bold text-gray-900">Settings</h1>

        {/* Shop switcher */}
        {shops && shops.length > 0 && (
          <div>
            <h2 className="mb-2 text-sm font-semibold text-gray-500 uppercase tracking-wide">
              Select Shop
            </h2>
            <div className="space-y-1">
              {shops.map((s) => (
                <button
                  key={s.id}
                  onClick={() => handleSwitchShop(s.id!)}
                  className="flex w-full items-center gap-3 rounded-lg border border-gray-200 bg-white p-3 text-left hover:border-blue-300 transition-colors"
                >
                  <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-lg bg-gray-100">
                    {s.photoUrl ? (
                      <img
                        src={s.photoUrl}
                        alt={s.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <Store className="h-5 w-5 text-gray-400" />
                    )}
                  </div>
                  <div>
                    <div className="text-sm font-medium text-gray-900">
                      {s.name}
                    </div>
                    <div className="text-xs text-gray-400">@{s.username}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Import section (always available even without shop) */}
        <div>
          <h2 className="mb-2 text-sm font-semibold text-gray-500 uppercase tracking-wide">
            Import Data
          </h2>
          <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-3">
            <p className="text-sm text-gray-600">
              Import a previously exported Microstore JSON file to restore a
              shop and all its data.
            </p>
            <label className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 cursor-pointer transition-colors">
              <Upload className="h-4 w-4" />
              Choose File
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleImport}
                className="hidden"
              />
            </label>
            {importMessage && (
              <div
                className={`flex items-center gap-1.5 text-xs ${
                  importMessage.type === 'success'
                    ? 'text-green-600'
                    : 'text-red-600'
                }`}
              >
                {importMessage.type === 'success' ? (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                ) : (
                  <AlertTriangle className="h-3.5 w-3.5" />
                )}
                {importMessage.text}
              </div>
            )}
          </div>
        </div>

        {/* No shop placeholder */}
        {(!shops || shops.length === 0) && (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <Store className="mb-3 h-10 w-10" />
            <p className="text-sm font-medium">No shops yet</p>
            <p className="mt-1 text-xs">
              Create a shop first to access settings.
            </p>
          </div>
        )}
      </div>
    );
  }

  // -----------------------------------------------------------------------
  // Main render (with active shop)
  // -----------------------------------------------------------------------

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Settings</h1>
          <p className="text-sm text-gray-500">
            {shop?.name ?? `Shop #${activeShopId}`}
          </p>
        </div>
        {!editing ? (
          <button
            onClick={startEditing}
            className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
          >
            Edit Shop
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <button
              onClick={cancelEditing}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {saving ? (
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="h-3.5 w-3.5" />
              )}
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        )}
      </div>

      {/* Shop switcher */}
      {shops && shops.length > 1 && (
        <div>
          <h2 className="mb-2 text-sm font-semibold text-gray-500 uppercase tracking-wide">
            Switch Shop
          </h2>
          <div className="flex flex-wrap gap-1.5">
            {shops.map((s) => (
              <button
                key={s.id}
                onClick={() => handleSwitchShop(s.id!)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  s.id === activeShopId
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {s.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Save message */}
      {saveMessage && (
        <div
          className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
            saveMessage.type === 'success'
              ? 'border-green-200 bg-green-50 text-green-700'
              : 'border-red-200 bg-red-50 text-red-700'
          }`}
        >
          {saveMessage.type === 'success' ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : (
            <AlertTriangle className="h-4 w-4" />
          )}
          {saveMessage.text}
        </div>
      )}

      {/* Edit form */}
      {editing ? (
        <div className="space-y-5">
          {/* Basic info */}
          <div>
            <h2 className="mb-3 text-sm font-semibold text-gray-500 uppercase tracking-wide">
              Shop Info
            </h2>
            <div className="space-y-3 rounded-lg border border-gray-200 bg-white p-4">
              {/* Photo */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Photo
                </label>
                <div className="flex items-center gap-3">
                  <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-lg bg-gray-100">
                    {shopPhotoUrl ? (
                      <img
                        src={shopPhotoUrl}
                        alt="Shop"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <Camera className="h-6 w-6 text-gray-300" />
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <label className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 cursor-pointer transition-colors">
                      <Upload className="h-3 w-3" />
                      Upload
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handlePhotoUpload}
                        className="hidden"
                      />
                    </label>
                    {shopPhotoUrl && (
                      <button
                        onClick={clearPhoto}
                        className="block text-xs text-red-500 hover:text-red-700"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Name */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Shop Name
                </label>
                <input
                  type="text"
                  value={shopName}
                  onChange={(e) => setShopName(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none"
                />
              </div>

              {/* Username */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  @ Username
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">
                    @
                  </span>
                  <input
                    type="text"
                    value={shopUsername}
                    onChange={(e) =>
                      setShopUsername(e.target.value.replace(/^@/, ''))
                    }
                    className="w-full rounded-md border border-gray-300 py-2 pl-7 pr-3 text-sm text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Tagline / Description
                </label>
                <input
                  type="text"
                  value={shopDescription}
                  onChange={(e) => setShopDescription(e.target.value)}
                  placeholder="One-line description"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none"
                />
              </div>

              {/* Currency */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Currency
                </label>
                <select
                  value={shopCurrency}
                  onChange={(e) => setShopCurrency(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none"
                >
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="GBP">GBP (£)</option>
                  <option value="JPY">JPY (¥)</option>
                  <option value="SOL">SOL</option>
                  <option value="USDC">USDC</option>
                </select>
              </div>
            </div>
          </div>

          {/* Tip presets */}
          <div>
            <h2 className="mb-3 text-sm font-semibold text-gray-500 uppercase tracking-wide">
              Tip Presets
            </h2>
            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Preset percentages (comma-separated)
              </label>
              <input
                type="text"
                value={tipPresets}
                onChange={(e) => setTipPresets(e.target.value)}
                placeholder="0,10,15,20"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none"
              />
              <p className="mt-1 text-[11px] text-gray-400">
                Include 0 for a &ldquo;No tip&rdquo; option.
              </p>
            </div>
          </div>

          {/* Tax & Charity toggles */}
          <div>
            <h2 className="mb-3 text-sm font-semibold text-gray-500 uppercase tracking-wide">
              Tax & Charity
            </h2>
            <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-3">
              <label className="flex items-center justify-between">
                <div>
                  <span className="text-sm font-medium text-gray-900">
                    Tax Allocation
                  </span>
                  <p className="text-xs text-gray-400">
                    Add {TAX_RATE}% tax to transactions
                  </p>
                </div>
                <button
                  onClick={() => setTaxAllocationEnabled(!taxAllocationEnabled)}
                  className={`relative h-6 w-11 rounded-full transition-colors ${
                    taxAllocationEnabled ? 'bg-green-500' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                      taxAllocationEnabled ? 'translate-x-5.5' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </label>

              <label className="flex items-center justify-between">
                <div>
                  <span className="text-sm font-medium text-gray-900">
                    Charity Round-Up
                  </span>
                  <p className="text-xs text-gray-400">
                    Allow customers to round up for charity
                  </p>
                </div>
                <button
                  onClick={() => setCharityEnabled(!charityEnabled)}
                  className={`relative h-6 w-11 rounded-full transition-colors ${
                    charityEnabled ? 'bg-green-500' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                      charityEnabled ? 'translate-x-5.5' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </label>

              {charityEnabled && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Charity Partners (comma-separated)
                  </label>
                  <input
                    type="text"
                    value={charityPartners}
                    onChange={(e) => setCharityPartners(e.target.value)}
                    placeholder="GiveDirectly, Local Food Bank"
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Solana Wallet Configuration */}
          <div>
            <h2 className="mb-3 text-sm font-semibold text-gray-500 uppercase tracking-wide">
              Solana Wallets
            </h2>
            <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Merchant Wallet
                </label>
                <input
                  type="text"
                  value={merchantWallet}
                  onChange={(e) => setMerchantWallet(e.target.value)}
                  placeholder="Base58 Solana public key"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-xs font-mono text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Tax Wallet
                </label>
                <input
                  type="text"
                  value={taxWallet}
                  onChange={(e) => setTaxWallet(e.target.value)}
                  placeholder="Base58 Solana public key"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-xs font-mono text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Charity Wallet
                </label>
                <input
                  type="text"
                  value={charityWallet}
                  onChange={(e) => setCharityWallet(e.target.value)}
                  placeholder="Base58 Solana public key"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-xs font-mono text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    SPL Token Mint
                  </label>
                  <input
                    type="text"
                    value={splTokenMint}
                    onChange={(e) => setSplTokenMint(e.target.value)}
                    placeholder="Mint address"
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-xs font-mono text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Token Symbol
                  </label>
                  <input
                    type="text"
                    value={splTokenSymbol}
                    onChange={(e) => setSplTokenSymbol(e.target.value)}
                    placeholder="USDC"
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Read-only view */
        shop && (
          <div className="space-y-5">
            {/* Shop info summary */}
            <div>
              <h2 className="mb-3 text-sm font-semibold text-gray-500 uppercase tracking-wide">
                Shop Info
              </h2>
              <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-lg bg-gray-100">
                    {shop.photoUrl ? (
                      <img
                        src={shop.photoUrl}
                        alt={shop.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <Store className="h-6 w-6 text-gray-300" />
                    )}
                  </div>
                  <div>
                    <div className="text-base font-semibold text-gray-900">
                      {shop.name}
                    </div>
                    <div className="text-sm text-gray-400">@{shop.username}</div>
                    {shop.description && (
                      <div className="text-sm text-gray-500 mt-0.5">
                        {shop.description}
                      </div>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-gray-400">Currency:</span>{' '}
                    <span className="font-medium">{shop.currency ?? 'USD'}</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Tips:</span>{' '}
                    <span className="font-medium">
                      {shop.tipPresets.join('%, ')}%
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Tax & Charity status */}
            <div>
              <h2 className="mb-3 text-sm font-semibold text-gray-500 uppercase tracking-wide">
                Tax & Charity
              </h2>
              <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Tax Allocation</span>
                  <span
                    className={`font-medium ${
                      shop.taxAllocationEnabled
                        ? 'text-green-600'
                        : 'text-gray-400'
                    }`}
                  >
                    {shop.taxAllocationEnabled ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Charity Round-Up</span>
                  <span
                    className={`font-medium ${
                      shop.charityEnabled ? 'text-green-600' : 'text-gray-400'
                    }`}
                  >
                    {shop.charityEnabled ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
                {shop.charityEnabled && shop.charityPartners.length > 0 && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-400">Partners</span>
                    <span className="font-medium text-gray-700">
                      {shop.charityPartners.join(', ')}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Wallet config summary */}
            <div>
              <h2 className="mb-3 text-sm font-semibold text-gray-500 uppercase tracking-wide">
                Solana Wallets
              </h2>
              <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-2">
                {[
                  { label: 'Merchant', addr: shop.merchantWallet },
                  { label: 'Tax', addr: shop.taxWallet },
                  { label: 'Charity', addr: shop.charityWallet },
                ].map((w) => (
                  <div
                    key={w.label}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="text-gray-600">{w.label}</span>
                    {w.addr ? (
                      <span className="font-mono text-xs text-gray-700 truncate max-w-[180px]">
                        {w.addr}
                      </span>
                    ) : (
                      <span className="text-gray-400 italic">Not set</span>
                    )}
                  </div>
                ))}
                <div className="flex items-center justify-between text-sm pt-1 border-t border-gray-100">
                  <span className="text-gray-600">SPL Token</span>
                  {shop.splTokenMint ? (
                    <span className="font-mono text-xs text-gray-700 truncate max-w-[180px]">
                      {shop.splTokenMint}
                      {shop.splTokenSymbol && ` (${shop.splTokenSymbol})`}
                    </span>
                  ) : (
                    <span className="text-gray-400 italic">Not set</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        )
      )}

      {/* ----------------------------------------------------------------- */}
      {/* Data Management */}
      {/* ----------------------------------------------------------------- */}

      <div>
        <h2 className="mb-3 text-sm font-semibold text-gray-500 uppercase tracking-wide">
          Data Management
        </h2>
        <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-3">
          {/* Export */}
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-gray-900">
                Export Data
              </div>
              <p className="text-xs text-gray-400">
                Download all shop data as JSON
              </p>
            </div>
            <button
              onClick={handleExport}
              className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <Download className="h-4 w-4" />
              Export
            </button>
          </div>

          <div className="border-t border-gray-100" />

          {/* Import */}
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-gray-900">
                Import Data
              </div>
              <p className="text-xs text-gray-400">
                Restore from a JSON export
              </p>
            </div>
            <label className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 cursor-pointer transition-colors">
              <Upload className="h-4 w-4" />
              Import
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleImport}
                className="hidden"
              />
            </label>
          </div>

          {importMessage && (
            <div
              className={`flex items-center gap-1.5 text-xs ${
                importMessage.type === 'success'
                  ? 'text-green-600'
                  : 'text-red-600'
              }`}
            >
              {importMessage.type === 'success' ? (
                <CheckCircle2 className="h-3.5 w-3.5" />
              ) : (
                <AlertTriangle className="h-3.5 w-3.5" />
              )}
              {importMessage.text}
            </div>
          )}
        </div>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* Danger Zone */}
      {/* ----------------------------------------------------------------- */}

      <div>
        <h2 className="mb-3 text-sm font-semibold text-red-600 uppercase tracking-wide">
          Danger Zone
        </h2>
        <div className="rounded-lg border border-red-200 bg-red-50/30 p-4 space-y-3">
          <div>
            <div className="text-sm font-medium text-gray-900">
              Delete Shop
            </div>
            <p className="text-xs text-gray-500">
              Permanently delete this shop and all its items, orders, and
              expenses. This action cannot be undone.
            </p>
          </div>

          {!showDeleteConfirm ? (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="inline-flex items-center gap-1.5 rounded-md border border-red-300 bg-white px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
            >
              <Trash2 className="h-4 w-4" />
              Delete &ldquo;{shop?.name ?? 'Shop'}&rdquo;
            </button>
          ) : (
            <div className="space-y-3 rounded-md border border-red-300 bg-white p-3">
              <div className="flex items-center gap-2 text-sm text-red-700">
                <AlertTriangle className="h-4 w-4" />
                This will permanently delete the shop and ALL related data.
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Type &ldquo;{shop?.username ?? 'DELETE'}&rdquo; to confirm:
                </label>
                <input
                  type="text"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder={shop?.username ?? 'DELETE'}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-red-500 focus:ring-2 focus:ring-red-500/20 outline-none"
                />
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleDelete}
                  disabled={
                    deleting ||
                    deleteConfirmText.trim() !== (shop?.username ?? '')
                  }
                  className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {deleting ? 'Deleting…' : 'Yes, Delete Everything'}
                </button>
                <button
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setDeleteConfirmText('');
                  }}
                  className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer info */}
      <div className="text-center text-xs text-gray-300 pb-4">
        Microstore v0.1.0 · Data stored locally in your browser
      </div>
    </div>
  );
}
