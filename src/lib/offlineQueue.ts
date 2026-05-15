// Offline queue for POS order creation.
// Orders created while offline are queued and processed when connectivity returns.

import { db, type Order, type OfflineQueueEntry } from './db';
import { useEffect, useRef } from 'react';

// ---------------------------------------------------------------------------
// Check connectivity without importing JSX modules
// ---------------------------------------------------------------------------

function isOnline(): boolean {
  if (typeof navigator === 'undefined') return true;
  return navigator.onLine;
}

// ---------------------------------------------------------------------------
// Enqueue an order for later submission
// ---------------------------------------------------------------------------

export async function enqueueOrder(orderData: Omit<Order, 'id'>): Promise<number> {
  const queueId = await db.offlineQueue.add({
    shopId: orderData.shopId,
    orderData,
    createdAt: new Date(),
    attempts: 0,
    status: 'pending',
  });
  return queueId as number;
}

// ---------------------------------------------------------------------------
// Process the offline queue
// ---------------------------------------------------------------------------

export async function processOfflineQueue(): Promise<{ processed: number; failed: number }> {
  const pending = await db.offlineQueue
    .where('status')
    .anyOf('pending', 'failed')
    .filter((q) => q.attempts < 5)
    .toArray();

  if (pending.length === 0) return { processed: 0, failed: 0 };

  let processed = 0;
  let failed = 0;

  for (const entry of pending) {
    try {
      await db.offlineQueue.update(entry.id!, {
        status: 'processing',
        attempts: (entry.attempts || 0) + 1,
      });

      // The order was already written to db.orders by the POS page.
      // This queue entry exists for future server-side sync.
      // For now, clean up the queue entry.
      await db.offlineQueue.delete(entry.id!);
      processed++;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await db.offlineQueue.update(entry.id!, {
        status: 'failed',
        lastError: message,
      });
      failed++;
      console.error('[OfflineQueue] Failed to process entry', entry.id, message);
    }
  }

  return { processed, failed };
}

// ---------------------------------------------------------------------------
// Queue size query
// ---------------------------------------------------------------------------

export async function getQueueSize(): Promise<number> {
  return db.offlineQueue.where('status').equals('pending').count();
}

// ---------------------------------------------------------------------------
// useOfflineSync — hook that processes queue when connectivity returns
// ---------------------------------------------------------------------------

export function useOfflineSync() {
  const wasOffline = useRef(!isOnline());

  useEffect(() => {
    const goOnline = () => {
      if (wasOffline.current) {
        console.log('[OfflineSync] Back online — processing queue');
        processOfflineQueue().then(({ processed, failed }) => {
          if (processed > 0 || failed > 0) {
            console.log('[OfflineSync] Queue processed:', { processed, failed });
          }
        });
      }
      wasOffline.current = false;
    };

    const goOffline = () => {
      wasOffline.current = true;
    };

    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);

    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);
}
