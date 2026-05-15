import { create } from 'zustand';
import { db, type Order } from '@/lib/db';
import {
  computeAtomicSplit,
  type SplitBreakdown,
  findReferenceByAddress,
  generatePaymentReference,
  getConnection,
  getLatestBlockhash,
} from '@/lib/solanaPay';
import {
  TxMonitor,
  type MonitorState,
  type TxDetails,
  type AmountMismatch,
} from '@/lib/txMonitor';
import {
  TariConnection,
  createTariDeepLink,
  getTariNetworkConfig,
  type TariNetwork,
  type TariTransactionStatus,
} from '@/lib/tariPay';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PayErrorCode =
  | 'ORDER_NOT_FOUND'
  | 'SHOP_NOT_FOUND'
  | 'WALLET_REJECTED'
  | 'NETWORK_ERROR'
  | 'DB_LOAD_FAILED'
  | 'LINK_EXPIRED'
  | 'TX_FAILED'
  | 'TX_TIMEOUT'
  | 'WRONG_AMOUNT';

export interface PayError {
  code: PayErrorCode;
  message: string;
  userMessage: string;
}

export type PaymentChain = 'solana' | 'tari';

/**
 * Payment state machine — drives the UI on the /pay page.
 *
 *   awaiting_scan → broadcasting → confirming → finalized
 *                                    ↓
 *                             expired | failed | cancelled
 */
export type PayStateMachine =
  | 'awaiting_scan' // QR shown, waiting for customer to scan
  | 'broadcasting'  // tx detected on-chain, propagating
  | 'confirming'    // tx seen, awaiting finality
  | 'finalized'     // payment confirmed at 'finalized' commitment
  | 'expired'       // timeout — no tx within window
  | 'failed'        // tx reverted or errored
  | 'cancelled';    // merchant or customer cancelled

/** Map MonitorState → PayStateMachine for UI display. */
const monitorStateToPayState: Record<MonitorState, PayStateMachine> = {
  monitoring: 'awaiting_scan',
  confirming: 'confirming',
  confirmed: 'finalized',
  failed: 'failed',
  timeout: 'expired',
  wrong_amount: 'failed',
  error: 'failed',
};

export interface PayState {
  order: Order | null;
  shop: {
    name: string;
    merchantWallet: string;
    taxWallet: string;
    charityWallet: string;
    charityPartners: string[];
    splTokenSymbol: string;
    taxAllocationEnabled: boolean;
    charityEnabled: boolean;
    tariWallet?: string;
    tariNetwork?: TariNetwork;
  } | null;
  split: SplitBreakdown | null;
  networkFee: number;
  confirmState: MonitorState;
  /** The payment state machine state (derived from confirmState). */
  payState: PayStateMachine;
  txSignature: string | null;
  txBlockTime: number | null;
  amountMismatch: AmountMismatch | null;
  retryCount: number;
  loading: boolean;
  error: PayError | null;
  /** Which chain the payment is on — detected from order.shop.tariWallet. */
  paymentChain: PaymentChain;
  /** Tari deep link URL (set when chain is 'tari'). */
  tariDeepLink: string | null;
  /** Payment reference public key (base58) — used for on-chain discovery. */
  paymentRefPubkey: string | null;
  /** QR regeneration counter — max 3 per order. */
  regenerationCount: number;
  /** Current blockhash for the QR URL (null until first QR is generated). */
  currentBlockhash: string | null;
  /** Whether the QR is currently being regenerated. */
  regenerating: boolean;
  loadOrder: (orderId: number) => Promise<void>;
  reset: () => void;
  startConfirmation: () => void;
  stopConfirmation: () => void;
  retryConfirmation: () => void;
  markFinalized: (signature: string) => Promise<void>;
  /** Regenerate the QR with a fresh blockhash. Returns false if max regenerations reached. */
  regenerateQR: () => Promise<boolean>;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ESTIMATED_NETWORK_FEE_USD = 0.001;
const TARI_CONFIRMATION_POLL_MS = 3000;
const TARI_CONFIRMATION_TIMEOUT_MS = 120_000;
const SOLANA_POLL_INTERVAL_MS = 1000;
const SOLANA_TIMEOUT_MS = 120_000;
let loadRequestId = 0;

// ---------------------------------------------------------------------------
// Helper: convert USD to XTM (rough placeholder rate: 1 XTM = $0.10)
// ---------------------------------------------------------------------------

function usdToXtm(usdAmount: number): number {
  const XTM_PER_USD = 10; // 1 USD = 10 XTM (placeholder)
  return Math.round(usdAmount * XTM_PER_USD * 1_000_000) / 1_000_000;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const usePayStore = create<PayState>()((set, get) => {
  let txMonitor: TxMonitor | null = null;
  let refPollAbort: AbortController | null = null;
  let tariConnection: TariConnection | null = null;
  let tariPollTimer: ReturnType<typeof setInterval> | null = null;
  let tariTimeoutTimer: ReturnType<typeof setTimeout> | null = null;

  function clearTariTimers() {
    if (tariPollTimer !== null) {
      clearInterval(tariPollTimer);
      tariPollTimer = null;
    }
    if (tariTimeoutTimer !== null) {
      clearTimeout(tariTimeoutTimer);
      tariTimeoutTimer = null;
    }
  }

  function stopReferencePolling() {
    if (refPollAbort) {
      refPollAbort.abort();
      refPollAbort = null;
    }
  }

  return {
    order: null,
    shop: null,
    split: null,
    networkFee: ESTIMATED_NETWORK_FEE_USD,
    confirmState: 'monitoring' as MonitorState,
    payState: 'awaiting_scan' as PayStateMachine,
    txSignature: null,
    txBlockTime: null,
    amountMismatch: null,
    retryCount: 0,
    loading: false,
    error: null,
    paymentChain: 'solana',
    tariDeepLink: null,
    paymentRefPubkey: null,
    regenerationCount: 0,
    currentBlockhash: null,
    regenerating: false,

    loadOrder: async (orderId: number) => {
      const thisRequestId = ++loadRequestId;
      set({ loading: true, error: null, retryCount: 0, tariDeepLink: null, paymentRefPubkey: null, regenerationCount: 0, currentBlockhash: null });

      try {
        const order = await db.orders.get(orderId);
        if (thisRequestId !== loadRequestId) return;
        if (!order) {
          set({
            loading: false,
            error: {
              code: 'ORDER_NOT_FOUND',
              message: `Order #${orderId} not found in local database.`,
              userMessage:
                'This payment link has expired or the order was deleted. Please ask the merchant for a new payment link.',
            },
          });
          return;
        }

        const shopRecord = await db.shops.get(order.shopId);
        if (thisRequestId !== loadRequestId) return;
        if (!shopRecord) {
          set({
            loading: false,
            error: {
              code: 'SHOP_NOT_FOUND',
              message: `Shop for order #${orderId} not found.`,
              userMessage: 'The shop associated with this order no longer exists.',
            },
          });
          return;
        }

        const shop = {
          name: shopRecord.name,
          merchantWallet: order.merchantWallet ?? shopRecord.merchantWallet ?? '',
          taxWallet: order.taxWallet ?? shopRecord.taxWallet ?? shopRecord.merchantWallet ?? '',
          charityWallet:
            order.charityWallet ?? shopRecord.charityWallet ?? shopRecord.merchantWallet ?? '',
          charityPartners: shopRecord.charityPartners ?? [],
          splTokenSymbol: order.splTokenSymbol ?? shopRecord.splTokenSymbol ?? 'SPL',
          taxAllocationEnabled: shopRecord.taxAllocationEnabled,
          taxRate: shopRecord.taxRate,
          charityEnabled: shopRecord.charityEnabled,
          tariWallet: shopRecord.tariWallet,
          tariNetwork: shopRecord.tariNetwork,
        };

        // Check if the payment link has expired
        if (order.expiresAt && new Date() > new Date(order.expiresAt)) {
          set({
            loading: false,
            error: {
              code: 'LINK_EXPIRED',
              message: `Order #${orderId} payment link expired at ${order.expiresAt}`,
              userMessage:
                'This payment link has expired. Please ask the merchant for a new payment link.',
            },
          });
          return;
        }

        // Record that the customer viewed this payment link
        if (!order.viewedAt) {
          try {
            await db.orders.update(orderId, { viewedAt: new Date() });
          } catch {
            // best-effort; don't block on metadata write
          }
        }

        const split = computeAtomicSplit({
          subtotal: order.subtotal,
          tipPercent: order.tipPercent,
          taxRate: shop.taxRate ?? 0,
          charityRoundUp: order.charity > 0,
          merchantWallet: shop.merchantWallet,
          taxWallet: shop.taxWallet,
          charityWallet: shop.charityWallet,
          charityPartners: shop.charityPartners,
        });

        // Detect payment chain: use order.paymentChain if set, else infer from shop config
        const chain: PaymentChain = order.paymentChain ?? (shop.tariWallet ? 'tari' : 'solana');

        // Generate Tari deep link if chain is Tari
        let tariDeepLink: string | null = null;
        if (chain === 'tari' && shop.tariWallet) {
          const network = shop.tariNetwork ?? 'igor';
          const xtmAmount = usdToXtm(order.total + ESTIMATED_NETWORK_FEE_USD);
          const microTari = BigInt(Math.round(xtmAmount * 1_000_000));
          const tokenSymbol = order.tariTokenSymbol ?? 'XTM';
          tariDeepLink = createTariDeepLink({
            recipient: shop.tariWallet,
            amount: microTari,
            network,
            note: `Order #${orderId} - ${shop.name}`,
            label: shop.name,
            resourceAddress: order.tariTokenResourceAddress,
            divisibility: 6,
            tokenSymbol,
          });
        }

        // Generate payment reference keypair for Solana payments
        let paymentRefPubkey: string | null = null;
        if (chain === 'solana') {
          // Reuse existing paymentRef from order if present, else generate new
          if (order.paymentRef) {
            paymentRefPubkey = order.paymentRef;
          } else {
            const ref = generatePaymentReference();
            paymentRefPubkey = ref.publicKey;
            // Persist the reference public key to the order
            try {
              await db.orders.update(orderId, {
                paymentRef: paymentRefPubkey,
                updatedAt: new Date(),
              });
            } catch {
              // best-effort
            }
          }
        }

        set({
          order,
          shop,
          split,
          loading: false,
          paymentChain: chain,
          tariDeepLink,
          paymentRefPubkey,
        });
      } catch (err) {
        console.error('Pay store loadOrder error:', err);
        set({
          loading: false,
          error: {
            code: 'DB_LOAD_FAILED',
            message: err instanceof Error ? err.message : 'Unknown error',
            userMessage:
              'Failed to load payment details. Please check your connection and try again.',
          },
        });
      }
    },

    reset: () => {
      if (txMonitor) {
        txMonitor.stop();
        txMonitor = null;
      }
      stopReferencePolling();
      clearTariTimers();
      tariConnection = null;
      set({
        order: null,
        shop: null,
        split: null,
        networkFee: ESTIMATED_NETWORK_FEE_USD,
        confirmState: 'monitoring',
        payState: 'awaiting_scan',
        txSignature: null,
        txBlockTime: null,
        amountMismatch: null,
        retryCount: 0,
        loading: false,
        error: null,
        paymentChain: 'solana',
        tariDeepLink: null,
        paymentRefPubkey: null,
        regenerationCount: 0,
        currentBlockhash: null,
        regenerating: false,
      });
    },

    startConfirmation: () => {
      const { order, shop, retryCount, paymentChain, paymentRefPubkey } = get();
      if (!order || !shop) return;

      // Clean up any existing monitors
      if (txMonitor) {
        txMonitor.stop();
        txMonitor = null;
      }
      stopReferencePolling();
      clearTariTimers();

      if (paymentChain === 'tari') {
        startTariConfirmation(order, shop, retryCount);
      } else {
        // Transition to awaiting_scan — QR is visible, waiting for customer
        set({
          confirmState: 'monitoring',
          payState: 'awaiting_scan',
        });
        startSolanaReferencePolling(order, shop, retryCount, paymentRefPubkey);
      }
    },

    stopConfirmation: () => {
      if (txMonitor) {
        txMonitor.stop();
        txMonitor = null;
      }
      stopReferencePolling();
      clearTariTimers();
    },

    retryConfirmation: () => {
      set({
        retryCount: get().retryCount + 1,
        confirmState: 'monitoring',
        payState: 'awaiting_scan',
        txSignature: null,
        txBlockTime: null,
        amountMismatch: null,
        error: null,
      });
      get().startConfirmation();
    },

    markFinalized: async (signature: string) => {
      const { order } = get();
      if (!order) return;
      try {
        // 1. Re-read the order to get current state (avoid stale closure)
        const currentOrder = await db.orders.get(order.id);
        if (!currentOrder) return;

        // 2. Same-order idempotency: if already paid, just log the duplicate signature
        if (currentOrder.status === 'paid') {
          const existingDuplicates = currentOrder.duplicateTxIds ?? [];
          if (!existingDuplicates.includes(signature)) {
            await db.orders.update(order.id, {
              duplicateTxIds: [...existingDuplicates, signature],
              updatedAt: new Date(),
            });
          }
          console.warn(
            `[payStore] Duplicate payment for already-paid order #${order.id}: sig=${signature}`,
          );
          return;
        }

        // 3. Cross-order idempotency: check if another order already claimed this paymentRef
        if (order.paymentRef) {
          const duplicatePaidOrder = await db.orders
            .where('paymentRef')
            .equals(order.paymentRef)
            .filter((o) => o.id !== order.id && o.status === 'paid')
            .first();

          if (duplicatePaidOrder) {
            // Log the duplicate signature to the original (already paid) order
            const existingDuplicates = duplicatePaidOrder.duplicateTxIds ?? [];
            if (!existingDuplicates.includes(signature)) {
              await db.orders.update(duplicatePaidOrder.id, {
                duplicateTxIds: [...existingDuplicates, signature],
                updatedAt: new Date(),
              });
            }

            // Mark current order as pending_review — do NOT double-credit
            await db.orders.update(order.id, {
              status: 'pending_review' as const,
              txSignature: signature,
              updatedAt: new Date(),
            });
            console.warn(
              `[payStore] Duplicate paymentRef "${order.paymentRef}" — order #${order.id} is duplicate of #${duplicatePaidOrder.id}`,
            );
            return;
          }
        }

        // 4. No duplicate — mark as paid normally
        await db.orders.update(order.id, {
          status: 'paid' as const,
          txSignature: signature,
          confirmedAt: new Date(),
          updatedAt: new Date(),
        });
      } catch (err) {
        console.error('Failed to persist confirmation to DB:', err);
      }
    },

    regenerateQR: async () => {
      const { regenerationCount, order, paymentChain } = get();
      const MAX_REGENERATIONS = 3;

      if (regenerationCount >= MAX_REGENERATIONS) return false;

      // Only regenerate for Solana payments
      if (paymentChain !== 'solana') return false;

      // Don't regenerate if order is already finalized/terminal
      if (!order) return false;

      set({ regenerating: true });

      try {
        const { blockhash } = await getLatestBlockhash('devnet');

        set({
          regenerationCount: regenerationCount + 1,
          currentBlockhash: blockhash,
          regenerating: false,
        });

        return true;
      } catch (err) {
        console.error('Failed to regenerate QR blockhash:', err);
        set({ regenerating: false });
        return false;
      }
    },
  };

  // -----------------------------------------------------------------------
  // Solana confirmation — reference-based polling via findReferenceByAddress
  // -----------------------------------------------------------------------

  async function startSolanaReferencePolling(
    order: Order,
    shop: NonNullable<PayState['shop']>,
    retryCount: number,
    paymentRefPubkey: string | null,
  ) {
    if (!paymentRefPubkey) {
      // Fall back to TxMonitor if no reference key
      startSolanaTxMonitor(order, shop, retryCount);
      return;
    }

    stopReferencePolling();
    refPollAbort = new AbortController();

    const connection = getConnection('devnet');

    // Start polling in background
    (async () => {
      // Give a short delay so the QR renders before we show "watching"
      await new Promise((r) => setTimeout(r, 300));

      if (refPollAbort?.signal.aborted) return;

      // Transition: awaiting_scan → broadcasting (first poll)
      // We're watching the chain — the customer may have already scanned
      const cur = get();
      if (cur.payState === 'awaiting_scan' && !refPollAbort?.signal.aborted) {
        set({ payState: 'broadcasting' });
      }

      const outcome = await findReferenceByAddress(connection, paymentRefPubkey, {
        commitment: 'finalized',
        pollIntervalMs: SOLANA_POLL_INTERVAL_MS,
        timeoutMs: SOLANA_TIMEOUT_MS,
        signal: refPollAbort?.signal,
      });

      if (refPollAbort?.signal.aborted) return;

      if (outcome.status === 'found') {
        set({
          confirmState: 'confirmed',
          payState: 'finalized',
          txSignature: outcome.signature,
          txBlockTime: outcome.blockTime ?? null,
        });
        void get().markFinalized(outcome.signature);
      } else if (outcome.status === 'timeout') {
        if (retryCount >= 2) {
          set({
            confirmState: 'timeout',
            payState: 'expired',
            error: {
              code: 'TX_TIMEOUT',
              message: 'No payment detected within the timeout window.',
              userMessage:
                'No payment was detected. Your wallet may not have sent the transaction. Please try scanning the QR code again.',
            },
          });
        } else {
          set({ confirmState: 'timeout', payState: 'expired' });
        }
      } else {
        // error
        if (retryCount >= 2) {
          set({
            confirmState: 'error',
            payState: 'failed',
            error: {
              code: 'NETWORK_ERROR',
              message: outcome.message,
              userMessage:
                'Network error while checking for payment. Please check your connection and try again.',
            },
          });
        } else {
          set({ confirmState: 'error', payState: 'failed' });
        }
      }
    })();
  }

  // -----------------------------------------------------------------------
  // Solana confirmation — TxMonitor fallback (memo-based)
  // -----------------------------------------------------------------------

  function startSolanaTxMonitor(
    order: Order,
    shop: NonNullable<PayState['shop']>,
    retryCount: number,
  ) {
    const paymentRef = `microshop:${order.shopId}:${order.id}`;
    const grandTotal = order.total + ESTIMATED_NETWORK_FEE_USD;

    txMonitor = new TxMonitor(
      {
        paymentRef,
        merchantWallet: shop.merchantWallet,
        splTokenMint: order.splTokenMint,
        expectedAmount: grandTotal,
        tokenSymbol: shop.splTokenSymbol,
        cluster: 'devnet',
        pollIntervalMs: 3000,
        timeoutMs: 120_000,
      },
      {
        onStateChange: (state, details) => {
          const cur = get();
          if (cur.confirmState === 'confirmed' || cur.confirmState === 'error') return;
          set({
            confirmState: state,
            payState: monitorStateToPayState[state] ?? 'awaiting_scan',
          });

          if (state === 'confirmed' && details?.signature) {
            set({ txSignature: details.signature, txBlockTime: details.blockTime ?? null });
            void get().markFinalized(details.signature);
          }
          if ((state === 'failed' || state === 'timeout') && retryCount >= 2) {
            set({
              error: {
                code: state === 'timeout' ? 'TX_TIMEOUT' : 'TX_FAILED',
                message:
                  state === 'timeout' ? 'No payment detected.' : 'Transaction failed on-chain.',
                userMessage:
                  state === 'timeout'
                    ? 'No payment was detected. Your wallet may not have sent the transaction. Please try scanning the QR code again.'
                    : 'The transaction failed on the network. No funds were transferred. Please try again.',
              },
            });
          }
        },
        onAmountMismatch: (mismatch) => {
          set({
            amountMismatch: mismatch,
            error: {
              code: 'WRONG_AMOUNT',
              message: `Expected $${mismatch.expected.toFixed(2)} but received $${mismatch.received.toFixed(2)}.`,
              userMessage: `Incorrect payment amount detected. The order total is $${mismatch.expected.toFixed(2)} but $${mismatch.received.toFixed(2)} was sent. Please try again with the correct amount.`,
            },
          });
        },
      },
    );
    void txMonitor.start();
  }

  // -----------------------------------------------------------------------
  // Tari confirmation — poll TariConnection.getTransaction()
  // -----------------------------------------------------------------------

  function startTariConfirmation(order: Order, shop: PayState['shop'], retryCount: number) {
    if (!shop?.tariWallet) return;

    const network = shop.tariNetwork ?? 'igor';
    const config = getTariNetworkConfig(network);
    tariConnection = new TariConnection(config);

    let pollCount = 0;

    tariTimeoutTimer = setTimeout(() => {
      clearTariTimers();
      const cur = get();
      if (cur.confirmState === 'confirmed' || cur.confirmState === 'error') return;
      if (retryCount >= 2) {
        set({
          confirmState: 'timeout',
          payState: 'expired',
          error: {
            code: 'TX_TIMEOUT',
            message: 'No Tari payment detected within the timeout window.',
            userMessage:
              'No payment was detected on the Tari network. Your wallet may not have sent the transaction. Please try scanning the QR code again.',
          },
        });
      } else {
        set({ confirmState: 'timeout', payState: 'expired' });
      }
    }, TARI_CONFIRMATION_TIMEOUT_MS);

    // Poll immediately, then on interval
    void pollTariTransaction(order, shop, retryCount);

    tariPollTimer = setInterval(() => {
      pollCount++;
      void pollTariTransaction(order, shop, retryCount);
    }, TARI_CONFIRMATION_POLL_MS);
  }

  async function pollTariTransaction(order: Order, shop: PayState['shop'], retryCount: number) {
    const cur = get();
    if (cur.confirmState === 'confirmed' || cur.confirmState === 'error') {
      clearTariTimers();
      return;
    }

    if (!tariConnection || !shop?.tariWallet) return;

    try {
      const txId = order.tariTransactionId;

      if (txId) {
        const tx = await tariConnection.getTransaction(txId);

        if (tx) {
          // Terminal statuses
          if (tx.status === 'Accepted') {
            clearTariTimers();
            set({
              confirmState: 'confirmed',
              payState: 'finalized',
              txSignature: tx.transactionId,
              txBlockTime: Math.floor(Date.now() / 1000),
            });
            void get().markFinalized(tx.transactionId);
            return;
          }

          if (tx.status === 'Rejected' || tx.status === 'Invalid') {
            clearTariTimers();
            if (retryCount >= 2) {
              set({
                confirmState: 'failed',
                payState: 'failed',
                error: {
                  code: 'TX_FAILED',
                  message: `Tari transaction ${tx.status}: ${tx.invalidReason ?? 'Unknown reason'}`,
                  userMessage:
                    'The transaction was rejected by the Tari network. No funds were transferred. Please try again.',
                },
              });
            } else {
              set({ confirmState: 'failed', payState: 'failed' });
            }
            return;
          }

          if (tx.status === 'OnlyFeeAccepted') {
            set({
              confirmState: 'wrong_amount',
              payState: 'failed',
              error: {
                code: 'WRONG_AMOUNT',
                message: 'Only the transaction fee was accepted. The full amount was not received.',
                userMessage:
                  'Incorrect payment amount detected. Please try again with the correct amount.',
              },
            });
            return;
          }

          // Pending / DryRun / New — still waiting
          if (cur.confirmState !== 'confirming') {
            set({ confirmState: 'confirming', payState: 'confirming' });
          }
        }
      }
    } catch {
      // Connection error — don't fail, keep polling
    }
  }
});
