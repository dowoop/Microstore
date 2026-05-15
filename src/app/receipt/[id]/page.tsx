'use client';

import { useEffect, useState, use, useRef, useCallback } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Download,
  ExternalLink,
  FileText,
  HandCoins,
  Heart,
  Link2,
  Loader2,
  Package,
  Printer,
  Share2,
  ShieldCheck,
  ShoppingCart,
  Stamp,
  Store,
  Wallet,
  XCircle,
} from 'lucide-react';
import { db, type Order, type Shop } from '@/lib/db';
import { computeAtomicSplit, type SplitBreakdown } from '@/lib/solanaPay';
import { formatInvoiceNumber } from '@/lib/invoice';

// ---------------------------------------------------------------------------
// Receipt Page — printable receipt with PDF download, invoice features
// ---------------------------------------------------------------------------

export default function ReceiptPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const orderId = parseInt(id, 10);

  const [order, setOrder] = useState<Order | null>(null);
  const [shop, setShop] = useState<Shop | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedText, setCopiedText] = useState(false);
  const [pdfGenerating, setPdfGenerating] = useState(false);

  const receiptRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        if (isNaN(orderId) || orderId <= 0) {
          setError('Invalid order ID.');
          setLoading(false);
          return;
        }
        const o = await db.orders.get(orderId);
        if (!o) {
          if (!cancelled) setError(`Order #${orderId} not found.`);
          if (!cancelled) setLoading(false);
          return;
        }
        const s = await db.shops.get(o.shopId);
        if (!cancelled) setOrder(o);
        if (!cancelled) setShop(s ?? null);
      } catch (err) {
        console.error('Receipt load error:', err);
        if (!cancelled) setError('Failed to load receipt.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [orderId]);

  // -------- PDF generation (client-side via jsPDF + html2canvas) ----------
  const handleDownloadPDF = useCallback(async () => {
    if (!receiptRef.current) return;
    setPdfGenerating(true);
    try {
      const [jsPDFModule, html2canvasModule] = await Promise.all([
        import('jspdf'),
        import('html2canvas'),
      ]);
      const { jsPDF } = jsPDFModule;
      const html2canvas = html2canvasModule.default;

      const receiptEl = receiptRef.current;
      const canvas = await html2canvas(receiptEl, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
      const imgX = (pdfWidth - imgWidth * ratio) / 2;
      const imgY = 0;

      pdf.addImage(imgData, 'PNG', imgX, imgY, imgWidth * ratio, imgHeight * ratio);

      // Handle multi-page if receipt is very long
      const contentHeight = imgHeight * ratio;
      let remainingHeight = contentHeight;
      let page = 0;
      while (remainingHeight > pdfHeight) {
        remainingHeight -= pdfHeight;
        pdf.addPage();
        page++;
        pdf.addImage(imgData, 'PNG', imgX, -(pdfHeight * page), imgWidth * ratio, imgHeight * ratio);
      }

      const fileName = order
        ? `receipt-${formatInvoiceNumber(order.invoiceNumber ?? order.id, order.invoiceType ?? 'pos').replace(/[#]/g, '').replace(/\s+/g, '-')}.pdf`
        : 'receipt.pdf';
      pdf.save(fileName);
    } catch (err) {
      console.error('PDF generation error:', err);
      alert('Failed to generate PDF. Please try Print instead.');
    } finally {
      setPdfGenerating(false);
    }
  }, [order]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center text-gray-500">
        <Loader2 className="mb-4 h-10 w-10 animate-spin text-blue-500" />
        <p className="text-sm font-medium text-gray-500">Loading receipt…</p>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-50">
          <XCircle className="h-7 w-7 text-red-400" />
        </div>
        <h2 className="mt-4 text-lg font-bold text-gray-900">Receipt Not Found</h2>
        <p className="mt-1 text-sm text-gray-500">{error ?? 'Order not found.'}</p>
        <Link href="/orders" className="mt-4 inline-flex items-center gap-1 rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 transition-colors">
          <ArrowLeft className="h-4 w-4" />View Orders
        </Link>
      </div>
    );
  }

  const isPaid = order.status === 'paid';
  const isCancelled = order.status === 'cancelled';
  const networkFee = 0.001;
  const grandTotal = order.total + networkFee;
  const tokenSymbol = order.splTokenSymbol ?? shop?.splTokenSymbol ?? 'SPL';
  const itemCount = order.items.reduce((sum, oi) => sum + oi.quantity, 0);
  const invoiceLabel = formatInvoiceNumber(order.invoiceNumber ?? order.id, order.invoiceType ?? 'pos');

  const split: SplitBreakdown | null = isPaid
    ? computeAtomicSplit({
        subtotal: order.subtotal,
        tipPercent: order.tipPercent,
        taxRate: shop?.taxRate ?? 0,
        charityRoundUp: order.charity > 0,
        merchantWallet: order.merchantWallet ?? shop?.merchantWallet ?? '',
        taxWallet: order.taxWallet ?? shop?.taxWallet ?? '',
        charityWallet: order.charityWallet ?? shop?.charityWallet ?? '',
        charityPartners: shop?.charityPartners ?? [],
      })
    : null;

  const hasSplitSigs = !!(order.merchantTxSignature || order.taxTxSignature || order.charityTxSignature);

  const handleCopyUrl = () => {
    const url = `${window.location.origin}/receipt/${order.id}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedUrl(true); setTimeout(() => setCopiedUrl(false), 2000);
    }).catch(() => {});
  };

  const handleCopyText = () => {
    const lines = [
      `Receipt — ${shop?.name ?? `Shop #${order.shopId}`} — Order #${order.id}`,
      `Invoice: ${invoiceLabel}`,
      `Date: ${new Date(order.createdAt).toLocaleString()}`, `Status: ${order.status}`, '',
      '--- Items ---',
      ...order.items.map((oi) => `${oi.name} ×${oi.quantity} — $${(oi.price * oi.quantity).toFixed(2)}`), '',
      `Subtotal: $${order.subtotal.toFixed(2)}`,
      order.tip > 0 ? `Tip (${order.tipPercent}%): $${order.tip.toFixed(2)}` : null,
      order.tax > 0 ? `Tax: $${order.tax.toFixed(2)}` : null,
      order.charity > 0 ? `Donation: $${order.charity.toFixed(2)}` : null, '',
      `Total: $${order.total.toFixed(2)}`,
      order.txSignature ? `Tx: ${order.txSignature}` : null,
    ].filter(Boolean).join('\n');
    navigator.clipboard.writeText(lines).then(() => {
      setCopiedText(true); setTimeout(() => setCopiedText(false), 2000);
    }).catch(() => {});
  };

  return (
    <>
      <style>{`
        @media print {
          body > * { display: none !important; }
          body > .receipt-root { display: block !important; }
          .receipt-root * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          .receipt-root .no-print { display: none !important; }
          .receipt-root .receipt-card { border: 1px solid #000 !important; box-shadow: none !important; border-radius: 0 !important; }
          .receipt-root { margin: 0; padding: 20px; max-width: 100%; }
          @page { margin: 10mm; size: auto; }
          .paid-stamp { display: block !important; }
        }
      `}</style>

      <div className="receipt-root mx-auto max-w-md space-y-5 pb-8">
        <Link href="/orders" className="no-print inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-600 transition-colors">
          <ArrowLeft className="h-4 w-4" />Back to Orders
        </Link>

        {/* Header card */}
        <div className="receipt-card rounded-xl border border-gray-200 bg-white p-5 text-center relative overflow-hidden" ref={receiptRef}>
          {isPaid && (
            <div className="paid-stamp absolute -right-8 -top-2 rotate-12 opacity-[0.12] pointer-events-none select-none print:opacity-[0.10]">
              <div className="flex items-center gap-1 rounded-full border-[3px] border-green-600 px-5 py-2">
                <Stamp className="h-8 w-8 text-green-600" />
                <span className="text-2xl font-black text-green-600 tracking-widest uppercase">PAID</span>
              </div>
            </div>
          )}

          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gray-50">
            {isPaid ? <CheckCircle2 className="h-9 w-9 text-green-500" /> : isCancelled ? <XCircle className="h-9 w-9 text-red-400" /> : <Clock className="h-9 w-9 text-amber-400" />}
          </div>
          <h1 className="mt-3 text-xl font-bold text-gray-900">{isPaid ? 'Payment Receipt' : isCancelled ? 'Cancelled' : 'Pending Payment'}</h1>
          <div className="mt-2 space-y-1 text-sm text-gray-500">
            <p><span className="font-medium text-gray-700">{shop?.name ?? `Shop #${order.shopId}`}</span></p>
            <p>Order #{order.id} • {new Date(order.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
            <p><span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${isPaid ? 'bg-green-50 text-green-700' : isCancelled ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}`}>{isPaid ? 'Paid' : isCancelled ? 'Cancelled' : 'Pending'}</span></p>
          </div>

          {order.invoiceNumber !== undefined && (
            <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-blue-50 border border-blue-100 px-3 py-1 text-xs font-medium text-blue-700">
              <FileText className="h-3 w-3" />
              Invoice {invoiceLabel}
              {order.invoiceType === 'invoice' && (
                <span className="ml-1 rounded bg-blue-200 px-1.5 py-0.5 text-[10px] font-bold text-blue-800">INVOICE</span>
              )}
            </div>
          )}
        </div>

        {order.customerName && (
          <div className="receipt-card rounded-xl border border-gray-200 bg-white p-4">
            <h2 className="mb-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Customer</h2>
            <p className="text-sm font-medium text-gray-900">{order.customerName}</p>
            {order.customerPhone && <p className="text-sm text-gray-500">{order.customerPhone}</p>}
          </div>
        )}

        <div className="receipt-card rounded-xl border border-gray-200 bg-white p-4">
          <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-gray-700"><ShoppingCart className="h-4 w-4" />Itemized Cart</h2>
          <div className="space-y-2.5">
            {order.items.map((oi, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <div className="min-w-0 flex-1"><span className="text-gray-900">{oi.name}</span>{oi.quantity > 1 && <span className="ml-1.5 text-xs text-gray-500">×{oi.quantity}</span>}</div>
                <span className="ml-3 shrink-0 font-medium tabular-nums text-gray-900">${(oi.price * oi.quantity).toFixed(2)}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 border-t border-gray-100 pt-2 text-xs text-gray-500">{itemCount} item{itemCount !== 1 ? 's' : ''} total</div>
        </div>

        <div className="receipt-card rounded-xl border border-gray-200 bg-white p-4">
          <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-gray-700"><Store className="h-4 w-4" />Payment Breakdown</h2>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm text-gray-600"><span className="inline-flex items-center gap-1.5"><Package className="h-3.5 w-3.5 opacity-50" />Subtotal</span><span className="font-medium tabular-nums">${order.subtotal.toFixed(2)}</span></div>
            {order.tip > 0 && <div className="flex items-center justify-between text-sm text-amber-600"><span className="inline-flex items-center gap-1.5"><HandCoins className="h-3.5 w-3.5" />Tip ({order.tipPercent}%)</span><span className="font-medium tabular-nums">${order.tip.toFixed(2)}</span></div>}
            {order.tax > 0 && <div className="flex items-center justify-between text-sm text-green-600"><span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5" />Tax</span><span className="font-medium tabular-nums">${order.tax.toFixed(2)}</span></div>}
            {order.charity > 0 && <div className="flex items-center justify-between text-sm text-rose-600"><span className="inline-flex items-center gap-1.5"><Heart className="h-3.5 w-3.5" />Donation</span><span className="font-medium tabular-nums">${order.charity.toFixed(2)}</span></div>}
            {order.discount !== undefined && order.discount > 0 && <div className="flex items-center justify-between text-sm text-gray-500"><span>Discount</span><span className="font-medium tabular-nums">-${order.discount.toFixed(2)}</span></div>}
          </div>
          <div className="my-3 border-t border-gray-200" />
          <div className="flex items-center justify-between"><span className="text-base font-bold text-gray-900">Total</span><span className="text-lg font-bold tabular-nums text-gray-900">${order.total.toFixed(2)}</span></div>
          <div className="mt-2 flex items-center justify-between rounded-lg bg-gray-50 px-3 py-1.5 text-xs"><span className="inline-flex items-center gap-1 text-gray-500"><Clock className="h-3 w-3" />Network fee</span><span className="font-medium tabular-nums text-gray-600">~${networkFee.toFixed(3)}</span></div>
          <div className="mt-1.5 flex items-center justify-between rounded-lg bg-gray-900 px-3 py-2 text-xs"><span className="text-gray-500">{tokenSymbol} debited</span><span className="font-bold tabular-nums text-white">{tokenSymbol} {grandTotal.toFixed(2)}</span></div>
        </div>

        {isPaid && split && (
          <div className="receipt-card rounded-xl border border-gray-200 bg-white p-4">
            <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-gray-700"><Wallet className="h-4 w-4" />On-Chain Split</h2>
            <p className="mb-3 text-xs text-gray-500">Payment is atomically split into three on-chain transfers:</p>
            <SplitRow icon={<Store className="h-4 w-4 text-blue-500" />} label="Merchant + Tip" amount={split.merchant.amount} wallet={split.merchant.address} txSig={order.merchantTxSignature} highlight />
            {split.tax.amount > 0 && <SplitRow icon={<ShieldCheck className="h-4 w-4 text-green-500" />} label="Tax" amount={split.tax.amount} wallet={split.tax.address} txSig={order.taxTxSignature} />}
            {split.charity.amount > 0 && <SplitRow icon={<Heart className="h-4 w-4 text-rose-400" />} label={split.charity.label} amount={split.charity.amount} wallet={split.charity.address} txSig={order.charityTxSignature} />}
            <div className="mt-3 rounded-lg bg-blue-50 border border-blue-100 px-3 py-2 text-xs text-blue-700">All transfers execute atomically on Solana — they either all succeed or all fail together.</div>
          </div>
        )}

        {isPaid && (
          <div className="receipt-card rounded-xl border border-gray-200 bg-white p-4">
            <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-gray-700"><ExternalLink className="h-4 w-4" />On-Chain Verification</h2>
            {hasSplitSigs ? (
              <div className="space-y-2">
                {order.merchantTxSignature && <TxLink label="Merchant + Tip transfer" signature={order.merchantTxSignature} amount={order.subtotal + order.tip} />}
                {order.taxTxSignature && order.tax > 0 && <TxLink label="Tax transfer" signature={order.taxTxSignature} amount={order.tax} />}
                {order.charityTxSignature && order.charity > 0 && <TxLink label="Charity donation transfer" signature={order.charityTxSignature} amount={order.charity} />}
              </div>
            ) : order.txSignature ? <TxLink label="Transaction" signature={order.txSignature} amount={order.total} /> : <p className="text-xs text-gray-500">On-chain verification links will appear once the transaction confirms.</p>}
            <p className="mt-3 text-[10px] text-gray-500">Links open on Solscan (devnet). All transfers execute atomically — verified on the Solana blockchain.</p>
          </div>
        )}

        {order.invoiceType === 'invoice' && order.invoiceDueDate && (
          <div className="receipt-card rounded-xl border border-gray-200 bg-white p-4">
            <h2 className="mb-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Invoice Details</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Due Date</span>
                <span className="font-medium text-gray-900">{new Date(order.invoiceDueDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
              </div>
              {order.invoiceNotes && (
                <div className="rounded-lg bg-gray-50 p-2">
                  <p className="text-xs text-gray-500 font-medium mb-1">Notes</p>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{order.invoiceNotes}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {shop && (
          <div className="receipt-card rounded-xl border border-gray-200 bg-white p-4">
            <h2 className="mb-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Merchant</h2>
            <p className="text-sm font-medium text-gray-900">{shop.name}</p>
            {shop.email && <p className="text-xs text-gray-500">{shop.email}</p>}
            {shop.phone && <p className="text-xs text-gray-500">{shop.phone}</p>}
            {shop.address && <p className="text-xs text-gray-500">{shop.address}</p>}
          </div>
        )}

        <div className="no-print flex flex-wrap gap-2">
          <button onClick={() => window.print()} className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-gray-300 bg-white py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors min-w-[calc(50%-0.25rem)]"><Printer className="h-4 w-4" />Print</button>
          <button onClick={handleDownloadPDF} disabled={pdfGenerating} className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-green-300 bg-green-50 py-2.5 text-sm font-medium text-green-700 hover:bg-green-100 transition-colors disabled:opacity-60 min-w-[calc(50%-0.25rem)]">
            {pdfGenerating ? <><Loader2 className="h-4 w-4 animate-spin" />Generating…</> : <><Download className="h-4 w-4" />Download PDF</>}
          </button>
          <button onClick={handleCopyUrl} className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-blue-300 bg-blue-50 py-2.5 text-sm font-medium text-blue-700 hover:bg-blue-100 transition-colors">{copiedUrl ? <><CheckCircle2 className="h-4 w-4 text-green-500" />Copied!</> : <><Link2 className="h-4 w-4" />Copy URL</>}</button>
          <button onClick={handleCopyText} className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors">{copiedText ? <><CheckCircle2 className="h-4 w-4" />Copied!</> : <><Share2 className="h-4 w-4" />Copy Text</>}</button>
        </div>

        <div className="no-print text-center">
          <Link href="/" className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-600 transition-colors"><Store className="h-3 w-3" />Powered by Microstore</Link>
        </div>
      </div>
    </>
  );
}

function SplitRow({ icon, label, amount, wallet, txSig, highlight }: { icon: React.ReactNode; label: string; amount: number; wallet: string; txSig?: string; highlight?: boolean }) {
  const shortWallet = wallet.length > 8 ? `${wallet.slice(0, 4)}…${wallet.slice(-4)}` : wallet;
  return (
    <div className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 mb-2 ${highlight ? 'border-blue-200 bg-blue-50/50' : 'border-gray-100 bg-gray-50/50'}`}>
      <div className="shrink-0">{icon}</div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2"><span className="text-sm font-medium text-gray-900 truncate">{label}</span><span className="shrink-0 text-sm font-bold tabular-nums text-gray-900">${amount.toFixed(2)}</span></div>
        <div className="mt-0.5 flex items-center gap-1.5">
          <code className="text-[10px] text-gray-500 font-mono">{shortWallet}</code>
          {txSig && <a href={`https://solscan.io/tx/${txSig}?cluster=devnet`} target="_blank" rel="noopener noreferrer" className="text-[10px] text-blue-500 hover:text-blue-700 inline-flex items-center gap-0.5"><ExternalLink className="h-2.5 w-2.5" />View tx</a>}
        </div>
      </div>
    </div>
  );
}

function TxLink({ label, signature, amount }: { label: string; signature: string; amount: number }) {
  const cluster = 'devnet';
  const solscanURL = `https://solscan.io/tx/${signature}?cluster=${cluster}`;
  const shortSig = `${signature.slice(0, 6)}…${signature.slice(-4)}`;
  return (
    <a href={solscanURL} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-sm hover:bg-blue-50 hover:border-blue-200 transition-colors">
      <div className="min-w-0 flex-1"><p className="text-xs font-medium text-gray-700">{label}</p><p className="text-[10px] text-gray-500 font-mono">{shortSig}</p></div>
      <div className="ml-2 flex shrink-0 items-center gap-2"><span className="text-xs font-medium tabular-nums text-gray-600">${amount.toFixed(2)}</span><ExternalLink className="h-3.5 w-3.5 text-gray-500" /></div>
    </a>
  );
}
