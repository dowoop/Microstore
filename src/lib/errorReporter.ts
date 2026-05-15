// ---------------------------------------------------------------------------
// Error reporter — batched reporting to a configurable endpoint
// ---------------------------------------------------------------------------

import type { ErrorLogEntry } from '@/lib/db';

const REPORT_URL = process.env.NEXT_PUBLIC_ERROR_REPORT_URL ?? '';
const MAX_BATCH_SIZE = 10;
const DEBOUNCE_MS = 5000;

let batch: Omit<ErrorLogEntry, 'id'>[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;

function stripWalletAddresses(text: string): string {
  return text.replace(/\b[1-9A-HJ-NP-Za-km-z]{32,44}\b/g, '[REDACTED]');
}

function sanitizeEntry(entry: ErrorLogEntry): Omit<ErrorLogEntry, 'id'> {
  return {
    timestamp: entry.timestamp,
    message: stripWalletAddresses(entry.message),
    stack: entry.stack ? stripWalletAddresses(entry.stack) : undefined,
    componentStack: entry.componentStack,
    url: entry.url,
    userAgent: entry.userAgent,
    context: entry.context ? stripWalletAddresses(entry.context) : undefined,
  };
}

async function flush(): Promise<void> {
  timer = null;

  if (!REPORT_URL || batch.length === 0) {
    batch = [];
    return;
  }

  const toSend = batch.slice(0, MAX_BATCH_SIZE);
  batch = [];

  try {
    await fetch(REPORT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ errors: toSend.map(sanitizeEntry) }),
    });
  } catch {
    // Network error — silently ignore
  }
}

export function reportError(entry: ErrorLogEntry): void {
  if (!REPORT_URL) return;

  batch.push(entry);

  if (batch.length >= MAX_BATCH_SIZE) {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    void flush();
  } else if (timer === null) {
    timer = setTimeout(() => void flush(), DEBOUNCE_MS);
  }
}

export function flushPending(): void {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  void flush();
}