// ---------------------------------------------------------------------------
// errorReporter.ts — batched error reporting with PII stripping
// ---------------------------------------------------------------------------
// When NEXT_PUBLIC_ERROR_REPORT_URL is configured, errors are POSTed in
// batches (debounced 5 s, max 10 per batch). When unset, errors stay local.
// Wallet addresses and other PII are stripped before reporting.

import type { ErrorLogEntry } from './errorLog';

const REPORT_URL =
  typeof process !== 'undefined' &&
  process.env.NEXT_PUBLIC_ERROR_REPORT_URL
    ? process.env.NEXT_PUBLIC_ERROR_REPORT_URL
    : '';

const DEBOUNCE_MS = 5000;
const MAX_BATCH_SIZE = 10;

// ---------------------------------------------------------------------------
// PII stripping
// ---------------------------------------------------------------------------

// Base58 Solana wallet address pattern (32–44 chars, base58 alphabet)
const WALLET_RE = /\b[1-9A-HJ-NP-Za-km-z]{32,44}\b/g;

// Generic hex address (Ethereum-style: 0x + 40 hex chars)
const HEX_ADDRESS_RE = /\b0x[a-fA-F0-9]{40}\b/g;

// Email pattern
const EMAIL_RE = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;

function stripPII(text: string): string {
  return text
    .replace(WALLET_RE, '[wallet-redacted]')
    .replace(HEX_ADDRESS_RE, '[address-redacted]')
    .replace(EMAIL_RE, '[email-redacted]');
}

function sanitizeEntry(entry: ErrorLogEntry): ErrorLogEntry {
  return {
    ...entry,
    message: stripPII(entry.message),
    stack: entry.stack ? stripPII(entry.stack) : undefined,
    componentStack: entry.componentStack
      ? stripPII(entry.componentStack)
      : undefined,
    url: stripPII(entry.url),
    context: entry.context ? sanitizeContext(entry.context) : undefined,
  };
}

function sanitizeContext(
  ctx: Record<string, unknown>,
): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(ctx)) {
    if (typeof value === 'string') {
      sanitized[key] = stripPII(value);
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeContext(value as Record<string, unknown>);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

// ---------------------------------------------------------------------------
// Batched reporting
// ---------------------------------------------------------------------------

let _queue: ErrorLogEntry[] = [];
let _timer: ReturnType<typeof setTimeout> | null = null;

function flush(): void {
  if (_queue.length === 0) return;

  const batch = _queue.splice(0, MAX_BATCH_SIZE);
  const sanitized = batch.map(sanitizeEntry);

  if (!REPORT_URL) return;

  // Fire-and-forget POST
  fetch(REPORT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      errors: sanitized,
      sentAt: new Date().toISOString(),
    }),
  }).catch(() => {
    // Silently ignore network failures — errors are still in local log
  });

  // If more remain, schedule another flush
  if (_queue.length > 0) {
    _timer = setTimeout(flush, DEBOUNCE_MS);
  }
}

/**
 * Queue an error for batched reporting. Called automatically by logError()
 * when the reporter is active. If an endpoint URL is configured, the error
 * will be POSTed after the debounce window. PII is stripped before sending.
 */
export function queueErrorForReport(entry: ErrorLogEntry): void {
  if (!REPORT_URL) return;

  _queue.push(entry);

  // Cap queue to prevent memory issues if endpoint is down
  if (_queue.length > 100) {
    _queue = _queue.slice(-100);
  }

  if (!_timer) {
    _timer = setTimeout(flush, DEBOUNCE_MS);
  }
}

/**
 * Check whether remote error reporting is configured.
 */
export function isReportingEnabled(): boolean {
  return REPORT_URL.length > 0;
}

/**
 * Immediately flush any queued errors. Useful before page unload.
 */
export function flushImmediately(): void {
  if (_timer) {
    clearTimeout(_timer);
    _timer = null;
  }
  flush();
}