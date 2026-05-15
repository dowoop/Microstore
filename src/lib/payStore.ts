import { create } from 'zustand';
import { db, type Order } from '@/lib/db';
import { computeAtomicSplit, type SplitBreakdown } from '@/lib/solanaPay';
import { TxMonitor, type MonitorState, type TxDetails, type AmountMismatch } from '@/lib/txMonitor';
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
  loadOrder: (orderId: number) => Promise<void>;
  reset: () => void;
  startConfirmation: () => void;
  stopConfirmation: () => void;
  retryConfirmation: () => void;
  markConfirmed: (signature: string) => Promise<void>;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ESTIMATED_NETWORK_FEE_USD = 0.001;
const TARI_CONFIRMATION_POLL_MS = 3000;
const TARI_CONFIRMATION_TIMEOUT_MS = 120_000;
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

  return {
    order: null,
    shop: null,
    split: null,
    networkFee: ESTIMATED_NETWORK_FEE_USD,
    confirmState: 'monitoring' as MonitorState,
    txSignature: null,
    txBlockTime: null,
    amountMismatch: null,
    retryCount: 0,
    loading: false,
    error: null,
    paymentChain: 'solana',
    tariDeepLink: null,

    loadOrder: async (orderId: number) => {
      const thisRequestId = ++loadRequestId;
      set({ loading: true, error: null, retryCount: 0, tariDeepLink: null });

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
          taxRate: 0.08875,
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

        set({ order, shop, split, loading: false, paymentChain: chain, tariDeepLink });
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
      clearTariTimers();
      tariConnection = null;
      set({
        order: null,
        shop: null,
        split: null,
        networkFee: ESTIMATED_NETWORK_FEE_USD,
        confirmState: 'monitoring',
        txSignature: null,
        txBlockTime: null,
        amountMismatch: null,
        retryCount: 0,
        loading: false,
        error: null,
        paymentChain: 'solana',
        tariDeepLink: null,
      });
    },

    startConfirmation: () => {
      const { order, shop, retryCount, paymentChain } = get();
      if (!order || !shop) return;

      // Clean up any existing monitors
      if (txMonitor) {
        txMonitor.stop();
        txMonitor = null;
      }
      clearTariTimers();

      if (paymentChain === 'tari') {
        startTariConfirmation(order, shop, retryCount);
      } else {
        startSolanaConfirmation(order, shop, retryCount);
      }
    },

    stopConfirmation: () => {
      if (txMonitor) {
        txMonitor.stop();
        txMonitor = null;
      }
      clearTariTimers();
    },

    retryConfirmation: () => {
      set({
        retryCount: get().retryCount + 1,
        confirmState: 'monitoring',
        txSignature: null,
        txBlockTime: null,
        amountMismatch: null,
        error: null,
      });
      get().startConfirmation();
    },

    markConfirmed: async (signature: string) => {
      const { order } = get();
      if (!order) return;
      try {
        await db.orders.update(order.id, {
          status: 'paid',
          txSignature: signature,
          confirmedAt: new Date(),
          updatedAt: new Date(),
        });
      } catch (err) {
        console.error('Failed to persist confirmation to DB:', err);
      }
    },
  };

  // -----------------------------------------------------------------------
  // Solana confirmation (unchanged logic, extracted for clarity)
  // -----------------------------------------------------------------------

  function startSolanaConfirmation(order: Order, shop: PayState['shop'], retryCount: number) {
    if (!shop) return;

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
          set({ confirmState: state });

          if (state === 'confirmed' && details?.signature) {
            set({ txSignature: details.signature, txBlockTime: details.blockTime ?? null });
            void get().markConfirmed(details.signature);
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
          error: {
            code: 'TX_TIMEOUT',
            message: 'No Tari payment detected within the timeout window.',
            userMessage:
              'No payment was detected on the Tari network. Your wallet may not have sent the transaction. Please try scanning the QR code again.',
          },
        });
      } else {
        set({ confirmState: 'timeout' });
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
      // We need a transaction ID to poll. Tari deep links don't return a tx ID
      // upfront, so we look for any transaction TO the merchant's wallet with
      // the matching payment ref (note). For now, we use the paymentRef as a
      // heuristic — the wallet daemon's transactions.list method can filter.
      // Since getTransaction requires a specific ID, we check if the order
      // already has a tariTransactionId stored.
      const txId = order.tariTransactionId;

      if (txId) {
        const tx = await tariConnection.getTransaction(txId);

        if (tx) {
          // Terminal statuses
          if (tx.status === 'Accepted') {
            clearTariTimers();
            set({
              confirmState: 'confirmed',
              txSignature: tx.transactionId,
              txBlockTime: Math.floor(Date.now() / 1000),
            });
            void get().markConfirmed(tx.transactionId);
            return;
          }

          if (tx.status === 'Rejected' || tx.status === 'Invalid') {
            clearTariTimers();
            if (retryCount >= 2) {
              set({
                confirmState: 'failed',
                error: {
                  code: 'TX_FAILED',
                  message: `Tari transaction ${tx.status}: ${tx.invalidReason ?? 'Unknown reason'}`,
                  userMessage:
                    'The transaction was rejected by the Tari network. No funds were transferred. Please try again.',
                },
              });
            } else {
              set({ confirmState: 'failed' });
            }
            return;
          }

          if (tx.status === 'OnlyFeeAccepted') {
            set({
              confirmState: 'wrong_amount',
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
            set({ confirmState: 'confirming' });
          }
        }
        // If tx is null (not found), keep polling
      }
    } catch {
      // Connection error — don't fail, keep polling
    }
  }
});
