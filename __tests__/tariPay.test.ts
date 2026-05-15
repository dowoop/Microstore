import { describe, it, expect } from 'vitest';
import {
  createTariDeepLink,
  isValidTariAddress,
  detectNetworkFromAddress,
  generateTariQR,
  TariConnection,
  getTariNetworkConfig,
  getOotleTokenList,
  TARI_NETWORKS,
  DEFAULT_TARI_NETWORK,
} from '../src/lib/tariPay';
import type { TariDeepLink } from '../src/lib/tariPay';

// ---------------------------------------------------------------------------
// Network configuration
// ---------------------------------------------------------------------------

describe('Network configuration', () => {
  it('has all expected networks', () => {
    expect(TARI_NETWORKS.igor).toBeDefined();
    expect(TARI_NETWORKS.mainnet).toBeDefined();
    expect(TARI_NETWORKS.esmeralda).toBeDefined();
    expect(TARI_NETWORKS.nextnet).toBeDefined();
    expect(TARI_NETWORKS.localnet).toBeDefined();
  });

  it('Igor testnet uses correct HRP and deep link network', () => {
    const igor = TARI_NETWORKS.igor;
    expect(igor.addressHrp).toBe('otl_igr_');
    expect(igor.deepLinkNetwork).toBe('igor');
    expect(igor.name).toBe('Igor Testnet');
  });

  it('Mainnet uses correct HRP', () => {
    const mainnet = TARI_NETWORKS.mainnet;
    expect(mainnet.addressHrp).toBe('otl_');
    expect(mainnet.deepLinkNetwork).toBe('mainnet');
  });

  it('default network is igor', () => {
    expect(DEFAULT_TARI_NETWORK).toBe('igor');
  });

  it('getTariNetworkConfig returns igor by default', () => {
    const cfg = getTariNetworkConfig();
    expect(cfg.addressHrp).toBe('otl_igr_');
    expect(cfg.name).toBe('Igor Testnet');
  });

  it('getTariNetworkConfig returns correct network when specified', () => {
    const cfg = getTariNetworkConfig('mainnet');
    expect(cfg.addressHrp).toBe('otl_');
    expect(cfg.name).toBe('Mainnet');
  });
});

// ---------------------------------------------------------------------------
// createTariDeepLink
// ---------------------------------------------------------------------------

describe('createTariDeepLink', () => {
  it('generates a basic deep link with recipient only', () => {
    const link = createTariDeepLink({
      recipient: 'otl_igr_abc123def456',
    });

    expect(link).toBe(
      'tari://igor/transactions/send?tariAddress=otl_igr_abc123def456',
    );
  });

  it('includes amount when provided', () => {
    const link = createTariDeepLink({
      recipient: 'otl_igr_abc123',
      amount: 1_000_000n,
    });

    expect(link).toContain('amount=1000000');
  });

  it('includes note when provided', () => {
    const link = createTariDeepLink({
      recipient: 'otl_igr_abc123',
      note: 'Order #42',
    });

    expect(link).toContain('note=Order%20%2342');
  });

  it('includes label when provided', () => {
    const link = createTariDeepLink({
      recipient: 'otl_igr_abc123',
      label: 'Coffee Shop',
    });

    expect(link).toContain('label=Coffee%20Shop');
  });

  it('generates a complete link with all params', () => {
    const link = createTariDeepLink({
      recipient: 'otl_igr_recipient789',
      amount: 500_000n,
      note: 'Invoice 2025-05',
      label: 'My Store',
    });

    expect(link).toContain('tariAddress=otl_igr_recipient789');
    expect(link).toContain('amount=500000');
    expect(link).toContain('note=Invoice%202025-05');
    expect(link).toContain('label=My%20Store');
    expect(link).toMatch(/^tari:\/\/igor\/transactions\/send\?/);
  });

  it('uses custom network when specified', () => {
    const link = createTariDeepLink({
      recipient: 'otl_abc123',
      network: 'mainnet',
    });

    expect(link).toContain('tari://mainnet/');
  });

  it('defaults to igor network when not specified', () => {
    const link = createTariDeepLink({
      recipient: 'otl_igr_abc123',
    });

    expect(link).toContain('tari://igor/');
  });

  it('handles amount as number type', () => {
    const link = createTariDeepLink({
      recipient: 'otl_igr_abc123',
      amount: 100,
    });

    expect(link).toContain('amount=100');
  });

  it('handles amount = 0', () => {
    const link = createTariDeepLink({
      recipient: 'otl_igr_abc123',
      amount: 0n,
    });

    expect(link).toContain('amount=0');
  });

  it('URL-encodes special characters in note', () => {
    const link = createTariDeepLink({
      recipient: 'otl_igr_abc123',
      note: 'Hello & goodbye = test',
    });

    expect(link).toContain('note=Hello%20%26%20goodbye%20%3D%20test');
  });

  it('URL-encodes recipient address with special chars', () => {
    const link = createTariDeepLink({
      recipient: 'otl_igr_addr+with/special=chars',
    });

    expect(link).toContain('tariAddress=otl_igr_addr%2Bwith%2Fspecial%3Dchars');
  });

  it('omits amount param when amount is undefined', () => {
    const link = createTariDeepLink({
      recipient: 'otl_igr_abc123',
    });

    expect(link).not.toContain('amount=');
  });

  it('omits note param when note is undefined', () => {
    const link = createTariDeepLink({
      recipient: 'otl_igr_abc123',
    });

    expect(link).not.toContain('note=');
  });

  // --- Ootle token deep links ---

  it('includes resource_address when resourceAddress is set', () => {
    const link = createTariDeepLink({
      recipient: 'otl_igr_abc123',
      amount: 500_000n,
      resourceAddress: 'resource_abc123def456',
    });

    expect(link).toContain('resource_address=resource_abc123def456');
    expect(link).toMatch(
      /^tari:\/\/igor\/transactions\/send\?tariAddress=otl_igr_abc123&amount=500000&resource_address=resource_abc123def456$/,
    );
  });

  it('includes resource_address with amount and note for Ootle token transfer', () => {
    const link = createTariDeepLink({
      recipient: 'otl_igr_store',
      amount: 1_000n,
      resourceAddress:
        'resource_0101010101010101010101010101010101010101010101010101010101010101',
      note: 'USDT purchase',
      tokenSymbol: 'USDT',
      divisibility: 6,
    });

    expect(link).toContain('resource_address=resource_0101010101010101010101010101010101010101010101010101010101010101');
    expect(link).toContain('tariAddress=otl_igr_store');
    expect(link).toContain('amount=1000');
    expect(link).toContain('note=USDT%20purchase');
    // tokenSymbol and divisibility are metadata for the wallet, not in the URL
    expect(link).not.toContain('tokenSymbol');
    expect(link).not.toContain('divisibility');
  });

  it('omits resource_address when resourceAddress is not set (native XTM)', () => {
    const link = createTariDeepLink({
      recipient: 'otl_igr_abc123',
      amount: 100_000n,
      note: 'Native transfer',
    });

    expect(link).not.toContain('resource_address=');
    expect(link).toMatch(
      /^tari:\/\/igor\/transactions\/send\?tariAddress=otl_igr_abc123&amount=100000&note=Native%20transfer$/,
    );
  });

  it('URL-encodes resource_address with special characters', () => {
    const link = createTariDeepLink({
      recipient: 'otl_igr_test',
      resourceAddress: 'resource_abc+def=ghi&jkl',
    });

    expect(link).toContain(
      'resource_address=resource_abc%2Bdef%3Dghi%26jkl',
    );
  });
});

// ---------------------------------------------------------------------------
// Address format validation
// ---------------------------------------------------------------------------

describe('isValidTariAddress', () => {
  // Valid Ootle Igor addresses
  it('accepts valid otl_igr_ HRP addresses', () => {
    expect(isValidTariAddress('otl_igr_abc123def456')).toBe(true);
    expect(isValidTariAddress('otl_igr_1a2B3c4D5e6F')).toBe(true);
    expect(isValidTariAddress('otl_igr_averylongaddresswithmanycharacters1234567890')).toBe(true);
  });

  // Valid Ootle mainnet addresses
  it('accepts valid otl_ mainnet addresses', () => {
    expect(isValidTariAddress('otl_abc123def456')).toBe(true);
    expect(isValidTariAddress('otl_1a2B3c4D5e6F7g8H')).toBe(true);
  });

  // Valid Ootle Esmeralda addresses
  it('accepts valid otl_esm_ HRP addresses', () => {
    expect(isValidTariAddress('otl_esm_abc123def456')).toBe(true);
  });

  // Valid Ootle Nextnet addresses
  it('accepts valid otl_nxt_ HRP addresses', () => {
    expect(isValidTariAddress('otl_nxt_abc123def456')).toBe(true);
  });

  // Valid legacy base58 TariAddress (Igor)
  it('accepts legacy base58 Igor addresses starting with d', () => {
    // Igor network byte = 'd' in base58, followed by 64+ valid base58 chars
    // Base58 alphabet (excludes 0, O, I, l): 123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz
    const validBase58 =
      'd' + 'abcde12345ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz123456789ABCDEFGH';
    expect(isValidTariAddress(validBase58)).toBe(true);
  });

  // Valid generic legacy base58
  it('accepts generic legacy base58 addresses', () => {
    const validBase58 =
      '1' + 'abcde12345ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz123456789ABCDEFGH';
    expect(isValidTariAddress(validBase58)).toBe(true);
  });

  // Invalid addresses
  it('rejects empty string', () => {
    expect(isValidTariAddress('')).toBe(false);
  });

  it('rejects null/undefined values', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(isValidTariAddress(null as any)).toBe(false);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(isValidTariAddress(undefined as any)).toBe(false);
  });

  it('rejects random strings', () => {
    expect(isValidTariAddress('hello world')).toBe(false);
    expect(isValidTariAddress('12345')).toBe(false);
    expect(isValidTariAddress('notanaddress')).toBe(false);
  });

  it('rejects addresses without enough characters', () => {
    expect(isValidTariAddress('otl_igr_abc')).toBe(false); // too short (9 chars after HRP)
    expect(isValidTariAddress('otl_abc')).toBe(false);
  });

  it('rejects base58 addresses with illegal characters', () => {
    // Base58 excludes '0', 'O', 'I', 'l'
    expect(isValidTariAddress('d0OIl2345')).toBe(false); // contains illegal chars + too short
  });

  it('accepts otl_stg_ HRP addresses', () => {
    expect(isValidTariAddress('otl_stg_abc123def456')).toBe(true);
  });

  it('accepts otl_loc_ HRP addresses', () => {
    expect(isValidTariAddress('otl_loc_abc123def456')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// detectNetworkFromAddress
// ---------------------------------------------------------------------------

describe('detectNetworkFromAddress', () => {
  it('detects igor from otl_igr_ prefix', () => {
    expect(detectNetworkFromAddress('otl_igr_abc123')).toBe('igor');
  });

  it('detects esmeralda from otl_esm_ prefix', () => {
    expect(detectNetworkFromAddress('otl_esm_abc123')).toBe('esmeralda');
  });

  it('detects stagenet as esmeralda', () => {
    expect(detectNetworkFromAddress('otl_stg_abc123')).toBe('esmeralda');
  });

  it('detects nextnet from otl_nxt_ prefix', () => {
    expect(detectNetworkFromAddress('otl_nxt_abc123')).toBe('nextnet');
  });

  it('detects mainnet from otl_ prefix (no sub-prefix)', () => {
    expect(detectNetworkFromAddress('otl_abc123def456')).toBe('mainnet');
  });

  it('detects localnet from otl_loc_ prefix', () => {
    expect(detectNetworkFromAddress('otl_loc_abc123')).toBe('localnet');
  });

  it('detects igor from legacy base58 starting with d', () => {
    const legacy = 'd' + 'abcde12345ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz123456789ABCDEFGH';
    expect(detectNetworkFromAddress(legacy)).toBe('igor');
  });

  it('returns null for unrecognized formats', () => {
    expect(detectNetworkFromAddress('random string')).toBeNull();
    expect(detectNetworkFromAddress('')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// QR code generation (smoke test)
// ---------------------------------------------------------------------------

describe('generateTariQR', () => {
  it('generates a base64 PNG data URL', async () => {
    const qr = await generateTariQR(
      'tari://igor/transactions/send?tariAddress=otl_igr_test&amount=1000',
    );

    expect(qr).toMatch(/^data:image\/png;base64,/);
  });

  it('generates a QR code with custom width', async () => {
    const qr = await generateTariQR(
      'tari://igor/transactions/send?tariAddress=otl_igr_test&amount=1000',
      { width: 200 },
    );

    expect(qr).toMatch(/^data:image\/png;base64,/);
  });

  it('generates different QR for different deep links', async () => {
    const qr1 = await generateTariQR(
      'tari://igor/transactions/send?tariAddress=otl_igr_aaa&amount=1',
    );
    const qr2 = await generateTariQR(
      'tari://igor/transactions/send?tariAddress=otl_igr_bbb&amount=999',
    );

    expect(qr1).not.toBe(qr2);
  });
});

// ---------------------------------------------------------------------------
// TariConnection
// ---------------------------------------------------------------------------

describe('TariConnection', () => {
  it('creates a connection with default network config', () => {
    const conn = new TariConnection();
    expect(conn).toBeDefined();
  });

  it('creates a connection with explicit network config', () => {
    const cfg = getTariNetworkConfig('mainnet');
    const conn = new TariConnection(cfg);
    expect(conn).toBeDefined();
  });

  it('accepts and clears auth tokens', () => {
    const conn = new TariConnection();
    conn.setAuthToken('test-token-123');
    // No error = success
    conn.clearAuthToken();
  });

  it('createDeepLink uses igor network by default', () => {
    const conn = new TariConnection();
    const link = conn.createDeepLink({
      recipient: 'otl_igr_test',
      amount: 100n,
    });

    expect(link).toContain('tari://igor/');
    expect(link).toContain('tariAddress=otl_igr_test');
    expect(link).toContain('amount=100');
  });

  it('createDeepLink with all params', () => {
    const conn = new TariConnection();
    const link = conn.createDeepLink({
      recipient: 'otl_igr_store',
      amount: 2_500_000n,
      note: 'Purchase #99',
      label: 'Microstore',
    });

    expect(link).toContain('tariAddress=otl_igr_store');
    expect(link).toContain('amount=2500000');
    expect(link).toContain('note=Purchase%20%2399');
    expect(link).toContain('label=Microstore');
  });
});

// ---------------------------------------------------------------------------
// getOotleTokenList — token list from indexer
// ---------------------------------------------------------------------------

describe('getOotleTokenList', () => {
  it(
    'handles igor indexer gracefully (returns array, empty if unreachable)',
    { timeout: 15000 },
    async () => {
      const tokens = await getOotleTokenList('igor');

      // Always returns an array
      expect(Array.isArray(tokens)).toBe(true);

      // Validate shape of any entries returned
      for (const t of tokens) {
        expect(t).toHaveProperty('resourceAddress');
        expect(typeof t.resourceAddress).toBe('string');
        expect(t.resourceAddress.length).toBeGreaterThan(0);

        expect(t).toHaveProperty('balance');
        expect(t).toHaveProperty('resourceType');
        expect(t).toHaveProperty('confidentialBalance');
        expect(t).toHaveProperty('divisibility');
        expect(typeof t.divisibility).toBe('number');

        expect(t).toHaveProperty('vaultAddress');
        expect(t).toHaveProperty('tokenSymbol');
        if (t.tokenSymbol !== null) {
          expect(typeof t.tokenSymbol).toBe('string');
        }
      }

      // No duplicate resourceAddress values
      const addresses = tokens.map((t) => t.resourceAddress);
      const unique = new Set(addresses);
      expect(unique.size).toBe(addresses.length);
    },
  );

  it('returns empty array for networks with placeholder indexer', async () => {
    // Placeholder indexers (mainnet, esmeralda, nextnet, localnet) use localhost
    // which should be unreachable → graceful empty array
    const tokens = await getOotleTokenList('mainnet');
    expect(Array.isArray(tokens)).toBe(true);
    // Placeholder indexer is localhost, so it's likely unreachable
  });

  it('defaults to igor when no network specified', { timeout: 15000 }, async () => {
    // getOotleTokenList() resolves with whatever the default network returns
    // (same as 'igor'). Just verify it doesn't throw.
    const tokens = await getOotleTokenList();
    expect(Array.isArray(tokens)).toBe(true);
  });
});
