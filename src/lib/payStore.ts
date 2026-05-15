import { create } from 'zustand';
import { db, type Order } from '@/lib/db';
import {
  computeAtomicSplit,
  type SplitBreakdown,
} from '@/lib/solanaPay';
import {
  TxMonitor,
  type MonitorState,
  type TxDetails,
  type AmountMismatch,
} from '@/lib/txMonitor';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PayErrorCode =
  | 'ORDER_NOT_FOUND'
  | 'SHOP_NOT_FOUND'
  | 'WALLET_REJECTED'
  | 'NETWORK_ERROR'
  | 'DB_LOAD_FAILED'
  | 'TX_FAILED'
  | 'TX_TIMEOUT'
  | 'WRONG_AMOUNT';

export interface PayError {
  code: PayErrorCode;
  message: string;
  userMessage: string;
}

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
let loadRequestId = 0;

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const usePayStore = create<PayState>()((set, get) => {
  let txMonitor: TxMonitor | null = null;

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

    loadOrder: async (orderId: number) => {
      const thisRequestId = ++loadRequestId;
      set({ loading: true, error: null, retryCount: 0 });

      try {
        const order = await db.orders.get(orderId);
        if (thisRequestId !== loadRequestId) return;
        if (!order) {
          set({
            loading: false,
            error: {
              code: 'ORDER_NOT_FOUND',
              message: `Order #${orderId} not found.`,
              userMessage: 'This payment link has expired. Ask the merchant for a new link.',
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
              message: `Shop #${order.shopId} not found.`,
              userMessage: 'The shop associated with this order no longer exists.',
            },
          });
          return;
        }

        const shop = {
          name: shopRecord.name,
          merchantWallet: order.merchantWallet ?? shopRecord.merchantWallet ?? '',
          taxWallet: order.taxWallet ?? shopRecord.taxWallet ?? shopRecord.merchantWallet ?? '',
          charityWallet: order.charityWallet ?? shopRecord.charityWallet ?? shopRecord.merchantWallet ?? '',
          charityPartners: shopRecord.charityPartners ?? [],
          splTokenSymbol: order.splTokenSymbol ?? shopRecord.splTokenSymbol ?? 'SPL',
          taxAllocationEnabled: shopRecord.taxAllocationEnabled,
          charityEnabled: shopRecord.charityEnabled,
        };

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

        set({ order, shop, split, loading: false });
      } catch (err) {
        console.error('Pay store loadOrder error:', err);
        set({
          loading: false,
          error: {
            code: 'DB_LOAD_FAILED',
            message: err instanceof Error ? err.message : 'Unknown error',
            userMessage: 'Failed to load payment details. Check your connection and try again.',
          },
        });
      }
    },

    reset: () => {
      if (txMonitor) { txMonitor.stop(); txMonitor = null; }
      set({
        order: null, shop: null, split: null,
        networkFee: ESTIMATED_NETWORK_FEE_USD,
        confirmState: 'monitoring',
        txSignature: null, txBlockTime: null,
        amountMismatch: null, retryCount: 0,
        loading: false, error: null,
      });
    },

    startConfirmation: () => {
      const { order, shop, retryCount } = get();
      if (!order || !shop) return;

      if (txMonitor) { txMonitor.stop(); txMonitor = null; }

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
                  message: state === 'timeout' ? 'No payment detected.' : 'Transaction failed on-chain.',
                  userMessage: state === 'timeout'
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
    },

    stopConfirmation: () => {
      if (txMonitor) { txMonitor.stop(); txMonitor = null; }
    },

    retryConfirmation: () => {
      set({
        retryCount: get().retryCount + 1,
        confirmState: 'monitoring',
        txSignature: null, txBlockTime: null,
        amountMismatch: null, error: null,
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
});