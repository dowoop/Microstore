import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
  clusterApiUrl,
  type Cluster,
  TransactionExpiredBlockheightExceededError,
  type TransactionSignature,
} from '@solana/web3.js';
import {
  createTransferCheckedInstruction,
  getAssociatedTokenAddress,
  getMint,
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAccount,
} from '@solana/spl-token';
import { encodeURL } from '@solana/pay';
import QRCode from 'qrcode';

// ---------------------------------------------------------------------------
// Helius RPC configuration
// ---------------------------------------------------------------------------

const HELIUS_API_KEY = process.env.NEXT_PUBLIC_HELIUS_API_KEY ?? '';

const DEVNET_RPC = HELIUS_API_KEY
  ? `https://devnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`
  : clusterApiUrl('devnet');

const MAINNET_RPC = HELIUS_API_KEY
  ? `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`
  : clusterApiUrl('mainnet-beta');

export function getConnection(cluster: Cluster = 'devnet'): Connection {
  const endpoint = cluster === 'mainnet-beta' ? MAINNET_RPC : DEVNET_RPC;
  return new Connection(endpoint, 'confirmed');
}

// ---------------------------------------------------------------------------
// Atomic split breakdown
// ---------------------------------------------------------------------------

export interface SplitBreakdown {
  merchant: { address: string; amount: number; label: string };
  tax: { address: string; amount: number; label: string };
  charity: { address: string; amount: number; label: string };
}

export function computeAtomicSplit(params: {
  subtotal: number;
  tipPercent: number;
  taxRate: number;
  charityRoundUp: boolean;
  merchantWallet: string;
  taxWallet: string;
  charityWallet: string;
  charityPartners: string[];
}): SplitBreakdown {
  const { subtotal, tipPercent, taxRate, charityRoundUp, merchantWallet, taxWallet, charityWallet, charityPartners } =
    params;

  const tip = subtotal * (tipPercent / 100);
  const tax = subtotal * taxRate;
  const preCharity = subtotal + tip + tax;
  const charity = charityRoundUp ? Math.ceil(preCharity) - preCharity : 0;

  return {
    merchant: {
      address: merchantWallet,
      amount: subtotal + tip,
      label: 'Merchant + Tip',
    },
    tax: {
      address: taxWallet,
      amount: tax,
      label: 'Tax',
    },
    charity: {
      address: charityWallet,
      amount: charity,
      label: charityPartners.length > 0 ? charityPartners.join(' & ') : 'Charity',
    },
  };
}

// ---------------------------------------------------------------------------
// Build atomic split transaction (3 SPL transfer instructions)
// ---------------------------------------------------------------------------

export interface BuildAtomicTxParams {
  customerPubkey: string;      // the customer's wallet public key
  splMint: string;             // SPL token mint address
  split: SplitBreakdown;
  memo?: string;
}

/**
 * Builds a transaction with 3 atomic SPL token transfer instructions.
 * The customer's wallet signs and submits this transaction.
 */
export async function buildAtomicSplitTransaction(
  connection: Connection,
  params: BuildAtomicTxParams,
): Promise<Transaction> {
  const { customerPubkey, splMint, split, memo } = params;

  const customer = new PublicKey(customerPubkey);
  const mint = new PublicKey(splMint);

  // Get mint decimals
  const mintInfo = await getMint(connection, mint);

  // Derive the customer's ATA for this token
  const customerATA = await getAssociatedTokenAddress(mint, customer);

  const instructions: TransactionInstruction[] = [];

  // Build transfer instructions for each split leg (non-zero amounts only)
  const legs = [
    { address: split.merchant.address, amount: split.merchant.amount },
    { address: split.tax.address, amount: split.tax.amount },
    { address: split.charity.address, amount: split.charity.amount },
  ];

  for (const leg of legs) {
    if (leg.amount <= 0) continue;

    const destination = new PublicKey(leg.address);
    const destinationATA = await getAssociatedTokenAddress(mint, destination);

    // Check if destination ATA exists; if not, create it atomically
    try {
      await getAccount(connection, destinationATA);
    } catch {
      // ATA doesn't exist — create it (customer pays the rent, ~0.002 SOL)
      instructions.push(
        createAssociatedTokenAccountInstruction(
          customer,                    // payer
          destinationATA,              // ata to create
          destination,                 // owner
          mint,                        // mint
          TOKEN_PROGRAM_ID,
          ASSOCIATED_TOKEN_PROGRAM_ID,
        ),
      );
    }

    // Convert decimal amount to raw token units
    const rawAmount = Math.round(leg.amount * Math.pow(10, mintInfo.decimals));

    instructions.push(
      createTransferCheckedInstruction(
        customerATA,     // source
        mint,             // mint
        destinationATA,   // destination
        customer,         // owner / authority
        rawAmount,
        mintInfo.decimals,
        [],               // multiSigners
        TOKEN_PROGRAM_ID,
      ),
    );
  }

  // Add memo instruction if provided (using Solana Memo program)
  if (memo) {
    instructions.push(
      new TransactionInstruction({
        keys: [{ pubkey: customer, isSigner: true, isWritable: false }],
        programId: new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr'),
        data: Buffer.from(memo, 'utf-8'),
      }),
    );
  }

  const transaction = new Transaction();

  // Set recent blockhash + fee payer
  const { blockhash } = await connection.getLatestBlockhash('confirmed');
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = customer;

  transaction.add(...instructions);

  return transaction;
}

// ---------------------------------------------------------------------------
// Solana Pay URL generation
// ---------------------------------------------------------------------------

/**
 * Creates a Solana Pay transfer request URL.
 * This is the simplest integration: the QR encodes a solana: URL
 * that the customer's wallet can process natively.
 */
export function createSolanaPayURL(params: {
  recipient: string;
  amount: number;
  splToken?: string;
  label?: string;
  message?: string;
  memo?: string;
}): string {
  // encodeURL from @solana/pay v1.0.16 uses @solana/kit branded types.
  // Pass strings and cast to satisfy the type checker — they convert cleanly at runtime.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const url = encodeURL({
    recipient: params.recipient as any,
    amount: params.amount,
    splToken: (params.splToken as any) ?? undefined,
    label: params.label,
    message: params.message,
    memo: params.memo,
  });
  return url.toString();
}

// ---------------------------------------------------------------------------
// QR code generation
// ---------------------------------------------------------------------------

/**
 * Renders a data string to a QR code data URL (PNG base64).
 * Use this in the browser to generate a QR code for display.
 */
export async function generateQRCode(data: string, options?: { width?: number }): Promise<string> {
  const width = options?.width ?? 300;
  return QRCode.toDataURL(data, {
    width,
    margin: 2,
    color: { dark: '#000000', light: '#ffffff' },
  });
}

// ---------------------------------------------------------------------------
// Serialize transaction for direct QR encoding
// ---------------------------------------------------------------------------

/**
 * Serializes a transaction to base64, suitable for encoding in a QR code.
 * Some wallets (e.g., Phantom) can scan and sign serialized transactions from QR.
 */
export function serializeTransactionForQR(transaction: Transaction): string {
  const serialized = transaction.serialize({
    requireAllSignatures: false,
    verifySignatures: false,
  });
  return Buffer.from(serialized).toString('base64');
}

// ---------------------------------------------------------------------------
// Wallet balance fetching via Helius / Solana RPC
// ---------------------------------------------------------------------------

export interface TokenBalance {
  mint: string;
  symbol: string;
  amount: number;       // human-readable
  decimals: number;
  uiAmount: number;
}

export interface WalletBalances {
  sol: number;                              // SOL balance in SOL
  solUsd?: number;                          // approximate USD value
  tokens: TokenBalance[];
  fetchedAt: Date;
}

/**
 * Fetch SOL balance for a wallet address.
 * Uses Helius RPC if configured, otherwise devnet public RPC.
 */
export async function fetchWalletBalance(
  address: string,
  cluster: Cluster = 'devnet',
): Promise<number> {
  const connection = getConnection(cluster);
  const pubkey = new PublicKey(address);
  const lamports = await connection.getBalance(pubkey);
  return lamports / 1e9; // Convert lamports to SOL
}

/**
 * Fetch all SPL token balances for a wallet via Helius getTokenAccounts.
 * Falls back to getParsedTokenAccountsByOwner.
 */
export async function fetchTokenBalances(
  address: string,
  cluster: Cluster = 'devnet',
): Promise<TokenBalance[]> {
  const connection = getConnection(cluster);
  const pubkey = new PublicKey(address);

  // Try Helius enhanced API first (returns symbol info)
  if (HELIUS_API_KEY) {
    try {
      const endpoint =
        cluster === 'mainnet-beta'
          ? `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`
          : `https://devnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;

      const resp = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 'token-balances',
          method: 'getTokenAccounts',
          params: { mint: undefined, owner: address },
        }),
      });

      if (resp.ok) {
        const data = await resp.json();
        if (data.result?.token_accounts) {
          return data.result.token_accounts
            .filter((acc: { amount: number }) => acc.amount > 0)
            .map(
              (acc: {
                mint: string;
                amount: number;
                decimals: number;
                symbol?: string;
              }) => ({
                mint: acc.mint,
                symbol: acc.symbol ?? acc.mint.slice(0, 6),
                amount: acc.amount,
                decimals: acc.decimals,
                uiAmount: acc.amount / Math.pow(10, acc.decimals),
              }),
            );
        }
      }
    } catch {
      // Fall through to standard RPC
    }
  }

  // Standard RPC fallback
  try {
    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(pubkey, {
      programId: TOKEN_PROGRAM_ID,
    });

    return tokenAccounts.value
      .filter((acc) => {
        const amount = acc.account.data.parsed.info.tokenAmount.uiAmount;
        return amount > 0;
      })
      .map((acc) => {
        const info = acc.account.data.parsed.info;
        return {
          mint: info.mint,
          symbol: info.mint.slice(0, 6),
          amount: parseInt(info.tokenAmount.amount, 10),
          decimals: info.tokenAmount.decimals,
          uiAmount: info.tokenAmount.uiAmount,
        };
      });
  } catch {
    return [];
  }
}

/**
 * Fetch complete wallet balance (SOL + SPL tokens).
 */
export async function fetchWalletBalances(
  address: string,
  cluster: Cluster = 'devnet',
): Promise<WalletBalances> {
  const [sol, tokens] = await Promise.all([
    fetchWalletBalance(address, cluster),
    fetchTokenBalances(address, cluster),
  ]);

  // Rough SOL USD estimate (not real-time — would need an oracle for accurate price)
  const solUsd = sol > 0 ? sol * 140 : undefined; // placeholder; ~$140 SOL

  return {
    sol: Math.round(sol * 1e9) / 1e9,
    solUsd,
    tokens,
    fetchedAt: new Date(),
  };
}

// ---------------------------------------------------------------------------
// Wallet / Transaction Error Types
// ---------------------------------------------------------------------------

export type WalletErrorCode =
  | 'WALLET_DISCONNECTED'
  | 'WALLET_REJECTED'
  | 'WRONG_NETWORK'
  | 'INSUFFICIENT_BALANCE'
  | 'MISSING_ATA'
  | 'BLOCKHASH_EXPIRED'
  | 'TX_TIMEOUT'
  | 'TX_FAILED';

export interface WalletError {
  code: WalletErrorCode;
  message: string;
  /** Safe to display to the user. */
  userMessage: string;
  /** The shortfall in human-readable token units (only for INSUFFICIENT_BALANCE). */
  shortfall?: number;
  /** The token symbol (only for INSUFFICIENT_BALANCE). */
  tokenSymbol?: string;
}

export function formatWalletError(code: WalletErrorCode, detail?: string): WalletError {
  switch (code) {
    case 'WALLET_DISCONNECTED':
      return {
        code,
        message: 'Wallet disconnected during transaction.',
        userMessage:
          'Your wallet disconnected before the transaction could be signed. Please reconnect and try again.',
      };
    case 'WALLET_REJECTED':
      return {
        code,
        message: detail ?? 'User rejected the transaction in wallet.',
        userMessage: 'Transaction was cancelled in your wallet. You can try again when ready.',
      };
    case 'WRONG_NETWORK':
      return {
        code,
        message: detail ?? 'Wallet network does not match the expected network.',
        userMessage:
          'Your wallet is connected to a different Solana network than this shop. Please switch networks to continue.',
      };
    case 'INSUFFICIENT_BALANCE':
      return {
        code,
        message: detail ?? 'Insufficient token balance to complete the payment.',
        userMessage: detail
          ? `You don't have enough tokens. ${detail}`
          : 'Insufficient token balance to complete this payment.',
      };
    case 'MISSING_ATA':
      return {
        code,
        message: detail ?? 'Destination wallet does not have a token account for this SPL token.',
        userMessage:
          'The destination wallet cannot receive this token type. The merchant may need to set up a token account first.',
      };
    case 'BLOCKHASH_EXPIRED':
      return {
        code,
        message: 'Transaction blockhash expired. The transaction took too long to confirm.',
        userMessage:
          'This payment took too long to process. Please try again — it will use a fresh transaction.',
      };
    case 'TX_TIMEOUT':
      return {
        code,
        message: detail ?? 'Transaction timed out waiting for confirmation.',
        userMessage:
          'Transaction timed out waiting for network confirmation. Your funds are safe — please check your wallet or try again.',
      };
    case 'TX_FAILED':
      return {
        code,
        message: detail ?? 'Transaction failed on-chain.',
        userMessage: detail
          ? `Transaction failed: ${detail}`
          : 'Transaction failed. No funds were transferred. Please try again.',
      };
  }
}

// ---------------------------------------------------------------------------
// Check SPL token balance for a specific mint
// ---------------------------------------------------------------------------

/**
 * Fetches the SPL token balance for a specific mint from a wallet.
 * Returns { balance, decimals, uiAmount } or null if no token account exists.
 */
export async function fetchTokenBalance(
  connection: Connection,
  ownerAddress: string,
  mintAddress: string,
): Promise<{ balance: number; decimals: number; uiAmount: number } | null> {
  const owner = new PublicKey(ownerAddress);
  const mint = new PublicKey(mintAddress);

  try {
    const ata = await getAssociatedTokenAddress(mint, owner);
    const accountInfo = await connection.getTokenAccountBalance(ata);
    return {
      balance: parseInt(accountInfo.value.amount, 10),
      decimals: accountInfo.value.decimals,
      uiAmount: accountInfo.value.uiAmount ?? 0,
    };
  } catch {
    // No token account found for this mint
    return null;
  }
}

/**
 * Checks whether a wallet has sufficient balance of a specific SPL token
 * to cover a given amount (in human-readable units, e.g. 10.50 USDC).
 *
 * Returns an error if insufficient, otherwise null (balance is sufficient).
 */
export async function checkSufficientBalance(
  connection: Connection,
  ownerAddress: string,
  mintAddress: string,
  requiredAmount: number,
  tokenSymbol?: string,
): Promise<WalletError | null> {
  const balance = await fetchTokenBalance(connection, ownerAddress, mintAddress);

  if (!balance) {
    const sym = tokenSymbol ?? 'tokens';
    return {
      ...formatWalletError('INSUFFICIENT_BALANCE'),
      shortfall: requiredAmount,
      tokenSymbol: sym,
      userMessage: `You don't have any ${sym} in your wallet.`,
    };
  }

  if (balance.uiAmount < requiredAmount) {
    const shortfall = requiredAmount - balance.uiAmount;
    const sym = tokenSymbol ?? 'tokens';
    return {
      ...formatWalletError(
        'INSUFFICIENT_BALANCE',
        `Need ${requiredAmount.toFixed(2)} ${sym}, have ${balance.uiAmount.toFixed(2)} ${sym}`,
      ),
      shortfall,
      tokenSymbol: sym,
      userMessage: `Insufficient balance: you need ${requiredAmount.toFixed(2)} ${sym} but only have ${balance.uiAmount.toFixed(2)} ${sym}. You're short by ${shortfall.toFixed(2)} ${sym}.`,
    };
  }

  return null;
}

// ---------------------------------------------------------------------------
// Network mismatch detection
// ---------------------------------------------------------------------------

/**
 * Detects whether a wallet's connected network (Cluster) matches
 * the expected cluster for the shop/page.
 */
export function detectNetworkMismatch(
  walletCluster: 'devnet' | 'mainnet-beta' | 'unknown',
  expectedCluster: 'devnet' | 'mainnet-beta',
): { mismatch: boolean; walletCluster: string; expectedCluster: string } {
  const mismatch = walletCluster !== 'unknown' && walletCluster !== expectedCluster;
  return {
    mismatch,
    walletCluster,
    expectedCluster,
  };
}

/**
 * Returns a human-readable network name for display.
 */
export function networkName(cluster: string): string {
  switch (cluster) {
    case 'mainnet-beta':
      return 'Mainnet';
    case 'devnet':
      return 'Devnet';
    case 'testnet':
      return 'Testnet';
    default:
      return cluster;
  }
}

// ---------------------------------------------------------------------------
// Blockhash expiry retry wrapper for transaction confirmation
// ---------------------------------------------------------------------------

const MAX_BLOCKHASH_RETRIES = 2;

/**
 * Error thrown when all blockhash retry attempts are exhausted.
 */
export class BlockhashRetryExhaustedError extends Error {
  constructor(
    message: string,
    public readonly attempts: number,
  ) {
    super(message);
    this.name = 'BlockhashRetryExhaustedError';
  }
}

/**
 * Wraps a transaction signing + sending operation with automatic retry
 * on BlockheightExceeded errors. The buildTransaction callback is invoked
 * on each attempt with a fresh transaction (new blockhash).
 *
 * @param connection - Solana connection
 * @param buildTransaction - callback that builds a fresh Transaction
 * @param signAndSend - callback that signs and sends the tx, returning a signature
 * @returns the transaction signature
 */
export async function sendWithBlockhashRetry(
  connection: Connection,
  buildTransaction: () => Promise<Transaction>,
  signAndSend: (tx: Transaction) => Promise<TransactionSignature>,
): Promise<TransactionSignature> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= MAX_BLOCKHASH_RETRIES; attempt++) {
    try {
      const tx = await buildTransaction();
      const sig = await signAndSend(tx);

      // Confirm the transaction
      const { blockhash, lastValidBlockHeight } =
        await connection.getLatestBlockhash('confirmed');
      await connection.confirmTransaction(
        { signature: sig, blockhash, lastValidBlockHeight },
        'confirmed',
      );

      return sig;
    } catch (err) {
      lastError = err;

      // Only retry on BlockheightExceeded — other errors propagate immediately
      if (err instanceof TransactionExpiredBlockheightExceededError) {
        if (attempt < MAX_BLOCKHASH_RETRIES) {
          console.warn(
            `[microstore] Blockhash expired (attempt ${attempt + 1}/${MAX_BLOCKHASH_RETRIES + 1}), retrying…`,
          );
          await new Promise((resolve) => setTimeout(resolve, 500));
          continue;
        }
      } else {
        // Not a blockhash error — don't retry
        throw err;
      }
    }
  }

  throw new BlockhashRetryExhaustedError(
    `Transaction failed after ${MAX_BLOCKHASH_RETRIES + 1} blockhash retries`,
    MAX_BLOCKHASH_RETRIES + 1,
  );
}