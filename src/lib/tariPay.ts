// ---------------------------------------------------------------------------
// Network configuration
// ---------------------------------------------------------------------------

/**
 * Supported Tari networks.
 */
export type TariNetwork = 'igor' | 'mainnet' | 'esmeralda' | 'nextnet' | 'localnet';

/**
 * Network endpoint configuration.
 */
export interface TariNetworkConfig {
  /** Human-readable name. */
  name: string;
  /** Ootle wallet daemon JSON-RPC endpoint. */
  walletDaemonUrl: string;
  /** Indexer REST API endpoint (for chain queries). */
  indexerUrl: string;
  /** Ootle address HRP (human-readable prefix), e.g. "otl_igr_". */
  addressHrp: string;
  /** Deep-link network name, per RFC-0154. */
  deepLinkNetwork: string;
}

/**
 * Network presets.
 */
export const TARI_NETWORKS: Record<TariNetwork, TariNetworkConfig> = {
  igor: {
    name: 'Igor Testnet',
    walletDaemonUrl: 'http://localhost:18103', // Wallet daemon runs locally
    indexerUrl: 'http://18.217.22.26:12502',
    addressHrp: 'otl_igr_',
    deepLinkNetwork: 'igor',
  },
  mainnet: {
    name: 'Mainnet',
    walletDaemonUrl: 'http://localhost:18103', // Placeholder — production endpoint TBD
    indexerUrl: 'https://indexer.tari.com', // Placeholder
    addressHrp: 'otl_',
    deepLinkNetwork: 'mainnet',
  },
  esmeralda: {
    name: 'Esmeralda Testnet',
    walletDaemonUrl: 'http://localhost:18103',
    indexerUrl: 'http://localhost:12502', // Placeholder
    addressHrp: 'otl_esm_',
    deepLinkNetwork: 'esmeralda',
  },
  nextnet: {
    name: 'Nextnet',
    walletDaemonUrl: 'http://localhost:18103',
    indexerUrl: 'http://localhost:12502', // Placeholder
    addressHrp: 'otl_nxt_',
    deepLinkNetwork: 'nextnet',
  },
  localnet: {
    name: 'Localnet',
    walletDaemonUrl: 'http://localhost:18103',
    indexerUrl: 'http://localhost:12502', // Placeholder
    addressHrp: 'otl_loc_',
    deepLinkNetwork: 'localnet',
  },
};

/** Default network for the microstore app. */
export const DEFAULT_TARI_NETWORK: TariNetwork = 'igor';

/**
 * Get the config for a network (defaults to Igor testnet).
 */
export function getTariNetworkConfig(network?: TariNetwork): TariNetworkConfig {
  return TARI_NETWORKS[network ?? DEFAULT_TARI_NETWORK];
}

// ---------------------------------------------------------------------------
// JSON-RPC wire types
// ---------------------------------------------------------------------------

interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: number;
  method: string;
  params: Record<string, unknown>;
}

interface JsonRpcResponse<T = unknown> {
  jsonrpc: '2.0';
  id: number;
  result?: T;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

// ---------------------------------------------------------------------------
// Tari balance types
// ---------------------------------------------------------------------------

/** Resource types supported by Ootle. */
export type TariResourceType = 'Fungible' | 'NonFungible' | 'Confidential' | 'Stealth';

/** A single token balance entry returned by `accounts.get_balances`. */
export interface TariTokenBalance {
  vaultAddress: string | null;
  resourceAddress: string;
  balance: string | number | bigint;
  resourceType: TariResourceType;
  confidentialBalance: string | number | bigint;
  tokenSymbol: string | null;
  divisibility: number;
}

/** Full balance response for an account. */
export interface TariAccountBalances {
  address: string;
  balances: TariTokenBalance[];
}

// ---------------------------------------------------------------------------
// Transaction types
// ---------------------------------------------------------------------------

/** Transaction status from the wallet daemon. */
export type TariTransactionStatus =
  | 'New'
  | 'DryRun'
  | 'Pending'
  | 'Accepted'
  | 'Rejected'
  | 'Invalid'
  | 'OnlyFeeAccepted';

/** Transaction info returned by `transactions.get`. */
export interface TariTransaction {
  transactionId: string;
  status: TariTransactionStatus;
  finalFee: number | null;
  invalidReason: string | null;
  lastUpdateTime: string;
}

// ---------------------------------------------------------------------------
// Tari Deep Link (RFC-0154)
// ---------------------------------------------------------------------------

/**
 * Parameters for generating a Tari payment deep link.
 * Mirrors the Solana Pay URL structure for consistency.
 */
export interface TariDeepLink {
  /** Recipient's Ootle address (e.g. "otl_igr_abc123..."). */
  recipient: string;
  /** Amount in microTari (1 TARI = 1,000,000 microTari). */
  amount?: bigint | number;
  /** Optional transaction note/memo. */
  note?: string;
  /** Network name (defaults to "igor"). */
  network?: string;
  /** Optional label for the payment (displayed in wallet). */
  label?: string;
  /** Ootle token resource address (e.g. "resource_0101..."). When set, the deep link targets an Ootle token transfer instead of native XTM. */
  resourceAddress?: string;
  /** Token decimal places for amount display conversion. Defaults to 6 (microTari) for native XTM. */
  divisibility?: number;
  /** Token symbol for wallet display (e.g. "XTM", "USDT"). */
  tokenSymbol?: string;
}

/**
 * Generates a Tari deep link URL per RFC-0154.
 *
 * Format: tari://{network}/transactions/send?tariAddress=X&amount=Y&resource_address=Z&note=W
 *
 * @example
 *   createTariDeepLink({
 *     recipient: "otl_igr_abc123",
 *     amount: 1_000_000n,  // 1 TARI
 *     note: "Order #42"
 *   })
 *   // => "tari://igor/transactions/send?tariAddress=otl_igr_abc123&amount=1000000&note=Order+%2342"
 */
export function createTariDeepLink(params: TariDeepLink): string {
  const network = params.network ?? 'igor';
  const queryParts: string[] = [];

  // Recipient address (required)
  queryParts.push(`tariAddress=${encodeURIComponent(params.recipient)}`);

  // Amount in microTari
  if (params.amount !== undefined) {
    queryParts.push(`amount=${params.amount.toString()}`);
  }

  // Ootle token resource address (for token transfers)
  if (params.resourceAddress) {
    queryParts.push(`resource_address=${encodeURIComponent(params.resourceAddress)}`);
  }

  // Optional note
  if (params.note) {
    queryParts.push(`note=${encodeURIComponent(params.note)}`);
  }

  // Optional label
  if (params.label) {
    queryParts.push(`label=${encodeURIComponent(params.label)}`);
  }

  const query = queryParts.join('&');
  return `tari://${network}/transactions/send?${query}`;
}

// ---------------------------------------------------------------------------
// Address validation
// ---------------------------------------------------------------------------

/**
 * Regex patterns for Ootle address validation.
 *
 * Igor format:   otl_igr_[a-zA-Z0-9]+
 * Generic:       otl_(igr|esm|nxt|stg|loc)_[a-zA-Z0-9]+
 * Mainnet:       otl_[a-zA-Z0-9]+
 *
 * Legacy TariAddress base58 format (Igor): d[1-9A-HJ-NP-Za-km-z]{64,}
 */

const OOTLE_ADDRESS_RE =
  /^otl_(igr|esm|nxt|stg|loc)_[a-zA-Z0-9]{10,}$/;
const OOTLE_MAINNET_RE = /^otl_[a-zA-Z0-9]{10,}$/;
const LEGACY_BASE58_IGOR_RE = /^d[1-9A-HJ-NP-Za-km-z]{64,}$/;
const LEGACY_BASE58_ANY_RE = /^[1-9A-HJ-NP-Za-km-z]{65,}$/;

/**
 * Validates an Ootle address format.
 * Accepts both Ootle HRP-prefixed addresses and legacy base58 TariAddresses.
 */
export function isValidTariAddress(address: string): boolean {
  if (!address || typeof address !== 'string') return false;

  return (
    OOTLE_ADDRESS_RE.test(address) ||
    OOTLE_MAINNET_RE.test(address) ||
    LEGACY_BASE58_ANY_RE.test(address)
  );
}

/**
 * Extract the network from an Ootle address HRP.
 * Returns null if the address doesn't have a recognizable HRP.
 */
export function detectNetworkFromAddress(address: string): TariNetwork | null {
  const hrpMap: Record<string, TariNetwork> = {
    otl_igr_: 'igor',
    otl_esm_: 'esmeralda',
    otl_nxt_: 'nextnet',
    otl_stg_: 'esmeralda', // stagenet mapped to esmeralda
    otl_loc_: 'localnet',
  };

  for (const [prefix, network] of Object.entries(hrpMap)) {
    if (address.startsWith(prefix)) return network;
  }

  // Check mainnet (otl_ followed by non-prefix chars)
  if (/^otl_[a-zA-Z0-9]/.test(address) && !address.startsWith('otl_igr_') &&
      !address.startsWith('otl_esm_') && !address.startsWith('otl_nxt_') &&
      !address.startsWith('otl_stg_') && !address.startsWith('otl_loc_')) {
    return 'mainnet';
  }

  // Legacy base58 Igor (starts with 'd')
  if (LEGACY_BASE58_IGOR_RE.test(address)) return 'igor';

  return null;
}

// ---------------------------------------------------------------------------
// TariConnection — JSON-RPC wrapper for Ootle wallet daemon
// ---------------------------------------------------------------------------

export class TariConnection {
  private walletDaemonUrl: string;
  private authToken: string | null;
  private nextId: number;

  constructor(config?: TariNetworkConfig) {
    const cfg = config ?? getTariNetworkConfig();
    this.walletDaemonUrl = cfg.walletDaemonUrl;
    this.authToken = null;
    this.nextId = 1;
  }

  /**
   * Set the Bearer auth token for JSON-RPC calls.
   */
  setAuthToken(token: string): void {
    this.authToken = token;
  }

  /**
   * Clear the auth token.
   */
  clearAuthToken(): void {
    this.authToken = null;
  }

  /**
   * Low-level JSON-RPC call.
   */
  private async call<T>(method: string, params: Record<string, unknown> = {}): Promise<T> {
    const id = this.nextId++;
    const body: JsonRpcRequest = {
      jsonrpc: '2.0',
      id,
      method,
      params,
    };

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.authToken) {
      headers['Authorization'] = `Bearer ${this.authToken}`;
    }

    const resp = await fetch(this.walletDaemonUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      throw new Error(
        `Tari JSON-RPC error: HTTP ${resp.status} ${resp.statusText} for method "${method}"`,
      );
    }

    const data = (await resp.json()) as JsonRpcResponse<T>;

    if (data.error) {
      throw new Error(
        `Tari JSON-RPC error ${data.error.code}: ${data.error.message} (method "${method}")`,
      );
    }

    return data.result as T;
  }

  // -----------------------------------------------------------------------
  // Balance
  // -----------------------------------------------------------------------

  /**
   * Fetch all token balances for an Ootle account address.
   *
   * Calls `accounts.get_balances` with `refresh: true`.
   *
   * @param address - The account's ComponentAddress (e.g. "component_...").
   * @returns The account balances response or null if the account is not found.
   */
  async getBalance(
    address: string,
  ): Promise<TariAccountBalances | null> {
    try {
      const result = await this.call<{
        address: string;
        balances: TariTokenBalance[];
      }>('accounts.get_balances', {
        account: address,
        refresh: true,
      });

      return {
        address: result.address,
        balances: result.balances,
      };
    } catch (err) {
      // If the account doesn't exist, return null
      if (err instanceof Error && err.message.includes('not found')) {
        return null;
      }
      throw err;
    }
  }

  /**
   * Fetch the native XTM/Tari balance for an account.
   *
   * @returns The balance in microTari (raw), or 0 if not found.
   */
  async getNativeBalance(address: string): Promise<bigint> {
    const result = await this.getBalance(address);
    if (!result) return BigInt(0);

    // The native Tari token has a well-known resource address
    const nativeResource =
      'resource_0101010101010101010101010101010101010101010101010101010101010101';

    const native = result.balances.find(
      (b) => b.resourceAddress === nativeResource,
    );

    if (!native) return BigInt(0);

    if (typeof native.balance === 'bigint') return native.balance;
    if (typeof native.balance === 'number') return BigInt(native.balance);
    // string
    return BigInt(native.balance);
  }

  // -----------------------------------------------------------------------
  // Transactions
  // -----------------------------------------------------------------------

  /**
   * Fetch transaction status by transaction ID.
   *
   * Calls `transactions.get`.
   *
   * @param transactionId - The transaction ID to look up.
   * @returns Transaction info or null if not found.
   */
  async getTransaction(
    transactionId: string,
  ): Promise<TariTransaction | null> {
    try {
      const result = await this.call<{
        transaction: { id: string };
        status: TariTransactionStatus;
        final_fee: number | null;
        invalid_reason: string | null;
        last_update_time: string;
      }>('transactions.get', {
        transaction_id: transactionId,
      });

      return {
        transactionId: result.transaction.id,
        status: result.status,
        finalFee: result.final_fee,
        invalidReason: result.invalid_reason,
        lastUpdateTime: result.last_update_time,
      };
    } catch (err) {
      if (err instanceof Error && err.message.includes('not found')) {
        return null;
      }
      throw err;
    }
  }

  // -----------------------------------------------------------------------
  // Deep links
  // -----------------------------------------------------------------------

  /**
   * Create a Tari deep link URL for a payment.
   *
   * Convenience wrapper around createTariDeepLink that uses the
   * connection's configured network.
   *
   * @example
   *   const link = connection.createDeepLink({
   *     recipient: "otl_igr_abc123",
   *     amount: 1_000_000n,
   *     note: "Order #42"
   *   });
   */
  createDeepLink(params: Omit<TariDeepLink, 'network'>): string {
    return createTariDeepLink({
      ...params,
      network: getTariNetworkConfig().deepLinkNetwork,
    });
  }
}

// ---------------------------------------------------------------------------
// QR code generation
// ---------------------------------------------------------------------------

/**
 * Renders a Tari deep link to a QR code data URL (PNG base64).
 * Mirrors the pattern from solanaPay.ts for consistency.
 *
 * @param deepLink - The Tari deep link URL string.
 * @param options - Optional rendering options.
 * @returns A base64-encoded PNG data URL.
 */
export async function generateTariQR(
  deepLink: string,
  options?: { width?: number },
): Promise<string> {
  const width = options?.width ?? 300;
  // Lazy-load qrcode (~50KB) — only imported when QR generation is needed
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { toDataURL } = await import('qrcode');
  return toDataURL(deepLink, {
    width,
    margin: 2,
    color: { dark: '#000000', light: '#ffffff' },
  });
}

// ---------------------------------------------------------------------------
// Ootle token list — indexer REST API
// ---------------------------------------------------------------------------

/**
 * Shape of a single resource returned by the indexer `/resources/tari`
 * or `/templates/cached` endpoint.
 */
interface IndexerResourceEntry {
  resource_address: string;
  token_symbol?: string;
  divisibility?: number;
  resource_type?: string;
}

/**
 * Fetches the list of known Ootle tokens from the network indexer.
 *
 * Combines the native Tari resource (`GET /resources/tari`) with cached
 * templates from the indexer (`GET /templates/cached`) to build a list of
 * tokens available on the network.
 *
 * Returns an empty array if the indexer is unreachable or returns errors.
 *
 * @param network - The Tari network to query (defaults to igor).
 * @returns A list of known token balances (with zero balance — just metadata).
 */
export async function getOotleTokenList(
  network?: TariNetwork,
): Promise<TariTokenBalance[]> {
  const cfg = getTariNetworkConfig(network);
  const results: TariTokenBalance[] = [];
  const seen = new Set<string>();

  const addEntry = (entry: IndexerResourceEntry): void => {
    if (seen.has(entry.resource_address)) return;
    seen.add(entry.resource_address);

    results.push({
      vaultAddress: null,
      resourceAddress: entry.resource_address,
      balance: 0,
      resourceType: (entry.resource_type as TariResourceType) ?? 'Fungible',
      confidentialBalance: 0,
      tokenSymbol: entry.token_symbol ?? null,
      divisibility: entry.divisibility ?? 6,
    });
  };

  /**
   * Fetch with a 3-second timeout so unreachable indexers don't hang.
   */
  const fetchWithTimeout = async (url: string): Promise<Response> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);
    try {
      return await fetch(url, { signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
  };

  try {
    // Fetch native Tari resource and cached templates in parallel
    const [nativeResp, templatesResp] = await Promise.allSettled([
      fetchWithTimeout(`${cfg.indexerUrl}/resources/tari`),
      fetchWithTimeout(`${cfg.indexerUrl}/templates/cached?limit=50`),
    ]);

    // 1. Process native Tari resource
    if (
      nativeResp.status === 'fulfilled' &&
      nativeResp.value.ok
    ) {
      const native = (await nativeResp.value.json()) as IndexerResourceEntry;
      if (native.resource_address) {
        if (!native.token_symbol) {
          native.token_symbol = 'XTM';
        }
        addEntry(native);
      }
    }

    // 2. Process cached templates
    if (
      templatesResp.status === 'fulfilled' &&
      templatesResp.value.ok
    ) {
      const data = (await templatesResp.value.json()) as
        | { templates?: IndexerResourceEntry[] }
        | IndexerResourceEntry[];

      const templates = Array.isArray(data)
        ? data
        : (data.templates ?? []);

      for (const t of templates) {
        if (t.resource_address) {
          addEntry(t);
        }
      }
    }
  } catch {
    // Should not happen — all fetch errors are caught by Promise.allSettled
  }

  return results;
}
