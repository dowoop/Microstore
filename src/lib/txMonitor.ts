/**
 * On-chain transaction monitor for payment confirmation.
 *
 * Uses Helius WebSocket (logsSubscribe) for real-time notification when
 * available, with a polling fallback (getSignaturesForAddress every 3s).
 * Matches transactions by memo (paymentRef) and optionally verifies the
 * transferred amount against the expected order total.
 */

import { Connection, PublicKey } from '@solana/web3.js';
import { getConnection } from '@/lib/solanaPay';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MonitorState =
  | 'monitoring'   // watching for payment
  | 'confirming'   // tx detected, awaiting finality
  | 'confirmed'    // payment confirmed on-chain
  | 'failed'       // tx reverted / error
  | 'timeout'      // no matching tx within timeout window
  | 'wrong_amount' // tx found but amount doesn't match expected
  | 'error';       // transport / RPC error

export interface TxDetails {
  signature: string;
  blockTime?: number;
  memo?: string;
}

export interface AmountMismatch {
  signature: string;
  expected: number;
  received: number;
  tokenSymbol: string;
}

export interface TxMonitorCallbacks {
  onStateChange: (state: MonitorState, details?: TxDetails) => void;
  onAmountMismatch?: (mismatch: AmountMismatch) => void;
}

export interface TxMonitorOptions {
  /** The memo string to match in the transaction (our paymentRef). */
  paymentRef: string;
  /** Merchant wallet address to monitor for incoming transfers. */
  merchantWallet: string;
  /** SPL token mint (if SPL token payment). */
  splTokenMint?: string;
  /** Expected total amount (human-readable). Omit to skip amount verification. */
  expectedAmount?: number;
  /** Token symbol for display in mismatch messages. */
  tokenSymbol?: string;
  /** Solana cluster. */
  cluster?: 'devnet' | 'mainnet-beta';
  /** Polling interval in ms (default: 3000). */
  pollIntervalMs?: number;
  /** Timeout in ms (default: 120000 = 2 min). */
  timeoutMs?: number;
}

// ---------------------------------------------------------------------------
// TxMonitor class
// ---------------------------------------------------------------------------

export class TxMonitor {
  private opts: Required<TxMonitorOptions>;
  private cb: TxMonitorCallbacks;
  private connection: Connection;
  private ws: WebSocket | null = null;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private timeoutTimer: ReturnType<typeof setTimeout> | null = null;
  private aborted = false;
  private seenSignatures = new Set<string>();
  private wsSubscriptionId: number | null = null;

  constructor(options: TxMonitorOptions, callbacks: TxMonitorCallbacks) {
    this.opts = {
      splTokenMint: '',
      expectedAmount: 0,
      tokenSymbol: 'SPL',
      cluster: 'devnet',
      pollIntervalMs: 3000,
      timeoutMs: 120_000,
      ...options,
    };
    this.cb = callbacks;
    this.connection = getConnection(this.opts.cluster);
  }

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  /** Start monitoring. Tries WebSocket first; falls back to polling. */
  async start(): Promise<void> {
    this.aborted = false;
    this.seenSignatures = new Set();

    // Absolute timeout — stop monitoring after this window
    this.timeoutTimer = setTimeout(() => {
      if (!this.aborted) {
        this.cb.onStateChange('timeout');
        this.stop();
      }
    }, this.opts.timeoutMs);

    // Try Helius WebSocket; fall back to polling
    const wsStarted = await this.tryWebSocket();
    if (!wsStarted) {
      await this.startPolling();
    }
  }

  /** Stop monitoring and clean up all timers / sockets. */
  stop(): void {
    this.aborted = true;
    this.clearTimers();
    this.closeWebSocket();
  }

  // -----------------------------------------------------------------------
  // WebSocket (Helius logsSubscribe)
  // -----------------------------------------------------------------------

  private async tryWebSocket(): Promise<boolean> {
    const apiKey = process.env.NEXT_PUBLIC_HELIUS_API_KEY;
    if (!apiKey) return false;

    const wsEndpoint =
      this.opts.cluster === 'mainnet-beta'
        ? `wss://mainnet.helius-rpc.com/?api-key=${apiKey}`
        : `wss://devnet.helius-rpc.com/?api-key=${apiKey}`;

    return new Promise<boolean>((resolve) => {
      let resolved = false;

      try {
        this.ws = new WebSocket(wsEndpoint);
      } catch {
        resolve(false);
        return;
      }

      const fail = () => {
        if (!resolved) {
          resolved = true;
          resolve(false);
        }
      };

      this.ws.onopen = () => {
        // Subscribe to transaction logs mentioning the merchant wallet
        const msg = {
          jsonrpc: '2.0',
          id: 1,
          method: 'logsSubscribe',
          params: [
            { mentions: [this.opts.merchantWallet] },
            { commitment: 'confirmed' },
          ],
        };
        this.ws!.send(JSON.stringify(msg));
      };

      this.ws.onmessage = (event) => {
        if (this.aborted) return;
        try {
          const data = JSON.parse(event.data as string);

          // Capture subscription id on the first response
          if (data.id === 1 && data.result !== undefined) {
            this.wsSubscriptionId = data.result as number;
            if (!resolved) {
              resolved = true;
              resolve(true);
            }
            return;
          }

          // Handle log notification
          const sig =
            data.params?.result?.value?.signature ??
            data.params?.result?.signature;
          if (sig && typeof sig === 'string') {
            this.handleNewSignature(sig);
          }
        } catch {
          // Ignore parse errors on individual messages
        }
      };

      this.ws.onerror = fail;
      this.ws.onclose = () => {
        if (!resolved) fail();
      };

      // Safety timeout — if WS doesn't connect within 6s, give up
      setTimeout(fail, 6_000);
    });
  }

  private closeWebSocket(): void {
    if (this.ws) {
      try {
        if (this.wsSubscriptionId !== null) {
          this.ws.send(
            JSON.stringify({
              jsonrpc: '2.0',
              id: 99,
              method: 'logsUnsubscribe',
              params: [this.wsSubscriptionId],
            }),
          );
        }
        this.ws.close();
      } catch {
        // Best effort
      }
      this.ws = null;
      this.wsSubscriptionId = null;
    }
  }

  // -----------------------------------------------------------------------
  // Polling fallback
  // -----------------------------------------------------------------------

  private async startPolling(): Promise<void> {
    // Seed known signatures so we only look at new ones
    await this.seedSignatures();
    if (this.aborted) return;

    // Immediate first poll
    await this.poll();

    // Then poll on interval
    this.pollTimer = setInterval(() => {
      void this.poll();
    }, this.opts.pollIntervalMs);
  }

  private async seedSignatures(): Promise<void> {
    try {
      const pubkey = new PublicKey(this.opts.merchantWallet);
      const sigs = await this.connection.getSignaturesForAddress(pubkey, {
        limit: 20,
      });
      for (const s of sigs) {
        this.seenSignatures.add(s.signature);
      }
    } catch {
      // Non-fatal — we'll just see more dupes on the first poll cycle
    }
  }

  private async poll(): Promise<void> {
    if (this.aborted) return;
    try {
      const pubkey = new PublicKey(this.opts.merchantWallet);
      const sigs = await this.connection.getSignaturesForAddress(pubkey, {
        limit: 10,
      });
      for (const s of sigs) {
        if (this.seenSignatures.has(s.signature)) continue;
        this.seenSignatures.add(s.signature);
        void this.handleNewSignature(s.signature);
      }
    } catch {
      // Silently skip polling errors — next cycle will retry
    }
  }

  // -----------------------------------------------------------------------
  // Signature handling
  // -----------------------------------------------------------------------

  private async handleNewSignature(signature: string): Promise<void> {
    if (this.aborted) return;

    try {
      const tx = await this.connection.getParsedTransaction(signature, {
        maxSupportedTransactionVersion: 0,
      });

      if (!tx || !tx.meta) return;

      // Check for memo match
      const memo = this.extractMemo(tx);
      const memoMatches = memo !== null && memo === this.opts.paymentRef;

      // Check amount if expectedAmount is set
      let amountOk = true;
      let txAmount = 0;

      if (this.opts.expectedAmount > 0) {
        const result = this.extractTransferAmount(tx);
        txAmount = result.found ? result.total : 0;
        amountOk = txAmount === 0 || this.amountsMatch(txAmount, this.opts.expectedAmount);
      }

      // If memo matches, this is definitely our transaction
      if (memoMatches) {
        if (tx.meta.err) {
          this.cb.onStateChange('failed', { signature, memo });
        } else {
          this.cb.onStateChange('confirmed', {
            signature,
            blockTime: tx.blockTime ?? undefined,
            memo,
          });
        }
        this.stop();
        return;
      }

      // If memo doesn't match but amount looks right (and we have an expected amount),
      // check more carefully — some wallets strip the memo
      if (!memoMatches && this.opts.expectedAmount > 0 && amountOk && txAmount > 0) {
        // Possible match by amount — confirm it
        if (!tx.meta.err) {
          this.cb.onStateChange('confirmed', {
            signature,
            blockTime: tx.blockTime ?? undefined,
            memo: memo ?? undefined,
          });
          this.stop();
          return;
        }
      }

      // Wrong amount detected (found a tx for our merchant wallet but amount doesn't match)
      if (
        this.opts.expectedAmount > 0 &&
        txAmount > 0 &&
        !amountOk &&
        !tx.meta.err
      ) {
        this.cb.onStateChange('wrong_amount', {
          signature,
          blockTime: tx.blockTime ?? undefined,
        });
        this.cb.onAmountMismatch?.({
          signature,
          expected: this.opts.expectedAmount,
          received: txAmount,
          tokenSymbol: this.opts.tokenSymbol,
        });
        // Don't stop — let the customer retry or contact merchant
      }
    } catch {
      // Ignore errors fetching individual transactions
    }
  }

  // -----------------------------------------------------------------------
  // Transaction parsing helpers
  // -----------------------------------------------------------------------

  /**
   * Extracts the memo string from a parsed transaction.
   * Returns null if no memo instruction is found.
   */
  private extractMemo(
    tx: Awaited<ReturnType<Connection['getParsedTransaction']>>,
  ): string | null {
    if (!tx || !tx.transaction) return null;
    const message = tx.transaction.message;
    const instructions = ('instructions' in message
      ? message.instructions
      : []) as Array<Record<string, unknown>>;

    const MEMO_PROGRAM = 'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr';

    for (const ix of instructions) {
      if (
        typeof ix.programId === 'string' &&
        ix.programId === MEMO_PROGRAM &&
        ix.parsed
      ) {
        const parsed = ix.parsed as { memo?: string };
        if (parsed.memo) return parsed.memo;
      }
    }
    return null;
  }

  /**
   * Extracts the total SPL token amount transferred TO the merchant
   * in this transaction. Only counts transfers where the destination
   * is the monitored merchant wallet.
   */
  private extractTransferAmount(
    tx: Awaited<ReturnType<Connection['getParsedTransaction']>>,
  ): { found: boolean; total: number } {
    if (!tx?.meta?.postTokenBalances || !tx.meta.preTokenBalances) {
      return { found: false, total: 0 };
    }

    // postTokenBalances gives us the net effect on each token account.
    // Find the merchant's token account and compute the delta.
    let total = 0;
    let found = false;

    for (let i = 0; i < tx.meta.postTokenBalances.length; i++) {
      const post = tx.meta.postTokenBalances[i]!;
      const pre =
        i < tx.meta.preTokenBalances.length
          ? tx.meta.preTokenBalances[i]
          : null;

      // Check if this account belongs to the merchant
      if (
        post.owner &&
        post.owner === this.opts.merchantWallet
      ) {
        const postAmt = post.uiTokenAmount?.uiAmount ?? 0;
        const preAmt = pre?.uiTokenAmount?.uiAmount ?? 0;
        const delta = postAmt - preAmt;
        if (delta > 0) {
          total += delta;
        }
        found = true;
      }
    }

    return { found, total };
  }

  /**
   * Checks if two amounts match within a tolerance of 0.01 (1 cent).
   */
  private amountsMatch(actual: number, expected: number): boolean {
    return Math.abs(actual - expected) < 0.02;
  }

  // -----------------------------------------------------------------------
  // Cleanup
  // -----------------------------------------------------------------------

  private clearTimers(): void {
    if (this.pollTimer !== null) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    if (this.timeoutTimer !== null) {
      clearTimeout(this.timeoutTimer);
      this.timeoutTimer = null;
    }
  }
}
