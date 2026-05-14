'use client';

import { useState, useRef, useEffect, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Camera,
  Package,
  Wrench,
  X,
  Bold,
  Italic,
  List,
  Eye,
  AlertTriangle,
  Trash2,
} from 'lucide-react';
import { db } from '@/lib/db';
import { useItemEditorStore } from '@/lib/itemEditorStore';
import { useAppStore } from '@/lib/store';

export default function EditItemPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDescriptionEditor, setShowDescriptionEditor] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [notFound, setNotFound] = useState(false);

  const { activeShopId } = useAppStore();

  const {
    type, name, description, price, cost, sku, barcode,
    stock, lowStockThreshold, category, status, photoUrl,
    payUpfrontTemplate, listingRulesEnabled,
    setType, setName, setDescription, setPrice, setCost,
    setSku, setBarcode, setStock, setLowStockThreshold,
    setCategory, setStatus, setPhotoUrl,
    setPayUpfrontTemplate, setListingRulesEnabled,
    loadItem, reset,
  } = useItemEditorStore();

  // --- Load item on mount ----------------------------------------------------

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const { id } = await params;
      const itemId = parseInt(id, 10);
      if (isNaN(itemId)) {
        setNotFound(true);
        return;
      }

      const item = await db.items.get(itemId);
      if (!item || cancelled) {
        if (!cancelled) setNotFound(true);
        return;
      }

      loadItem(item);
      setLoaded(true);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [params, loadItem]);

  // --- Photo upload ----------------------------------------------------------

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (photoUrl) URL.revokeObjectURL(photoUrl);
    setPhotoUrl(URL.createObjectURL(file));
  };

  const handleRemovePhoto = () => {
    if (photoUrl) URL.revokeObjectURL(photoUrl);
    setPhotoUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // --- Rich text helpers -----------------------------------------------------

  function execFormat(cmd: string, value?: string) {
    document.execCommand(cmd, false, value);
    editorRef.current?.focus();
    syncDescriptionFromEditor();
  }

  function syncDescriptionFromEditor() {
    if (editorRef.current) {
      setDescription(editorRef.current.innerHTML);
    }
  }

  function insertPlaceholder() {
    if (!editorRef.current) return;
    editorRef.current.focus();
    if (!editorRef.current.textContent?.trim()) {
      editorRef.current.innerHTML = '';
    }
    document.execCommand('insertHTML', false, '&nbsp;');
    syncDescriptionFromEditor();
  }

  // --- Submit ----------------------------------------------------------------

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    const { id } = await params;
    const itemId = parseInt(id, 10);
    const trimmedName = name.trim();
    const priceVal = parseFloat(price);
    const stockVal = parseInt(stock, 10) || 0;
    const thresholdVal = lowStockThreshold ? parseInt(lowStockThreshold, 10) || 0 : undefined;
    const costVal = cost ? parseFloat(cost) || undefined : undefined;

    if (!trimmedName) {
      setError('Item name is required.');
      return;
    }
    if (isNaN(priceVal) || priceVal < 0) {
      setError('Enter a valid price.');
      return;
    }

    setSaving(true);
    try {
      await db.items.update(itemId, {
        type,
        name: trimmedName,
        description: description || undefined,
        price: priceVal,
        cost: costVal,
        sku: sku.trim() || undefined,
        barcode: barcode.trim() || undefined,
        stock: stockVal,
        lowStockThreshold: thresholdVal,
        category: category.trim() || undefined,
        status,
        photoUrl: photoUrl ?? undefined,
        payUpfrontTemplate:
          type === 'service' && payUpfrontTemplate.trim()
            ? payUpfrontTemplate.trim()
            : undefined,
        listingRules: { enabled: listingRulesEnabled },
        updatedAt: new Date(),
      });

      reset();
      router.push('/items');
    } catch (err) {
      setError('Failed to save item. Please try again.');
      console.error('Update item error:', err);
    } finally {
      setSaving(false);
    }
  };

  // --- Delete ----------------------------------------------------------------

  const handleDelete = async () => {
    const { id } = await params;
    const itemId = parseInt(id, 10);
    if (!confirm('Delete this item? This cannot be undone.')) return;

    setDeleting(true);
    setError(null);
    try {
      await db.items.delete(itemId);
      reset();
      router.push('/items');
    } catch (err) {
      setError('Failed to delete item.');
      console.error('Delete item error:', err);
      setDeleting(false);
    }
  };

  // --- Not found state -------------------------------------------------------

  if (notFound) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
          <Package className="h-8 w-8 text-gray-400" />
        </div>
        <h2 className="text-lg font-semibold text-gray-900">Item not found</h2>
        <p className="mt-1 text-sm text-gray-500">
          This item may have been deleted or doesn&apos;t exist.
        </p>
        <button
          type="button"
          onClick={() => router.push('/items')}
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 transition-colors"
        >
          Back to items
        </button>
      </div>
    );
  }

  if (!loaded) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-400">
        <Package className="mb-3 h-10 w-10 animate-pulse" />
        <p className="text-sm">Loading…</p>
      </div>
    );
  }

  // --- Render ----------------------------------------------------------------

  return (
    <form onSubmit={handleSubmit} className="flex flex-col min-h-[calc(100vh-8rem)]">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-full p-2 -ml-2 text-gray-500 hover:bg-gray-100 transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-900">Edit Item</h1>
          <p className="text-sm text-gray-500">
            {type === 'product' ? 'Product' : 'Service'} · {status === 'live' ? 'Live' : 'Draft'}
          </p>
        </div>
        <button
          type="button"
          onClick={handleDelete}
          disabled={deleting}
          className="rounded-full p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
          title="Delete item"
        >
          <Trash2 className="h-5 w-5" />
        </button>
      </div>

      {/* Error banner */}
      {error && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="flex-1 space-y-6">
        {/* Type toggle */}
        <div className="flex rounded-lg border border-gray-200 bg-gray-100 p-1">
          <button
            type="button"
            onClick={() => setType('product')}
            className={`flex flex-1 items-center justify-center gap-2 rounded-md py-2 text-sm font-medium transition-all ${
              type === 'product'
                ? 'bg-white text-blue-700 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Package className="h-4 w-4" />
            Product
          </button>
          <button
            type="button"
            onClick={() => setType('service')}
            className={`flex flex-1 items-center justify-center gap-2 rounded-md py-2 text-sm font-medium transition-all ${
              type === 'service'
                ? 'bg-white text-blue-700 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Wrench className="h-4 w-4" />
            Service
          </button>
        </div>

        {/* Photo Upload */}
        <div className="flex flex-col items-center gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className={`relative flex h-28 w-28 items-center justify-center overflow-hidden rounded-xl border-2 border-dashed transition-colors ${
              photoUrl
                ? 'border-blue-400'
                : 'border-gray-300 hover:border-blue-400 bg-gray-50'
            }`}
          >
            {photoUrl ? (
              <>
                <img
                  src={photoUrl}
                  alt="Item photo preview"
                  className="h-full w-full object-cover"
                />
                <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 hover:opacity-100 transition-opacity rounded-xl">
                  <Camera className="h-6 w-6 text-white" />
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center gap-1">
                <Camera className="h-8 w-8 text-gray-400" />
                <span className="text-xs text-gray-400">Add photo</span>
              </div>
            )}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handlePhotoUpload}
            className="hidden"
          />
          {photoUrl && (
            <button
              type="button"
              onClick={handleRemovePhoto}
              className="text-xs text-gray-500 hover:text-red-500 transition-colors"
            >
              Remove photo
            </button>
          )}
        </div>

        {/* Name */}
        <div>
          <label htmlFor="itemName" className="block text-sm font-medium text-gray-700 mb-1.5">
            Name
          </label>
          <input
            id="itemName"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={type === 'product' ? 'Organic coffee beans' : 'Guitar tuning service'}
            className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-colors"
            autoFocus
          />
        </div>

        {/* Description (rich text) */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-sm font-medium text-gray-700">Description</label>
            <button
              type="button"
              onClick={() => setShowDescriptionEditor((v) => !v)}
              className="text-xs text-blue-600 hover:text-blue-700"
            >
              {showDescriptionEditor ? 'Done' : 'Edit'}
            </button>
          </div>
          {showDescriptionEditor ? (
            <div className="rounded-lg border border-gray-300 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20 overflow-hidden transition-colors">
              <div className="flex items-center gap-0.5 border-b border-gray-200 bg-gray-50 px-2 py-1.5">
                <button
                  type="button"
                  onClick={() => execFormat('bold')}
                  className="rounded p-1.5 text-gray-600 hover:bg-gray-200 transition-colors"
                  title="Bold"
                >
                  <Bold className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => execFormat('italic')}
                  className="rounded p-1.5 text-gray-600 hover:bg-gray-200 transition-colors"
                  title="Italic"
                >
                  <Italic className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => execFormat('insertUnorderedList')}
                  className="rounded p-1.5 text-gray-600 hover:bg-gray-200 transition-colors"
                  title="Bullet list"
                >
                  <List className="h-3.5 w-3.5" />
                </button>
              </div>
              <div
                ref={editorRef}
                contentEditable
                suppressContentEditableWarning
                onInput={syncDescriptionFromEditor}
                onBlur={syncDescriptionFromEditor}
                onFocus={() => {
                  if (!editorRef.current?.textContent?.trim()) {
                    insertPlaceholder();
                  }
                }}
                className="min-h-[80px] px-4 py-2.5 text-sm text-gray-900 outline-none empty:before:text-gray-400 empty:before:content-[attr(data-placeholder)]"
                data-placeholder="Describe this item…"
                dangerouslySetInnerHTML={{ __html: description }}
              />
            </div>
          ) : description ? (
            <div
              className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-700 prose prose-sm max-w-none"
              dangerouslySetInnerHTML={{ __html: description }}
            />
          ) : (
            <div className="rounded-lg border border-dashed border-gray-300 px-4 py-2.5 text-sm text-gray-400 cursor-pointer hover:border-blue-400 transition-colors"
              onClick={() => setShowDescriptionEditor(true)}>
              Tap to add a description…
            </div>
          )}
        </div>

        {/* Price + Cost */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="itemPrice" className="block text-sm font-medium text-gray-700 mb-1.5">
              Price
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400 select-none">
                $
              </span>
              <input
                id="itemPrice"
                type="number"
                step="0.01"
                min="0"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="0.00"
                className="w-full rounded-lg border border-gray-300 pl-7 pr-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-colors"
              />
            </div>
          </div>
          <div>
            <label htmlFor="itemCost" className="block text-sm font-medium text-gray-700 mb-1.5">
              Cost <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400 select-none">
                $
              </span>
              <input
                id="itemCost"
                type="number"
                step="0.01"
                min="0"
                value={cost}
                onChange={(e) => setCost(e.target.value)}
                placeholder="0.00"
                className="w-full rounded-lg border border-gray-300 pl-7 pr-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-colors"
              />
            </div>
          </div>
        </div>

        {/* SKU + Barcode */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="itemSku" className="block text-sm font-medium text-gray-700 mb-1.5">
              SKU
            </label>
            <input
              id="itemSku"
              type="text"
              value={sku}
              onChange={(e) => setSku(e.target.value)}
              placeholder="ABC-123"
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-colors"
            />
          </div>
          <div>
            <label htmlFor="itemBarcode" className="block text-sm font-medium text-gray-700 mb-1.5">
              Barcode
            </label>
            <input
              id="itemBarcode"
              type="text"
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              placeholder="123456789"
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-colors"
            />
          </div>
        </div>

        {/* Stock (products only) */}
        {type === 'product' && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="itemStock" className="block text-sm font-medium text-gray-700 mb-1.5">
                Stock count
              </label>
              <input
                id="itemStock"
                type="number"
                min="0"
                step="1"
                value={stock}
                onChange={(e) => setStock(e.target.value)}
                placeholder="0"
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-colors"
              />
            </div>
            <div>
              <label htmlFor="itemThreshold" className="block text-sm font-medium text-gray-700 mb-1.5">
                Low-stock warning
              </label>
              <div className="relative">
                <input
                  id="itemThreshold"
                  type="number"
                  min="0"
                  step="1"
                  value={lowStockThreshold}
                  onChange={(e) => setLowStockThreshold(e.target.value)}
                  placeholder="5"
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-colors"
                />
                {lowStockThreshold && parseInt(stock, 10) <= parseInt(lowStockThreshold, 10) && (
                  <AlertTriangle className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-amber-500" />
                )}
              </div>
            </div>
          </div>
        )}

        {/* Category */}
        <div>
          <label htmlFor="itemCategory" className="block text-sm font-medium text-gray-700 mb-1.5">
            Category
          </label>
          <input
            id="itemCategory"
            type="text"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="Beverages, Electronics, Repair…"
            className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-colors"
          />
        </div>

        {/* Pay-upfront template (services only) */}
        {type === 'service' && (
          <div>
            <label
              htmlFor="itemPayUpfront"
              className="block text-sm font-medium text-gray-700 mb-1.5"
            >
              Pay-upfront template
            </label>
            <textarea
              id="itemPayUpfront"
              value={payUpfrontTemplate}
              onChange={(e) => setPayUpfrontTemplate(e.target.value)}
              placeholder="e.g. 'Pay what you think is fair' or 'Pay $20 now, balance on completion'"
              rows={3}
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-colors resize-none"
            />
            <p className="mt-1 text-xs text-gray-400">
              Displayed to customers at checkout. Leave empty to skip.
            </p>
          </div>
        )}

        {/* Listing rules (v1 — disabled) */}
        <div className="rounded-lg border border-gray-200 bg-gray-50/50 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100">
                <List className="h-4 w-4 text-gray-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-400">Listing rules</p>
                <p className="text-xs text-gray-400">Coming soon</p>
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={listingRulesEnabled}
              disabled
              className="relative inline-flex h-6 w-11 shrink-0 cursor-not-allowed rounded-full border-2 border-transparent bg-gray-200 opacity-50 transition-colors"
            >
              <span className="pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow ring-0 translate-x-0" />
            </button>
          </div>
        </div>

        {/* Status toggle */}
        <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-9 w-9 items-center justify-center rounded-full ${
                status === 'live' ? 'bg-green-50' : 'bg-amber-50'
              }`}
            >
              <Eye
                className={`h-5 w-5 ${
                  status === 'live' ? 'text-green-600' : 'text-amber-500'
                }`}
              />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">
                {status === 'live' ? 'Live' : 'Draft'}
              </p>
              <p className="text-xs text-gray-500">
                {status === 'live'
                  ? 'Visible to customers'
                  : 'Hidden until you publish'}
              </p>
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={status === 'live'}
            onClick={() => setStatus(status === 'live' ? 'draft' : 'live')}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none ${
              status === 'live' ? 'bg-blue-600' : 'bg-gray-200'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow ring-0 transition-transform ${
                status === 'live' ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* Delete button */}
        <button
          type="button"
          onClick={handleDelete}
          disabled={deleting}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-red-200 bg-white py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 transition-colors"
        >
          <Trash2 className="h-4 w-4" />
          {deleting ? 'Deleting…' : 'Delete item'}
        </button>
      </div>

      {/* Submit */}
      <div className="sticky bottom-20 -mx-4 bg-gray-50 px-4 py-4 border-t border-gray-100">
        <button
          type="submit"
          disabled={saving}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </form>
  );
}