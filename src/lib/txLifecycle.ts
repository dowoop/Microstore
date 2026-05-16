/**
 * Order transaction lifecycle statuses.
 * Mirrors the order state machine in the POS → pay → confirm flow.
 */
export type OrderStatus =
  | 'pending'        // Order created, not yet paid
  | 'confirming'     // Transaction submitted, awaiting confirmation
  | 'paid'           // Transaction confirmed on-chain
  | 'failed'         // Transaction failed or timed out
  | 'pending_review' // Requires manual review (e.g. timeout, unclear state)
  | 'cancelled';     // Order cancelled by merchant or customer
