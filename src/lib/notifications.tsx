'use client';

import { useEffect, useRef, useCallback } from 'react';
import { db, type Item, type Order } from '@/lib/db';
import { useAppStore } from '@/lib/store';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface NotificationState {
  lastOrderId: number | null;
  lastCheck: Date;
  notifiedLowStock: Set<number>; // item IDs already notified
}

// ---------------------------------------------------------------------------
// Request notification permission
// ---------------------------------------------------------------------------

export function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) {
    return Promise.resolve('denied');
  }

  if (Notification.permission === 'granted' || Notification.permission === 'denied') {
    return Promise.resolve(Notification.permission);
  }

  return Notification.requestPermission();
}

// ---------------------------------------------------------------------------
// Send a notification (if permission granted)
// ---------------------------------------------------------------------------

function sendNotification(title: string, options?: NotificationOptions): void {
  if (!('Notification' in window) || Notification.permission !== 'granted') {
    return;
  }

  try {
    new Notification(title, {
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      ...options,
    });
  } catch {
    // Notification API might throw if too many are queued
  }
}

// ---------------------------------------------------------------------------
// Notification Poller Component
// ---------------------------------------------------------------------------

/**
 * Mount this component once in the app layout. It polls Dexie periodically
 * for new orders and low-stock items, and sends browser notifications.
 *
 * Poll interval: 15 seconds (adjustable).
 * Cooldown: won't re-notify for the same low-stock item for 30 minutes.
 */

const POLL_INTERVAL_MS = 15_000;
const LOW_STOCK_COOLDOWN_MS = 30 * 60 * 1000; // 30 minutes

const state: NotificationState = {
  lastOrderId: null,
  lastCheck: new Date(0),
  notifiedLowStock: new Set(),
};

export function NotificationPoller() {
  const { activeShopId } = useAppStore();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const poll = useCallback(async () => {
    if (!activeShopId) return;

    try {
      // --- Check for new orders ---
      const latestOrder = await db.orders
        .where('shopId')
        .equals(activeShopId)
        .reverse()
        .first();

      if (latestOrder && latestOrder.id && latestOrder.id !== state.lastOrderId) {
        const isFirstCheck = state.lastOrderId === null;

        if (!isFirstCheck && state.lastOrderId !== null && latestOrder.id > state.lastOrderId) {
          // Find all new orders since last check
          const newOrders: Order[] = await db.orders
            .where('shopId')
            .equals(activeShopId)
            .filter((o) => o.id! > state.lastOrderId!)
            .toArray();

          if (newOrders.length > 0) {
            const totalNew = newOrders.reduce((sum, o) => sum + o.total, 0);
            const firstOrder = newOrders[0];

            sendNotification(
              `New Order${newOrders.length > 1 ? 's' : ''} Received`,
              {
                body:
                  newOrders.length === 1
                    ? `${firstOrder.customerName || 'Customer'} — $${firstOrder.total.toFixed(2)}`
                    : `${newOrders.length} new orders totalling $${totalNew.toFixed(2)}`,
                tag: 'new-order',
              },
            );
          }
        }

        state.lastOrderId = latestOrder.id;
      }

      // --- Check for low stock ---
      const now = Date.now();
      const items = await db.items
        .where('shopId')
        .equals(activeShopId)
        .filter(
          (i) =>
            i.type === 'product' &&
            i.status === 'live' &&
            i.lowStockThreshold != null &&
            i.lowStockThreshold > 0 &&
            i.stock <= i.lowStockThreshold &&
            i.stock >= 0,
        )
        .toArray();

      const newLowStock: Item[] = [];
      for (const item of items) {
        if (!state.notifiedLowStock.has(item.id!)) {
          newLowStock.push(item);
          state.notifiedLowStock.add(item.id!);
        }
      }

      if (newLowStock.length > 0) {
        const names = newLowStock.map((i) => i.name).join(', ');
        sendNotification('Low Stock Alert', {
          body:
            newLowStock.length === 1
              ? `${newLowStock[0].name} — ${newLowStock[0].stock} remaining`
              : `${newLowStock.length} items running low: ${names}`,
          tag: 'low-stock',
        });
      }

      // Clear cooldown for items that are now above threshold
      for (const itemId of state.notifiedLowStock) {
        const item = items.find((i) => i.id === itemId);
        if (!item) {
          state.notifiedLowStock.delete(itemId);
        }
      }

      state.lastCheck = new Date();
    } catch (err) {
      // Silently fail — IndexedDB may not be ready yet
      console.debug('Notification poll error:', err);
    }
  }, [activeShopId]);

  useEffect(() => {
    // Request permission on mount
    requestNotificationPermission();

    // Start polling
    poll(); // Initial check
    intervalRef.current = setInterval(poll, POLL_INTERVAL_MS);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [poll, activeShopId]);

  // This component renders nothing
  return null;
}
