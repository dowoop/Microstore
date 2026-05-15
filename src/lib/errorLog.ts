// ---------------------------------------------------------------------------
// errorLog.ts — IndexedDB-backed error log ring buffer
// ---------------------------------------------------------------------------
// Stores up to 100 recent errors in both an in-memory cache and IndexedDB.
// Shared by the error boundary, unhandled rejection handler, and
// ErrorLogViewer component.

import { queueErrorForReport } from './errorReporter';

const DB_NAME = 'MicrostoreErrorLog';
const DB_VERSION = 1;
const STORE_NAME = 'errors';
const MAX_ENTRIES = 100;

export interface ErrorLogEntry {
  id?: number;
  timestamp: number;
  message: string;
  stack?: string;
  componentStack?: string;
  url: string;
  userAgent: string;
  context?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// IndexedDB helpers
// ---------------------------------------------------------------------------

let _dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (_dbPromise) return _dbPromise;

  _dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB not available'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, {
          keyPath: 'id',
          autoIncrement: true,
        });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('IndexedDB blocked'));
  });

  return _dbPromise;
}

// ---------------------------------------------------------------------------
// In-memory ring buffer
// ---------------------------------------------------------------------------

let _cache: ErrorLogEntry[] = [];
let _cacheLoaded = false;

async function loadCache(): Promise<void> {
  if (_cacheLoaded) return;
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const index = store.index('timestamp');
    const entries: ErrorLogEntry[] = await new Promise((resolve, reject) => {
      const results: ErrorLogEntry[] = [];
      const cursorReq = index.openCursor(null, 'prev');
      cursorReq.onsuccess = () => {
        const cursor = cursorReq.result;
        if (cursor) {
          results.push(cursor.value);
          cursor.continue();
        } else {
          resolve(results);
        }
      };
      cursorReq.onerror = () => reject(cursorReq.error);
    });
    _cache = entries.slice(0, MAX_ENTRIES).reverse();
  } catch {
    // If IndexedDB fails, start with empty cache
    _cache = [];
  }
  _cacheLoaded = true;
}

// ---------------------------------------------------------------------------
// Enforce ring buffer limit (drop oldest entries)
// ---------------------------------------------------------------------------

async function enforceCap(): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const count = await new Promise<number>((resolve, reject) => {
      const req = store.count();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });

    if (count > MAX_ENTRIES) {
      const excess = count - MAX_ENTRIES;
      const index = store.index('timestamp');
      const keysToDelete: number[] = await new Promise((resolve, reject) => {
        const keys: number[] = [];
        const cursorReq = index.openKeyCursor(null, 'next');
        cursorReq.onsuccess = () => {
          const cursor = cursorReq.result;
          if (cursor && keys.length < excess) {
            keys.push(cursor.primaryKey as number);
            cursor.continue();
          } else {
            resolve(keys);
          }
        };
        cursorReq.onerror = () => reject(cursorReq.error);
      });

      for (const key of keysToDelete) {
        store.delete(key);
      }
    }

    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Silently ignore cleanup failures
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Log an error to both the in-memory ring buffer and IndexedDB.
 * Call from error boundaries, catch blocks, and unhandled rejection handlers.
 */
export async function logError(
  error: Error | unknown,
  context?: Record<string, unknown>,
): Promise<void> {
  await loadCache();

  const err =
    error instanceof Error
      ? error
      : new Error(typeof error === 'string' ? error : 'Unknown error');

  const entry: ErrorLogEntry = {
    timestamp: Date.now(),
    message: err.message || 'Unknown error',
    stack: err.stack,
    componentStack: (err as Error & { componentStack?: string }).componentStack,
    url:
      typeof window !== 'undefined'
        ? window.location.href
        : 'server',
    userAgent:
      typeof navigator !== 'undefined'
        ? navigator.userAgent
        : 'server',
    context,
  };

  // In-memory
  _cache.unshift(entry);
  if (_cache.length > MAX_ENTRIES) {
    _cache.length = MAX_ENTRIES;
  }

  // IndexedDB
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).add(entry);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // IndexedDB write failed; in-memory cache still has it
  }

  // Queue for remote reporting (no-op if not configured)
  try {
    queueErrorForReport(entry);
  } catch {
    // Reporter threw — don't let it break logging
  }

  // Trim async (don't block the caller)
  enforceCap().catch(() => {});
}

/**
 * Get recent errors, newest first.
 */
export async function getRecentErrors(
  limit = 50,
): Promise<ErrorLogEntry[]> {
  await loadCache();
  return _cache.slice(0, Math.min(limit, _cache.length));
}

/**
 * Clear all errors from both the in-memory cache and IndexedDB.
 */
export async function clearLog(): Promise<void> {
  _cache = [];
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).clear();
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Silently ignore
  }
}