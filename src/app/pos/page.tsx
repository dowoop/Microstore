'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Search,
  Plus,
  Minus,
  Trash2,
  ShoppingCart,
  QrCode,
  HandCoins,
  Heart,
  ShieldCheck,
  X,
  Package,
  Camera,
  AlertTriangle,
  ArrowRight,
  Copy,
  Check,
} from 'lucide-react';
import { db, type Item, type OrderItem } from '@/lib/db';
import { useAppStore } from '@/lib/store';
import { usePosCartStore } from '@/lib/posCartStore';
import { ConnectivityBadge, useConnectivity } from '@/lib/connectivity';
import { enqueueOrder } from '@/lib/offlineQueue';
import {
  computeAtomicSplit,
  createSolanaPayURL,
  generateQRCode,
  type SplitBreakdown,
} from '@/lib/solanaPay';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ViewMode = 'items' | 'cart';

// ---------------------------------------------------------------------------
// POS Page
// ---------------------------------------------------------------------------

export default function PosPage() {
  const { activeShopId } = useAppStore();
  const cart = usePosCartStore();
  const online = useConnectivity();
  const [viewMode, setViewMode] = useState<ViewMode>('items');
  const [search, setSearch] = useState('');
  const [qrDataURL, setQrDataURL] = useState<string | null>(null);
  const [qrPayURL, setQrPayURL] = useState<string | null>(null);
  const [splitPreview, setSplitPreview] = useState<SplitBreakdown | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [qrError, setQrError] = useState<string | null>(null);
  const [createdOrderId, setCreatedOrderId] = useState<number | null>(null);
  const [paymentLink, setPaymentLink] = useState<string | null>(null);

  // Load shop config
  const shop = useLiveQuery(
    () => (activeShopId ? db.shops.get(activeShopId) : undefined),
    [activeShopId],
  );

  // Sync shop taxAllocationEnabled into cart store
  useEffect(() => {
    usePosCartStore.getState().setTaxAllocationEnabled(shop?.taxAllocationEnabled ?? true);
  }, [shop?.taxAllocationEnabled]);

  // Sync shop charityEnabled into cart store
  useEffect(() => {
    usePosCartStore.getState().setCharityRoundUp(shop?.charityEnabled ?? false);
  }, [shop?.charityEnabled]);

  // Load items for this shop
  const items = useLiveQuery(
    () =>
      activeShopId
        ? db.items
            .where('shopId')
            .equals(activeShopId)
            .filter((i) => i.status === 'live')
            .toArray()
        : [],
    [activeShopId],
  );

  // Filter items by search
  const filteredItems = useMemo(() => {
    if (!items) return [];
    if (!search.trim()) return items;
    const q = search.toLowerCase();
    return items.filter(
      (item) =>
        item.name.toLowerCase().includes(q) ||
        item.category?.toLowerCase().includes(q) ||
        item.sku?.toLowerCase().includes(q),
    );
  }, [items, search]);

  // Cart computed values
  const subtotal = cart.subtotal();
  const tipAmount = cart.tipAmount();
  const taxAmount = cart.taxAmount();
  const charityAmount = cart.charityAmount();
  const total = cart.total();
  const cartCount = cart.items.reduce((sum, ci) => sum + ci.quantity, 0);

  // Merchant wallet config
  const hasWalletConfig = !!(shop?.merchantWallet && shop?.splTokenMint);

  // -----------------------------------------------------------------------
  // Generate QR
  // -----------------------------------------------------------------------

  const handleGenerateQR = useCallback(async () => {
    if (!shop || !hasWalletConfig) return;

    setQrLoading(true);
    setQrError(null);
    setCreatedOrderId(null);
    setPaymentLink(null);

    try {
      // Compute atomic split breakdown
      const split = computeAtomicSplit({
        subtotal,
        tipPercent: cart.selectedTipPercent,
        taxRate: cart.taxAllocationEnabled ? 0.08875 : 0,
        charityRoundUp: cart.charityRoundUp,
        merchantWallet: shop.merchantWallet!,
        taxWallet: shop.taxWallet ?? shop.merchantWallet!,
        charityWallet: shop.charityWallet ?? shop.merchantWallet!,
        charityPartners: shop.charityPartners ?? [],
      });

      setSplitPreview(split);

      // Build OrderItems from cart
      const orderItems: OrderItem[] = cart.items.map((ci) => ({
        itemId: ci.item.id,
        name: ci.item.name,
        price: ci.item.price,
        quantity: ci.quantity,
      }));

      // Create the Order in Dexie
      const now = new Date();
      const orderId = await db.orders.add({
        shopId: activeShopId!,
        status: 'pending',
        subtotal,
        tip: tipAmount,
        tipPercent: cart.selectedTipPercent,
        tax: taxAmount,
        charity: charityAmount,
        total,
        items: orderItems,
        merchantWallet: shop.merchantWallet!,
        taxWallet: shop.taxWallet ?? shop.merchantWallet!,
        charityWallet: shop.charityWallet ?? shop.merchantWallet!,
        splTokenMint: shop.splTokenMint,
        splTokenSymbol: shop.splTokenSymbol,
        paymentRef: `microshop:${shop.id}:${Date.now()}`,
        createdAt: now,
        updatedAt: now,
      });

      setCreatedOrderId(orderId as number);
      setPaymentLink(`/pay?orderId=${orderId}`);

      // If offline, queue the order for server sync when connectivity returns
      if (!online) {
        await enqueueOrder({
          shopId: activeShopId!,
          status: 'pending',
          subtotal,
          tip: tipAmount,
          tipPercent: cart.selectedTipPercent,
          tax: taxAmount,
          charity: charityAmount,
          total,
          items: orderItems,
          merchantWallet: shop.merchantWallet!,
          taxWallet: shop.taxWallet ?? shop.merchantWallet!,
          charityWallet: shop.charityWallet ?? shop.merchantWallet!,
          splTokenMint: shop.splTokenMint,
          splTokenSymbol: shop.splTokenSymbol,
          paymentRef: `microshop:${shop.id}:${Date.now()}`,
          createdAt: now,
          updatedAt: now,
        });
        console.log('[POS] Offline — order queued for sync, id:', orderId);
      }

      // Create Solana Pay URL for the full amount to merchant
      const payURL = createSolanaPayURL({
        recipient: shop.merchantWallet!,
        amount: total,
        splToken: shop.splTokenMint,
        label: shop.name,
        message: `Payment to ${shop.name} — ${cartCount} item(s)`,
        memo: `microshop:${shop.id}:${orderId}`,
      });

      // Generate QR code
      const qr = await generateQRCode(payURL, { width: 280 });
      setQrDataURL(qr);
      setQrPayURL(payURL);
    } catch (err) {
      console.error('QR generation error:', err);
      setQrError('Failed to generate payment QR. Check wallet configuration.');
    } finally {
      setQrLoading(false);
    }
  }, [
    shop,
    hasWalletConfig,
    subtotal,
    total,
    cartCount,
    cart.selectedTipPercent,
    cart.charityRoundUp,
    activeShopId,
    tipAmount,
    taxAmount,
    charityAmount,
    cart.items,
  ]);

  // -----------------------------------------------------------------------
  // Close QR modal
  // -----------------------------------------------------------------------

  const handleCloseQR = () => {
    setQrDataURL(null);
    setQrPayURL(null);
    setSplitPreview(null);
    setQrError(null);
    setCreatedOrderId(null);
    setPaymentLink(null);
  };

  // -----------------------------------------------------------------------
  // Item card renderer
  // -----------------------------------------------------------------------

  function renderItemCard(item: Item) {
    const inCart = cart.items.find((ci) => ci.item.id === item.id);
    const isLowStock =
      item.type === 'product' && item.lowStockThreshold && item.stock <= item.lowStockThreshold;

    return (
      <button
        key={item.id}
        onClick={() => cart.addItem(item)}
        className="relative flex flex-col items-center rounded-xl border border-gray-200 bg-white p-3 text-left shadow-sm hover:border-blue-300 hover:shadow-md transition-all active:scale-[0.98]"
      >
        {/* Photo */}
        <div className="mb-2 relative flex h-16 w-16 items-center justify-center overflow-hidden rounded-lg bg-gray-100">
          {item.photoUrl ? (
            <Image
              src={item.photoUrl}
              alt={item.name}
              fill
              sizes="96px"
              className="object-cover"
              unoptimized
            />
          ) : (
            <Camera className="h-6 w-6 text-gray-300" />
          )}
        </div>

        {/* Name */}
        <span className="line-clamp-2 text-center text-xs font-semibold text-gray-900 leading-tight">
          {item.name}
        </span>

        {/* Price */}
        <span className="mt-1 text-sm font-bold text-blue-600">${item.price.toFixed(2)}</span>

        {/* Low stock badge */}
        {isLowStock && (
          <span className="mt-1 inline-flex items-center gap-0.5 rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
            <AlertTriangle className="h-2.5 w-2.5" />
            {item.stock}
          </span>
        )}

        {/* In-cart indicator */}
        {inCart && (
          <span className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-[10px] font-bold text-white shadow-sm">
            {inCart.quantity}
          </span>
        )}
      </button>
    );
  }

  // -----------------------------------------------------------------------
  // Cart line item renderer
  // -----------------------------------------------------------------------

  function renderCartItem(ci: { item: Item; quantity: number }) {
    return (
      <div
        key={ci.item.id}
        className="flex items-center gap-3 rounded-lg border border-gray-100 bg-white p-2.5"
      >
        {/* Thumbnail */}
        <div className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md bg-gray-100">
          {ci.item.photoUrl ? (
            <Image
              src={ci.item.photoUrl}
              alt={ci.item.name}
              fill
              sizes="96px"
              className="object-cover"
              unoptimized
            />
          ) : (
            <Package className="h-5 w-5 text-gray-300" />
          )}
        </div>

        {/* Info */}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-gray-900">{ci.item.name}</p>
          <p className="text-xs text-gray-500">
            ${ci.item.price.toFixed(2)} × {ci.quantity}
          </p>
        </div>

        {/* Quantity controls */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => cart.updateQuantity(ci.item.id, ci.quantity - 1)}
            className="flex h-7 w-7 items-center justify-center rounded-md bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
          <span className="w-6 text-center text-sm font-semibold text-gray-900">{ci.quantity}</span>
          <button
            onClick={() => cart.updateQuantity(ci.item.id, ci.quantity + 1)}
            disabled={ci.item.type === 'product' && ci.quantity >= ci.item.stock}
            className="flex h-7 w-7 items-center justify-center rounded-md bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors disabled:opacity-40"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Line total + remove */}
        <div className="flex flex-col items-end gap-0.5">
          <span className="text-sm font-semibold text-gray-900">
            ${(ci.item.price * ci.quantity).toFixed(2)}
          </span>
          <button
            onClick={() => cart.removeItem(ci.item.id)}
            className="text-gray-500 hover:text-red-500 transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    );
  }

  // -----------------------------------------------------------------------
  // No shop selected
  // -----------------------------------------------------------------------

  if (!activeShopId) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-500">
        <ShoppingCart className="mb-3 h-10 w-10" />
        <p className="text-sm font-medium">No shop selected</p>
        <p className="mt-1 text-xs">Create or select a shop to start selling.</p>
      </div>
    );
  }

  // -----------------------------------------------------------------------
  // Main render
  // -----------------------------------------------------------------------

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">POS</h1>
          <p className="text-sm text-gray-500">{shop?.name ?? `Shop #${activeShopId}`}</p>
          <ConnectivityBadge />
        </div>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex rounded-lg border border-gray-300 bg-white p-0.5">
            <button
              onClick={() => setViewMode('items')}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                viewMode === 'items'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Items
            </button>
            <button
              onClick={() => setViewMode('cart')}
              className={`relative rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                viewMode === 'cart'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Cart
              {cartCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">
                  {cartCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Search (items view only) */}
      {viewMode === 'items' && (
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search items…"
            className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm text-gray-900 placeholder:text-gray-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-colors"
          />
        </div>
      )}

      {/* Items grid */}
      {viewMode === 'items' && (
        <div className="flex-1 overflow-y-auto pb-4">
          {!items ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-500">
              <Package className="mb-3 h-8 w-8 animate-pulse" />
              <p className="text-sm">Loading inventory…</p>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-500">
              <Package className="mb-3 h-8 w-8" />
              <p className="text-sm font-medium">No items found</p>
              <p className="mt-1 text-xs">
                {search ? 'Try a different search.' : 'Add items to your inventory first.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2">{filteredItems.map(renderItemCard)}</div>
          )}
        </div>
      )}

      {/* Cart view */}
      {viewMode === 'cart' && (
        <>
          {/* Cart items */}
          <div className="flex-1 overflow-y-auto space-y-2 pb-4">
            {cart.items.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-gray-500">
                <ShoppingCart className="mb-3 h-8 w-8" />
                <p className="text-sm font-medium">Cart is empty</p>
                <p className="mt-1 text-xs">Tap items to add them to the cart.</p>
              </div>
            ) : (
              cart.items.map(renderCartItem)
            )}
          </div>

          {/* Checkout panel */}
          {cart.items.length > 0 && (
            <div className="shrink-0 space-y-3 rounded-t-2xl border-t border-gray-200 bg-white pt-3 -mx-4 px-4 pb-4">
              {/* Totals */}
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between text-gray-600">
                  <span>Subtotal</span>
                  <span>${subtotal.toFixed(2)}</span>
                </div>

                {/* Tip selector */}
                {shop?.tipPresets && shop.tipPresets.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between text-gray-600">
                      <span className="inline-flex items-center gap-1">
                        <HandCoins className="h-3.5 w-3.5 text-amber-500" />
                        Tip
                      </span>
                      <div className="flex gap-1">
                        {shop.tipPresets.map((pct) => (
                          <button
                            key={pct}
                            onClick={() => cart.setSelectedTipPercent(pct)}
                            className={`rounded-full px-2 py-0.5 text-xs font-medium transition-colors ${
                              cart.selectedTipPercent === pct
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                          >
                            {pct === 0 ? 'None' : `${pct}%`}
                          </button>
                        ))}
                      </div>
                    </div>
                    {cart.selectedTipPercent > 0 && (
                      <div className="flex justify-between text-blue-600 text-xs pl-5">
                        <span>Tip ({cart.selectedTipPercent}%)</span>
                        <span>${tipAmount.toFixed(2)}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Tax */}
                {shop?.taxAllocationEnabled && (
                  <div className="flex justify-between text-gray-600">
                    <span className="inline-flex items-center gap-1">
                      <ShieldCheck className="h-3.5 w-3.5 text-green-500" />
                      Tax (8.875%)
                    </span>
                    <span>${taxAmount.toFixed(2)}</span>
                  </div>
                )}

                {/* Charity round-up */}
                {shop?.charityEnabled && (
                  <div className="flex items-center justify-between">
                    <button
                      onClick={() => cart.setCharityRoundUp(!cart.charityRoundUp)}
                      className={`inline-flex items-center gap-1 text-xs transition-colors ${
                        cart.charityRoundUp ? 'text-rose-600' : 'text-gray-500'
                      }`}
                    >
                      <Heart
                        className={`h-3.5 w-3.5 ${
                          cart.charityRoundUp ? 'fill-rose-400 text-rose-400' : ''
                        }`}
                      />
                      Round up for charity
                    </button>
                    {cart.charityRoundUp && (
                      <span className="text-xs font-medium text-rose-600">
                        +${charityAmount.toFixed(2)}
                      </span>
                    )}
                  </div>
                )}

                {/* Divider */}
                <div className="border-t border-gray-100 pt-1.5 mt-1.5" />

                {/* Total */}
                <div className="flex justify-between text-base font-bold text-gray-900">
                  <span>Total</span>
                  <span>${total.toFixed(2)}</span>
                </div>
              </div>

              {/* Generate QR button */}
              {!hasWalletConfig ? (
                <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-700">
                  Wallet not configured. Set up your merchant wallet, tax wallet, charity wallet,
                  and SPL token mint in Shop Settings to accept payments.
                </div>
              ) : (
                <button
                  onClick={handleGenerateQR}
                  disabled={qrLoading || total <= 0}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {qrLoading ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      Generating QR…
                    </>
                  ) : (
                    <>
                      <QrCode className="h-4 w-4" />
                      Generate Payment QR
                    </>
                  )}
                </button>
              )}
            </div>
          )}
        </>
      )}

      {/* ================================================================ */}
      {/* QR Code Modal */}
      {/* ================================================================ */}
      {qrDataURL && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4">
          <div className="relative w-full max-w-sm rounded-2xl bg-white shadow-2xl">
            {/* Close */}
            <button
              onClick={handleCloseQR}
              className="absolute top-3 right-3 flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="p-6 pt-12 text-center">
              <h2 className="text-lg font-bold text-gray-900">Scan to Pay</h2>
              <p className="mt-1 text-sm text-gray-500">
                Customer scans this QR with their Solana wallet
              </p>

              {/* QR Code */}
              <div className="mt-4 flex justify-center">
                <div className="overflow-hidden rounded-xl border-2 border-gray-200">
                  <Image
                    src={qrDataURL}
                    alt="Payment QR Code"
                    width={280}
                    height={280}
                    unoptimized
                  />
                </div>
              </div>

              {/* Atomic split preview */}
              {splitPreview && (
                <div className="mt-4 rounded-lg border border-blue-100 bg-blue-50 p-3 text-left">
                  <p className="text-xs font-semibold text-blue-800 mb-2">
                    ⚡ Atomic Split Preview
                  </p>
                  <div className="space-y-1.5 text-xs">
                    <SplitRow
                      label={splitPreview.merchant.label}
                      amount={splitPreview.merchant.amount}
                      address={splitPreview.merchant.address}
                      accent="text-blue-700"
                    />
                    {splitPreview.tax.amount > 0 && (
                      <SplitRow
                        label={splitPreview.tax.label}
                        amount={splitPreview.tax.amount}
                        address={splitPreview.tax.address}
                        accent="text-green-700"
                      />
                    )}
                    {splitPreview.charity.amount > 0 && (
                      <SplitRow
                        label={splitPreview.charity.label}
                        amount={splitPreview.charity.amount}
                        address={splitPreview.charity.address}
                        accent="text-rose-700"
                      />
                    )}
                  </div>
                  <p className="mt-2 text-[10px] text-blue-600/70">
                    {(() => {
                      const legCount =
                        1 +
                        (splitPreview.tax.amount > 0 ? 1 : 0) +
                        (splitPreview.charity.amount > 0 ? 1 : 0);
                      return `${legCount} transfer${legCount !== 1 ? 's' : ''} execute atomically in a single transaction.`;
                    })()}
                  </p>
                </div>
              )}

              {/* Total badge */}
              <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-gray-900 px-4 py-2">
                <span className="text-sm text-gray-500">{shop?.splTokenSymbol ?? 'SPL'}</span>
                <span className="text-lg font-bold text-white">${total.toFixed(2)}</span>
              </div>

              {paymentLink && (
                <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 p-3 text-left">
                  <p className="text-xs font-semibold text-gray-700 mb-1.5">
                    📱 Share payment link
                  </p>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={
                        typeof window !== 'undefined'
                          ? `${window.location.origin}${paymentLink}`
                          : paymentLink
                      }
                      className="flex-1 rounded-md border border-gray-300 bg-white px-2 py-1.5 text-xs text-gray-600 font-mono outline-none"
                    />
                    <CopyLinkButton
                      text={
                        typeof window !== 'undefined'
                          ? `${window.location.origin}${paymentLink}`
                          : paymentLink
                      }
                    />
                  </div>
                  <p className="mt-1.5 text-[10px] text-gray-500">
                    Or open{' '}
                    <Link
                      href={paymentLink}
                      className="text-blue-600 hover:text-blue-800 underline"
                    >
                      the payment page
                    </Link>{' '}
                    directly.
                  </p>
                </div>
              )}

              {/* Done button */}
              <button
                onClick={() => {
                  cart.clearCart();
                  handleCloseQR();
                  setViewMode('items');
                }}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-green-600 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-green-700 transition-colors"
              >
                <ArrowRight className="h-4 w-4" />
                Done — Clear Cart
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QR Error */}
      {qrError && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4">
          <div className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl text-center">
            <button
              onClick={handleCloseQR}
              className="absolute top-3 right-3 flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
            <X className="mx-auto mb-3 h-10 w-10 text-red-400" />
            <h2 className="text-lg font-bold text-gray-900">QR Error</h2>
            <p className="mt-1 text-sm text-gray-500">{qrError}</p>
            <button
              onClick={() => setQrError(null)}
              className="mt-4 w-full rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
            >
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helper: split breakdown row
// ---------------------------------------------------------------------------

function SplitRow({
  label,
  amount,
  address,
  accent,
}: {
  label: string;
  amount: number;
  address: string;
  accent: string;
}) {
  return (
    <div className={`flex items-center justify-between ${accent}`}>
      <span className="font-medium">{label}</span>
      <span className="tabular-nums">${amount.toFixed(2)}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helper: Copy link button
// ---------------------------------------------------------------------------

function CopyLinkButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <button
      onClick={handleCopy}
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors"
    >
      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
    </button>
  );
}
