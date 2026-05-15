import { db } from '@/lib/db';
import type { InvoiceType } from '@/lib/db';

export async function generateInvoiceNumber(
  shopId: number,
  invoiceType: InvoiceType = 'pos',
): Promise<number> {
  const allOrders = await db.orders
    .where('shopId')
    .equals(shopId)
    .filter((o) => o.invoiceNumber !== undefined)
    .toArray();
  if (allOrders.length === 0) return invoiceType === 'invoice' ? 1001 : 1;
  return Math.max(...allOrders.map((o) => o.invoiceNumber ?? 0)) + 1;
}

export function formatInvoiceNumber(
  invoiceNumber: number,
  invoiceType: InvoiceType = 'pos',
): string {
  return invoiceType === 'invoice' ? `INV-${invoiceNumber}` : `#${invoiceNumber}`;
}
