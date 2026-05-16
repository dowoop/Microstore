# Network Compatibility

Supported chains, networks, and prerequisites for Microstore payment processing.

## Compatibility Matrix

| Chain   | Mainnet        | Testnet        | Devnet        | Localnet       |
|---------|----------------|----------------|---------------|----------------|
| Solana  | Production     | Not supported  | Testing only  | Not supported  |
| Tari    | Planned        | Testing only   | Testing only  | Testing only   |

### Network Details

**Solana**
- **Mainnet**: `mainnet-beta` — production-ready. Uses Helius RPC when `NEXT_PUBLIC_HELIUS_API_KEY` is set; falls back to public `api.mainnet-beta.solana.com` otherwise. SPL tokens: USDC, USDT, PYUSD.
- **Devnet**: `devnet` — testing and development. Uses Helius devnet RPC when API key is set; falls back to public `api.devnet.solana.com`. Ideal for pre-mainnet integration testing.

**Tari**
- **Mainnet**: Placeholder endpoints — not yet production-ready. Wallet daemon and indexer URLs are TBD. Marked as planned.
- **Igor** (mapped to Testnet column): Default Tari testnet. Fully configured with public indexer (`18.217.22.26:12502`). Deep link network: `igor`. Address HRP: `otl_igr_`. Native XTM + Ootle tokens via `resource_address`.
- **Esmeralda** (mapped to Testnet column): Secondary Tari testnet. Wallet daemon at `localhost:18103`, indexer placeholder at `localhost:12502`. Deep link network: `esmeralda`. Address HRP: `otl_esm_`.
- **Nextnet** (mapped to Devnet column): Tari development network. Local-only indexer (placeholder). Deep link network: `nextnet`. Address HRP: `otl_nxt_`.
- **Localnet** (mapped to Localnet column): Fully local Tari network for offline development. Deep link network: `localnet`. Address HRP: `otl_loc_`.

> **Note**: All Tari networks communicate with an Ootle wallet daemon running locally at `http://localhost:18103`. The daemon abstracts network routing — the app does not connect to remote Tari nodes directly.

## Prerequisites

### Solana

- **Helius API key** (optional, recommended): Set `NEXT_PUBLIC_HELIUS_API_KEY` in `.env.local` for enhanced RPC connectivity and token balance lookups. Get a key at [dev.helius.xyz/dashboard](https://dev.helius.xyz/dashboard). When unset, the app falls back to Solana's public cluster endpoints, which have lower rate limits and no token enrichment.
- **RPC endpoint**: Configurable via `NEXT_PUBLIC_SOLANA_CLUSTER` (`devnet` or `mainnet-beta`, defaults to `devnet`). The `getConnection()` helper in `src/lib/solanaPay.ts` selects the appropriate Helius or public endpoint automatically.
- **Wallet**: Customer needs a Solana wallet (Phantom, Solflare, Backpack) to sign transactions.

### Tari

- **Ootle wallet daemon**: Must be running locally at `http://localhost:18103`. The daemon provides JSON-RPC access to balances, transactions, and deep link generation. Without it, Tari payment features are unavailable.
- **Auth token** (optional): The `TariConnection` class supports an optional Bearer token for authenticated JSON-RPC calls. Set via `connection.setAuthToken(token)` if your daemon requires authentication.
- **Wallet**: Customer needs a Tari-compatible wallet that supports RFC-0154 deep links (`tari://` URL scheme) for scanning and signing payment QR codes.

## Implementation Reference

| File | Purpose |
|------|---------|
| `src/lib/solanaPay.ts` | Solana `getConnection()`, cluster selection, Helius RPC fallback logic |
| `src/lib/tariPay.ts` | `TARI_NETWORKS` config, `TariConnection` JSON-RPC wrapper, deep link generation |
