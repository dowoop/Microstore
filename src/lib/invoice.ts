import { db } from '@/lib/db';
import type { InvoiceType } from '@/lib/db';

/**
 * Generate the next auto-incrementing invoice number for a given shop.
 *
 * For POS orders, the invoice number is `currentHighest + 1`.
 * For invoice-type orders, the invoice number tracks separately (INV- prefix conceptually,
 * but stored as a number in the same sequence for simplicity).
 *
 * The invoice number is scoped per-shop — each shop has its own sequence.
 */
export async function generateInvoiceNumber(
  shopId: number,
  invoiceType: InvoiceType = 'pos',
): Promise<number> {
  const allOrders = await db.orders
    .where('shopId')
    .equals(shopId)
    .filter((o) => o.invoiceNumber !== undefined)
    .toArray();

  if (allOrders.length === 0) {
    return invoiceType === 'invoice' ? 1001 : 1;
  }

  const maxNum = Math.max(...allOrders.map((o) => o.invoiceNumber ?? 0));
  return maxNum + 1;
}

/**
 * Format an invoice number for display.
 * POS: "#1", "#2", ...
 * Invoice: "INV-1001", "INV-1002", ...
 */
export function formatInvoiceNumber(
  invoiceNumber: number,
  invoiceType: InvoiceType = 'pos',
): string {
  if (invoiceType === 'invoice') {
    return `INV-${invoiceNumber}`;
  }
  return `#${invoiceNumber}`;
}
