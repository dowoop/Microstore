import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
  clusterApiUrl,
  type Cluster,
} from '@solana/web3.js';
import {
  createTransferCheckedInstruction,
  getAssociatedTokenAddress,
  getMint,
  TOKEN_PROGRAM_ID,
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