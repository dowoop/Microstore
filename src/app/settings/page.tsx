'use client';

import { useState, useCallback, useRef } from 'react';
import Image from 'next/image';
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
  Bell,
  BellOff,
  Clock,
  Lock,
  ShieldCheck,
  EyeOff,
  KeyRound,
} from 'lucide-react';
import { db, markDbInitialized } from '@/lib/db';
import { usePhotoUrl } from '@/lib/usePhotoUrl';
import { useAppStore } from '@/lib/store';
import { MainnetConfirmModal, hasConfirmedMainnet } from '@/components/MainnetConfirmModal';
import type { SolanaCluster } from '@/lib/store';
import { useLowStockStore } from '@/lib/lowStockStore';
import { useRouter } from 'next/navigation';
import { ErrorLogViewer } from '@/components/ErrorLogViewer';
import { US_TAX_REGIONS, CUSTOM_TAX_CODE, formatTaxRate } from '@/lib/taxRegions';
import { hashPin, verifyPin, isValidPin } from '@/lib/pinCrypto';
import { PinGate } from '@/components/PinGate';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Settings Page
// ---------------------------------------------------------------------------

export default function SettingsPage() {
  const { activeShopId, setActiveShopId } = useAppStore();
  const pinHash = useAppStore((s) => s.pinHash);
  const pinSalt = useAppStore((s) => s.pinSalt);
  const setPin = useAppStore((s) => s.setPin);
  const clearPin = useAppStore((s) => s.clearPin);
  const cashierMode = useAppStore((s) => s.cashierMode);
  const setCashierMode = useAppStore((s) => s.setCashierMode);
  const sessionUnlocked = useAppStore((s) => s.sessionUnlocked);
  const setSessionUnlocked = useAppStore((s) => s.setSessionUnlocked);
  const solanaCluster = useAppStore((s) => s.solanaCluster);
  const setSolanaCluster = useAppStore((s) => s.setSolanaCluster);
  const alertHistory = useLowStockStore((s) => s.alertHistory);
  const clearAlertHistory = useLowStockStore((s) => s.clearAlertHistory);
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Mainnet confirmation modal state
  const [showMainnetConfirm, setShowMainnetConfirm] = useState(false);
  const [pendingCluster, setPendingCluster] = useState<SolanaCluster | null>(null);

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
  const [shopPhotoUrl, setShopPhotoUrl] = useState<Blob | null>(null);
  const [shopCurrency, setShopCurrency] = useState('USD');
  const [tipPresets, setTipPresets] = useState('0,10,15,20');

  // Wallet config
  const [merchantWallet, setMerchantWallet] = useState('');
  const [taxSetAsideWallet, setTaxSetAsideWallet] = useState('');
  const [charityWallet, setCharityWallet] = useState('');
  const [splTokenMint, setSplTokenMint] = useState('');
  const [splTokenSymbol, setSplTokenSymbol] = useState('');

  // Tari wallet config
  const [tariWallet, setTariWallet] = useState('');
  const [tariNetwork, setTariNetwork] = useState('igor');
  const [tariAcceptedTokens, setTariAcceptedTokens] = useState('');

  // Toggles
  const [taxEnabled, setTaxEnabled] = useState(true);
  const [taxRate, setTaxRate] = useState(0);
  const [taxRegion, setTaxRegion] = useState('');
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

  // PIN setup state
  const [pinSetupOpen, setPinSetupOpen] = useState(false);
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinSetupError, setPinSetupError] = useState<string | null>(null);
  const [pinSetupSuccess, setPinSetupSuccess] = useState(false);
  const [changingPin, setChangingPin] = useState(false);
  const [currentPinForChange, setCurrentPinForChange] = useState('');

  // Import state
  const [importMessage, setImportMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // -----------------------------------------------------------------------
  // Solana cluster switching with mainnet confirmation
  // -----------------------------------------------------------------------

  const handleClusterChange = (cluster: SolanaCluster) => {
    if (cluster === 'mainnet-beta' && !hasConfirmedMainnet()) {
      setPendingCluster(cluster);
      setShowMainnetConfirm(true);
      return;
    }
    setSolanaCluster(cluster);
  };

  const handleMainnetConfirm = () => {
    if (pendingCluster) {
      setSolanaCluster(pendingCluster);
    }
    setShowMainnetConfirm(false);
    setPendingCluster(null);
  };

  const handleMainnetCancel = () => {
    setShowMainnetConfirm(false);
    setPendingCluster(null);
  };

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
    setShopPhotoUrl(shop.photoUrl ?? null);
    setShopCurrency(shop.currency ?? 'USD');
    setTipPresets(shop.tipPresets.join(','));
    setMerchantWallet(shop.merchantWallet ?? '');
    setTaxSetAsideWallet(shop.taxSetAsideWallet ?? '');
    setCharityWallet(shop.charityWallet ?? '');
    setSplTokenMint(shop.splTokenMint ?? '');
    setSplTokenSymbol(shop.splTokenSymbol ?? '');
    setTariWallet(shop.tariWallet ?? '');
    setTariNetwork(shop.tariNetwork ?? 'igor');
    setTariAcceptedTokens((shop.tariAcceptedTokens ?? []).join(', '));
    setTaxEnabled(shop.taxEnabled);
    setTaxRate(shop.taxRate ?? 0);
    setTaxRegion(shop.taxRegion ?? '');
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
    setShopPhotoUrl(file);
  };

  const clearPhoto = () => {
    setShopPhotoUrl(null);
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
        taxSetAsideWallet: taxSetAsideWallet.trim() || undefined,
        charityWallet: charityWallet.trim() || undefined,
        splTokenMint: splTokenMint.trim() || undefined,
        splTokenSymbol: splTokenSymbol.trim() || undefined,
        tariWallet: tariWallet.trim() || undefined,
        tariNetwork: (tariNetwork || 'igor') as 'igor' | 'mainnet',
        tariAcceptedTokens: tariAcceptedTokens
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean)
          .map((symbol) => ({ symbol })),
        taxEnabled,
        taxRate: taxEnabled ? taxRate : 0,
        taxRegion: taxEnabled ? taxRegion || undefined : undefined,
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
          createdAt: o.createdAt instanceof Date ? o.createdAt.toISOString() : o.createdAt,
          updatedAt: o.updatedAt instanceof Date ? o.updatedAt.toISOString() : o.updatedAt,
        })),
        expenses: expenses.map((e) => ({
          ...e,
          date: e.date instanceof Date ? e.date.toISOString() : e.date,
          createdAt: e.createdAt instanceof Date ? e.createdAt.toISOString() : e.createdAt,
        })),
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `microstore-${shop.username}-${new Date().toISOString().slice(0, 10)}.json`;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      // Delay revocation so the browser can start the download before the
      // blob URL is released. Calling revokeObjectURL synchronously after
      // a.click() is a race condition — the download event is scheduled
      // asynchronously and often loses the race.
      setTimeout(() => URL.revokeObjectURL(url), 100);

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

      if (
        !confirm(
          `Import "${data.shop.name}"? This will create a new shop with all its data. Existing data will not be overwritten.`,
        )
      ) {
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
                  <div className="relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-lg bg-gray-100">
                    <ShopPhoto blob={s.photoUrl} alt={s.name} />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-gray-900">{s.name}</div>
                    <div className="text-xs text-gray-500">@{s.username}</div>
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
              Import a previously exported Microstore JSON file to restore a shop and all its data.
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
                  importMessage.type === 'success' ? 'text-green-600' : 'text-red-600'
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
          <div className="flex flex-col items-center justify-center py-16 text-gray-500">
            <Store className="mb-3 h-10 w-10" />
            <p className="text-sm font-medium">No shops yet</p>
            <p className="mt-1 text-xs">Create a shop first to access settings.</p>
          </div>
        )}
      </div>
    );
  }

  // -----------------------------------------------------------------------
  // Main render (with active shop)
  // -----------------------------------------------------------------------

  return (
    <>
      {/* PIN gate: protect settings when PIN is set and session not unlocked */}
      <PinGate />

      {/* Only render content if no PIN or session is unlocked */}
      {(!pinHash || sessionUnlocked) && (
        <div className="flex flex-col gap-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-gray-900">Settings</h1>
              <p className="text-sm text-gray-500">{shop?.name ?? `Shop #${activeShopId}`}</p>
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
              role="alert"
              aria-live="polite"
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
                    <label className="block text-xs font-medium text-gray-600 mb-1">Photo</label>
                    <div className="flex items-center gap-3">
                      <div className="relative flex h-16 w-16 items-center justify-center overflow-hidden rounded-lg bg-gray-100">
                        {shopPhotoUrl ? (
                          <Image
                            // eslint-disable-next-line react-hooks/rules-of-hooks
                            src={usePhotoUrl(shopPhotoUrl)!}
                            alt="Shop"
                            fill
                            sizes="96px"
                            className="object-cover"
                            unoptimized
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
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">
                        @
                      </span>
                      <input
                        type="text"
                        value={shopUsername}
                        onChange={(e) => setShopUsername(e.target.value.replace(/^@/, ''))}
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
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none"
                    />
                  </div>

                  {/* Currency */}
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Currency</label>
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
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none"
                  />
                  <p className="mt-1 text-[11px] text-gray-500">
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
                      <span className="text-sm font-medium text-gray-900">Tax</span>
                      <p className="text-xs text-gray-500">
                        {taxEnabled && taxRate > 0
                          ? `Add ${formatTaxRate(taxRate)} tax to transactions`
                          : 'Add tax to transactions'}
                      </p>
                    </div>
                    <button
                      onClick={() => setTaxEnabled(!taxEnabled)}
                      className={`relative h-6 w-11 rounded-full transition-colors ${
                        taxEnabled ? 'bg-green-500' : 'bg-gray-300'
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                          taxEnabled ? 'translate-x-5.5' : 'translate-x-0.5'
                        }`}
                      />
                    </button>
                  </label>

                  {taxEnabled && (
                    <div className="pt-1 space-y-3 border-t border-gray-100">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          Tax Region
                        </label>
                        <select
                          value={taxRegion}
                          onChange={(e) => {
                            const code = e.target.value;
                            if (code === CUSTOM_TAX_CODE) {
                              setTaxRegion(CUSTOM_TAX_CODE);
                            } else if (code === '') {
                              setTaxRegion('');
                              setTaxRate(0);
                            } else {
                              const region = US_TAX_REGIONS.find((r) => r.code === code);
                              if (region) {
                                setTaxRegion(code);
                                setTaxRate(region.rate);
                              }
                            }
                          }}
                          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none"
                        >
                          <option value="">Select a region…</option>
                          {US_TAX_REGIONS.map((r) => (
                            <option key={r.code} value={r.code}>
                              {r.name} ({r.code}) — {formatTaxRate(r.rate)}
                            </option>
                          ))}
                          <option value={CUSTOM_TAX_CODE}>Custom rate %</option>
                        </select>
                      </div>
                      {taxRegion === CUSTOM_TAX_CODE && (
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            Custom Tax Rate (%)
                          </label>
                          <input
                            type="number"
                            min="0"
                            max="50"
                            step="0.001"
                            value={taxRate === 0 ? '' : taxRate * 100}
                            onChange={(e) => {
                              const v = parseFloat(e.target.value);
                              if (!isNaN(v) && v >= 0 && v <= 50) {
                                setTaxRate(v / 100);
                              } else if (e.target.value === '') {
                                setTaxRate(0);
                              }
                            }}
                            placeholder="e.g. 8.875"
                            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none"
                          />
                        </div>
                      )}
                      {(!taxRegion || taxRate === 0) && (
                        <div className="rounded bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-700">
                          Tax is enabled but no region or rate is set. Please select a region or
                          enter a custom rate.
                        </div>
                      )}
                    </div>
                  )}

                  <label className="flex items-center justify-between">
                    <div>
                      <span className="text-sm font-medium text-gray-900">Charity Round-Up</span>
                      <p className="text-xs text-gray-500">
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
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none"
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
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-xs font-mono text-gray-900 placeholder:text-gray-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Tax Wallet
                    </label>
                    <input
                      type="text"
                      value={taxSetAsideWallet}
                      onChange={(e) => setTaxSetAsideWallet(e.target.value)}
                      placeholder="Base58 Solana public key"
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-xs font-mono text-gray-900 placeholder:text-gray-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none"
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
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-xs font-mono text-gray-900 placeholder:text-gray-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none"
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
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-xs font-mono text-gray-900 placeholder:text-gray-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none"
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
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Solana Cluster */}
              <div>
                <h2 className="mb-3 text-sm font-semibold text-gray-500 uppercase tracking-wide">
                  Solana Cluster
                </h2>
                <div className="rounded-lg border border-gray-200 bg-white p-4">
                  <select
                    value={solanaCluster}
                    onChange={(e) => handleClusterChange(e.target.value as SolanaCluster)}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none"
                  >
                    <option value="devnet">Devnet (Test Mode)</option>
                    <option value="mainnet-beta">Mainnet (Real SOL)</option>
                  </select>
                  <p className="mt-1 text-[11px] text-gray-500">
                    {solanaCluster === 'mainnet-beta'
                      ? 'Mainnet uses real SOL. Transactions are irreversible.'
                      : 'Devnet uses test SOL. No real value.'}
                  </p>
                </div>
              </div>

              {/* Tari Wallet Configuration */}
              <div>
                <h2 className="mb-3 text-sm font-semibold text-gray-500 uppercase tracking-wide">
                  Tari Wallet
                </h2>
                <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Tari Wallet (optional)
                    </label>
                    <input
                      type="text"
                      value={tariWallet}
                      onChange={(e) => setTariWallet(e.target.value)}
                      placeholder="Tari public key"
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-xs font-mono text-gray-900 placeholder:text-gray-500 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Network</label>
                    <select
                      value={tariNetwork}
                      onChange={(e) => setTariNetwork(e.target.value)}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none"
                    >
                      <option value="igor">Igor (Testnet)</option>
                      <option value="nextnet">NextNet</option>
                      <option value="mainnet">MainNet</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Accepted Tari Tokens (comma-separated)
                    </label>
                    <input
                      type="text"
                      value={tariAcceptedTokens}
                      onChange={(e) => setTariAcceptedTokens(e.target.value)}
                      placeholder="XTR, TARI"
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-500 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none"
                    />
                    <p className="mt-1 text-[11px] text-gray-500">
                      Leave empty to accept native TARI only.
                    </p>
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
                      <div className="relative flex h-14 w-14 items-center justify-center overflow-hidden rounded-lg bg-gray-100">
                        <ShopPhoto blob={shop.photoUrl} alt={shop.name} />
                      </div>
                      <div>
                        <div className="text-base font-semibold text-gray-900">{shop.name}</div>
                        <div className="text-sm text-gray-500">@{shop.username}</div>
                        {shop.description && (
                          <div className="text-sm text-gray-500 mt-0.5">{shop.description}</div>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-gray-500">Currency:</span>{' '}
                        <span className="font-medium">{shop.currency ?? 'USD'}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Tips:</span>{' '}
                        <span className="font-medium">{shop.tipPresets.join('%, ')}%</span>
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
                          shop.taxEnabled ? 'text-green-600' : 'text-gray-500'
                        }`}
                      >
                        {shop.taxEnabled ? 'Enabled' : 'Disabled'}
                      </span>
                    </div>
                    {shop.taxEnabled && (shop.taxRate ?? 0) > 0 && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">Tax Rate</span>
                        <span className="font-medium text-gray-900">
                          {formatTaxRate(shop.taxRate ?? 0)}
                          {shop.taxRegion && shop.taxRegion !== CUSTOM_TAX_CODE && (
                            <span className="ml-1 text-gray-500">({shop.taxRegion})</span>
                          )}
                        </span>
                      </div>
                    )}
                    {shop.taxEnabled && (!shop.taxRate || shop.taxRate === 0) && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">Tax Rate</span>
                        <span className="font-medium text-amber-600">Not set</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">Charity Round-Up</span>
                      <span
                        className={`font-medium ${
                          shop.charityEnabled ? 'text-green-600' : 'text-gray-500'
                        }`}
                      >
                        {shop.charityEnabled ? 'Enabled' : 'Disabled'}
                      </span>
                    </div>
                    {shop.charityEnabled && shop.charityPartners.length > 0 && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-500">Partners</span>
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
                      { label: 'Sales Tax', addr: shop.taxSetAsideWallet },
                      { label: 'Charity', addr: shop.charityWallet },
                    ].map((w) => (
                      <div key={w.label} className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">{w.label}</span>
                        {w.addr ? (
                          <span className="font-mono text-xs text-gray-700 truncate max-w-[180px]">
                            {w.addr}
                          </span>
                        ) : (
                          <span className="text-gray-500 italic">Not set</span>
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
                        <span className="text-gray-500 italic">Not set</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Solana Cluster summary */}
                <div>
                  <h2 className="mb-3 text-sm font-semibold text-gray-500 uppercase tracking-wide">
                    Solana Cluster
                  </h2>
                  <div className="rounded-lg border border-gray-200 bg-white p-4">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">Network</span>
                      <span
                        className={`font-medium ${
                          solanaCluster === 'mainnet-beta' ? 'text-green-600' : 'text-amber-600'
                        }`}
                      >
                        {solanaCluster === 'mainnet-beta' ? 'Mainnet' : 'Devnet'}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-gray-500">
                      {solanaCluster === 'mainnet-beta'
                        ? 'Using real SOL. Change in Edit mode.'
                        : 'Using test SOL. Change in Edit mode.'}
                    </p>
                  </div>
                </div>

                {/* Tari Wallet summary */}
                <div>
                  <h2 className="mb-3 text-sm font-semibold text-gray-500 uppercase tracking-wide">
                    Tari Wallet
                  </h2>
                  <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">Wallet</span>
                      {shop.tariWallet ? (
                        <span className="font-mono text-xs text-gray-700 truncate max-w-[180px]">
                          {shop.tariWallet}
                        </span>
                      ) : (
                        <span className="text-gray-500 italic">Not set</span>
                      )}
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">Network</span>
                      <span className="font-medium text-gray-700">
                        {shop.tariNetwork ?? 'igor'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm pt-1 border-t border-gray-100">
                      <span className="text-gray-600">Accepted Tokens</span>
                      {shop.tariAcceptedTokens && shop.tariAcceptedTokens.length > 0 ? (
                        <span className="text-xs text-gray-700">
                          {shop.tariAcceptedTokens.map((t) => t.symbol).join(', ')}
                        </span>
                      ) : (
                        <span className="text-gray-500 italic">Native TARI only</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          )}

          {/* ----------------------------------------------------------------- */}
          {/* PIN Security & Cashier Mode */}
          {/* ----------------------------------------------------------------- */}

          <div>
            <h2 className="mb-3 text-sm font-semibold text-gray-500 uppercase tracking-wide">
              PIN Security
            </h2>
            <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-4">
              {/* PIN status */}
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-gray-900">
                    {pinHash ? 'PIN is set' : 'No PIN set'}
                  </div>
                  <p className="text-xs text-gray-500">
                    {pinHash
                      ? 'Admin pages require PIN to access'
                      : 'Set a 4–6 digit PIN to lock admin settings'}
                  </p>
                </div>
                {pinHash ? (
                  <ShieldCheck className="h-5 w-5 text-green-500" />
                ) : (
                  <Lock className="h-5 w-5 text-gray-400" />
                )}
              </div>

              {/* PIN setup / change form */}
              {!pinSetupOpen && !pinHash && (
                <button
                  onClick={() => setPinSetupOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
                >
                  <KeyRound className="h-4 w-4" />
                  Set PIN
                </button>
              )}

              {!pinSetupOpen && pinHash && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setChangingPin(true);
                      setPinSetupOpen(true);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <KeyRound className="h-4 w-4" />
                    Change PIN
                  </button>
                  <button
                    onClick={() => {
                      if (confirm('Clear your PIN? Admin pages will no longer be protected.')) {
                        clearPin();
                      }
                    }}
                    className="inline-flex items-center gap-1.5 rounded-md border border-red-300 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                    Clear PIN
                  </button>
                </div>
              )}

              {/* PIN form */}
              {pinSetupOpen && (
                <div className="space-y-3 rounded-md border border-blue-200 bg-blue-50/50 p-3">
                  {changingPin && (
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Current PIN
                      </label>
                      <input
                        type="password"
                        inputMode="numeric"
                        autoComplete="current-password"
                        value={currentPinForChange}
                        onChange={(e) =>
                          setCurrentPinForChange(e.target.value.replace(/\D/g, '').slice(0, 6))
                        }
                        placeholder="Enter current PIN"
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none"
                      />
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        New PIN
                      </label>
                      <input
                        type="password"
                        inputMode="numeric"
                        autoComplete="new-password"
                        value={newPin}
                        onChange={(e) => {
                          const v = e.target.value.replace(/\D/g, '').slice(0, 6);
                          setNewPin(v);
                          setPinSetupError(null);
                          setPinSetupSuccess(false);
                        }}
                        placeholder="4–6 digits"
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Confirm PIN
                      </label>
                      <input
                        type="password"
                        inputMode="numeric"
                        autoComplete="new-password"
                        value={confirmPin}
                        onChange={(e) => {
                          const v = e.target.value.replace(/\D/g, '').slice(0, 6);
                          setConfirmPin(v);
                          setPinSetupError(null);
                          setPinSetupSuccess(false);
                        }}
                        placeholder="Repeat PIN"
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none"
                      />
                    </div>
                  </div>
                  {pinSetupError && <p className="text-xs text-red-600">{pinSetupError}</p>}
                  {pinSetupSuccess && (
                    <p className="text-xs text-green-600">PIN saved successfully.</p>
                  )}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={async () => {
                        if (!isValidPin(newPin)) {
                          setPinSetupError('PIN must be 4–6 digits');
                          return;
                        }
                        if (newPin !== confirmPin) {
                          setPinSetupError('PINs do not match');
                          return;
                        }
                        // If changing, verify current PIN
                        if (changingPin && pinHash && pinSalt) {
                          const currentValid = await verifyPin(
                            currentPinForChange,
                            pinHash,
                            pinSalt,
                          );
                          if (!currentValid) {
                            setPinSetupError('Current PIN is incorrect');
                            return;
                          }
                        }
                        const { hash, salt } = await hashPin(newPin);
                        setPin(hash, salt);
                        setPinSetupSuccess(true);
                        setNewPin('');
                        setConfirmPin('');
                        setCurrentPinForChange('');
                        setChangingPin(false);
                        setTimeout(() => {
                          setPinSetupOpen(false);
                          setPinSetupSuccess(false);
                        }, 1500);
                      }}
                      className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
                    >
                      Save PIN
                    </button>
                    <button
                      onClick={() => {
                        setPinSetupOpen(false);
                        setNewPin('');
                        setConfirmPin('');
                        setCurrentPinForChange('');
                        setChangingPin(false);
                        setPinSetupError(null);
                        setPinSetupSuccess(false);
                      }}
                      className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Cashier Mode */}
          <div>
            <h2 className="mb-3 text-sm font-semibold text-gray-500 uppercase tracking-wide">
              Cashier Mode
            </h2>
            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-gray-900">
                    {cashierMode ? 'Cashier mode is ON' : 'Cashier mode'}
                  </div>
                  <p className="text-xs text-gray-500">
                    {cashierMode
                      ? 'Only POS, Pay, and Orders are accessible'
                      : 'Restrict to POS + Pay + Orders only'}
                  </p>
                </div>
                <button
                  onClick={() => {
                    if (cashierMode) {
                      // Disabling cashier mode — requires PIN if set
                      if (pinHash) {
                        const entered = prompt('Enter PIN to exit cashier mode:');
                        if (!entered) return;
                        verifyPin(entered, pinHash, pinSalt!).then((valid) => {
                          if (valid) {
                            setCashierMode(false);
                          } else {
                            alert('Incorrect PIN');
                          }
                        });
                      } else {
                        setCashierMode(false);
                      }
                    } else {
                      setCashierMode(true);
                    }
                  }}
                  role="switch"
                  aria-checked={cashierMode}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                    cashierMode ? 'bg-orange-500' : 'bg-gray-200'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow ring-0 transition-transform ${
                      cashierMode ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>

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
                  <div className="text-sm font-medium text-gray-900">Export Data</div>
                  <p className="text-xs text-gray-500">Download all shop data as JSON</p>
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
                  <div className="text-sm font-medium text-gray-900">Import Data</div>
                  <p className="text-xs text-gray-500">Restore from a JSON export</p>
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
                    importMessage.type === 'success' ? 'text-green-600' : 'text-red-600'
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
          {/* Error Log */}
          {/* ----------------------------------------------------------------- */}

          <div>
            <ErrorLogViewer />
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
                <div className="text-sm font-medium text-gray-900">Delete Shop</div>
                <p className="text-xs text-gray-500">
                  Permanently delete this shop and all its items, orders, and expenses. This action
                  cannot be undone.
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
                      disabled={deleting || deleteConfirmText.trim() !== (shop?.username ?? '')}
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

          {/* Alert History */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
                Alert History
              </h2>
              {alertHistory.length > 0 && (
                <button
                  onClick={clearAlertHistory}
                  className="text-xs text-gray-500 hover:text-red-500 transition-colors"
                >
                  Clear
                </button>
              )}
            </div>
            {alertHistory.length === 0 ? (
              <div className="rounded-lg border border-gray-200 bg-white px-4 py-6 text-center">
                <Bell className="mx-auto h-6 w-6 text-gray-300 mb-2" />
                <p className="text-sm text-gray-500">No alerts yet</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  Low-stock alerts will appear here when triggered.
                </p>
              </div>
            ) : (
              <div className="space-y-1 max-h-60 overflow-y-auto">
                {[...alertHistory]
                  .reverse()
                  .slice(0, 50)
                  .map((alert, i) => (
                    <div
                      key={`${alert.itemId}-${alert.alertedAt.getTime()}-${i}`}
                      className="flex items-center gap-2 rounded-md border border-gray-100 bg-white px-3 py-2"
                    >
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {alert.itemName}
                        </p>
                        <p className="text-xs text-gray-500">
                          Stock: {alert.stock} · Threshold: {alert.threshold}
                        </p>
                      </div>
                      <span className="text-[10px] text-gray-400 shrink-0">
                        {alert.alertedAt.toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  ))}
              </div>
            )}
          </div>

          {/* Footer info */}
          <div className="text-center text-xs text-gray-300 pb-4">
            Microstore v0.1.0 · Data stored locally in your browser
          </div>
        </div>
      )}

      <MainnetConfirmModal
        open={showMainnetConfirm}
        onConfirm={handleMainnetConfirm}
        onCancel={handleMainnetCancel}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// Photo display — wraps usePhotoUrl hook for use in .map() callbacks
// ---------------------------------------------------------------------------

function ShopPhoto({
  blob,
  alt,
  sizes = '96px',
  className = 'object-cover',
}: {
  blob: Blob | null | undefined;
  alt: string;
  sizes?: string;
  className?: string;
}) {
  const photoUrl = usePhotoUrl(blob ?? null);
  if (!photoUrl) return <Store className="h-5 w-5 text-gray-500" />;
  return <Image src={photoUrl} alt={alt} fill sizes={sizes} className={className} unoptimized />;
}
