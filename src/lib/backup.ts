import { db } from '@/lib/db';

const BACKUP_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours
const ORDER_BACKUP_INTERVAL = 10; // every Nth order
const LAST_BACKUP_KEY = 'microstore-last-backup';
const ORDER_COUNT_KEY = 'microstore-order-count-since-backup';

export async function triggerBackupIfNeeded(): Promise<void> {
  try {
    const now = Date.now();
    const lastBackup = parseInt(localStorage.getItem(LAST_BACKUP_KEY) || '0', 10);
    const orderCount = parseInt(localStorage.getItem(ORDER_COUNT_KEY) || '0', 10);

    const timeElapsed = now - lastBackup;
    const shouldBackup =
      timeElapsed > BACKUP_INTERVAL_MS || orderCount >= ORDER_BACKUP_INTERVAL;

    if (!shouldBackup) return;

    const shops = await db.shops.toArray();
    const items = await db.items.toArray();
    const orders = await db.orders.toArray();
    const expenses = await db.expenses.toArray();

    const backup = {
      version: 1,
      exportedAt: new Date().toISOString(),
      shops,
      items,
      orders,
      expenses,
    };

    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `microstore-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    localStorage.setItem(LAST_BACKUP_KEY, String(now));
    localStorage.setItem(ORDER_COUNT_KEY, '0');

    console.log('[Backup] Auto-backup saved successfully');
  } catch (err) {
    console.error('[Backup] Auto-backup failed:', err);
  }
}

export function incrementOrderCount(): void {
  try {
    const count = parseInt(localStorage.getItem(ORDER_COUNT_KEY) || '0', 10);
    localStorage.setItem(ORDER_COUNT_KEY, String(count + 1));
  } catch {
    /* ignore */
  }
}
