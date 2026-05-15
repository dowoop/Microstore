// ---------------------------------------------------------------------------
// Client-side error log — in-memory ring buffer (100) + IndexedDB persistence
// ---------------------------------------------------------------------------

import { db, type ErrorLogEntry } from '@/lib/db';
import { reportError } from '@/lib/errorReporter';

const MAX_ENTRIES = 100;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getEntryFromError(
  error: Error | unknown,
  context?: Record<string, unknown>,
): ErrorLogEntry {
  const err = error instanceof Error ? error : new Error(String(error));
  return {
    timestamp: new Date(),
    message: err.message || String(error),
    stack: err.stack,
    url:
      typeof window !== 'undefined'
        ? window.location?.href ?? ''
        : '',
    userAgent:
      typeof navigator !== 'undefined'
        ? navigator.userAgent ?? ''
        : '',
    context: context ? JSON.stringify(context) : undefined,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Log an error to IndexedDB and queue for remote reporting.
 */
export async function logError(
  error: Error | unknown,
  context?: Record<string, unknown>,
): Promise<void> {
  const entry = getEntryFromError(error, context);

  try {
    await db.errorLogs.add(entry);
  } catch {
    // IndexedDB unavailable — ignore
  }

  // Queue for remote reporting (no-ops if NEXT_PUBLIC_ERROR_REPORT_URL is unset)
  reportError(entry);

  // Prune to MAX_ENTRIES (oldest first)
  try {
    const count = await db.errorLogs.count();
    if (count > MAX_ENTRIES) {
      const toDelete = count - MAX_ENTRIES;
      const oldest = await db.errorLogs.orderBy('id').limit(toDelete).toArray();
      const ids = oldest.map((e) => e.id!).filter(Boolean);
      if (ids.length > 0) {
        await db.errorLogs.bulkDelete(ids);
      }
    }
  } catch {
    // Pruning failed — non-critical
  }
}

/**
 * Get the most recent errors from the log, newest-first.
 */
export async function getRecentErrors(
  limit: number = 50,
): Promise<ErrorLogEntry[]> {
  try {
    return await db.errorLogs
      .orderBy('id')
      .reverse()
      .limit(limit)
      .toArray();
  } catch {
    return [];
  }
}

/**
 * Clear all error log entries.
 */
export async function clearLog(): Promise<void> {
  try {
    await db.errorLogs.clear();
  } catch {
    // Ignore
  }
}