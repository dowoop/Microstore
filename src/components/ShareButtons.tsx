'use client';

import { useState } from 'react';
import { Copy, Check, Share2, MessageCircle, Smartphone, Mail } from 'lucide-react';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isNativeShareSupported(): boolean {
  return typeof navigator !== 'undefined' && !!navigator.share;
}

function buildShareUrl(): string {
  if (typeof window !== 'undefined') return window.location.origin;
  return '';
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SharePayload {
  /** Relative URL path, e.g. `/pay?orderId=123` */
  paymentPath: string;
  /** Shop name for the share message */
  shopName: string;
  /** Order total for the share message */
  orderTotal: number;
  /** Currency symbol */
  currency?: string;
  /** Solana Pay CTA */
  paymentMethod?: string;
}

// ---------------------------------------------------------------------------
// Copy Link Button
// ---------------------------------------------------------------------------

function CopyLinkButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard unavailable — no feedback needed
    }
  };

  return (
    <button
      onClick={handleCopy}
      aria-label="Copy payment link"
      title="Copy link"
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50 transition-colors"
    >
      {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
    </button>
  );
}

// ---------------------------------------------------------------------------
// WhatsApp Button
// ---------------------------------------------------------------------------

function WhatsAppButton({ text }: { text: string }) {
  const encoded = encodeURIComponent(text);
  return (
    <a
      href={`https://wa.me/?text=${encoded}`}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Share via WhatsApp"
      title="Share via WhatsApp"
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 hover:border-green-300 hover:text-green-600 hover:bg-green-50 transition-colors"
    >
      <MessageCircle className="h-4 w-4" />
    </a>
  );
}

// ---------------------------------------------------------------------------
// SMS Button
// ---------------------------------------------------------------------------

function SMSButton({ text }: { text: string }) {
  const encoded = encodeURIComponent(text);
  return (
    <a
      href={`sms:?body=${encoded}`}
      aria-label="Share via SMS"
      title="Share via SMS / text message"
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 hover:border-amber-300 hover:text-amber-600 hover:bg-amber-50 transition-colors"
    >
      <Smartphone className="h-4 w-4" />
    </a>
  );
}

// ---------------------------------------------------------------------------
// Email Button
// ---------------------------------------------------------------------------

function EmailButton({ text, subject }: { text: string; subject: string }) {
  const encodedSubject = encodeURIComponent(subject);
  const encodedBody = encodeURIComponent(text);
  return (
    <a
      href={`mailto:?subject=${encodedSubject}&body=${encodedBody}`}
      aria-label="Share via Email"
      title="Share via Email"
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 hover:border-purple-300 hover:text-purple-600 hover:bg-purple-50 transition-colors"
    >
      <Mail className="h-4 w-4" />
    </a>
  );
}

// ---------------------------------------------------------------------------
// Native Web Share Button (mobile)
// ---------------------------------------------------------------------------

function WebShareButton({ text, title }: { text: string; title: string }) {
  const handleShare = async () => {
    try {
      await navigator.share({ title, text, url: text });
    } catch {
      // user cancelled or not supported — no feedback needed
    }
  };

  if (!isNativeShareSupported()) return null;

  return (
    <button
      onClick={handleShare}
      aria-label="Share via system menu"
      title="Share"
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50 transition-colors"
    >
      <Share2 className="h-4 w-4" />
    </button>
  );
}

// ---------------------------------------------------------------------------
// ShareButtons — full row of share actions
// ---------------------------------------------------------------------------

export function ShareButtons({ payload }: { payload: SharePayload }) {
  const origin = buildShareUrl();
  const fullUrl = `${origin}${payload.paymentPath}`;
  const currency = payload.currency ?? '$';
  const paymentMethod = payload.paymentMethod ?? 'Pay with Solana';

  const shareText = [
    `${payload.shopName} — ${paymentMethod}`,
    `Total: ${currency}${payload.orderTotal.toFixed(2)}`,
    '',
    fullUrl,
  ].join('\n');

  const subject = `Payment from ${payload.shopName} — ${currency}${payload.orderTotal.toFixed(2)}`;

  return (
    <div className="space-y-2">
      {/* Link display + copy */}
      <div className="flex items-center gap-2">
        <input
          type="text"
          readOnly
          value={fullUrl}
          className="flex-1 rounded-md border border-gray-300 bg-white px-2 py-1.5 text-xs text-gray-600 font-mono outline-none"
        />
        <CopyLinkButton text={fullUrl} />
      </div>

      {/* Share buttons row */}
      <div className="flex items-center gap-2">
        <WhatsAppButton text={shareText} />
        <SMSButton text={shareText} />
        <EmailButton text={shareText} subject={subject} />
        <WebShareButton text={shareText} title={`Payment from ${payload.shopName}`} />
      </div>

      <p className="text-[10px] text-gray-400">
        Share this link with your customer so they can pay from any device.
      </p>
    </div>
  );
}