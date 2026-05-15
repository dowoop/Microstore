'use client';

import { useState, useCallback, useEffect } from 'react';
import {
  Wallet,
  RefreshCw,
  Copy,
  Check,
  Network,
} from 'lucide-react';
import {
  TariConnection,
  getTariNetworkConfig,
  isValidTariAddress,
  type TariTokenBalance,
  type TariNetwork,
} from '@/lib/tariPay';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TariWalletSectionProps {
  tariWallet: string;
  tariNetwork: TariNetwork;
}

interface DisplayBalance {
  symbol: string;
  balance: string;
  resourceAddress: string;
  resourceType: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Convert a raw token balance to a display string using the token's divisibility.
 */
function formatBalance(
  rawBalance: string | number | bigint,
  divisibility: number,
  symbol: string,
): string {
  let bn: bigint;
  if (typeof rawBalance === 'bigint') bn = rawBalance;
  else if (typeof rawBalance === 'number') bn = BigInt(Math.floor(rawBalance));
  else bn = BigInt(rawBalance);

  if (bn === BigInt(0)) return `0 ${symbol}`;

  const divisor = BigInt(10 ** divisibility);
  const whole = bn / divisor;
  const frac = bn % divisor;
  const fracStr = frac.toString().padStart(divisibility, '0').replace(/0+$/, '');

  if (fracStr === '') return `${whole.toLocaleString()} ${symbol}`;
  return `${whole.toLocaleString()}.${fracStr} ${symbol}`;
}

function truncateAddress(addr: string): string {
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-6)}`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function TariWalletSection({
  tariWallet,
  tariNetwork,
}: TariWalletSectionProps) {
  const [balances, setBalances] = useState<DisplayBalance[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const networkConfig = getTariNetworkConfig(tariNetwork);
  const valid = isValidTariAddress(tariWallet);

  // -----------------------------------------------------------------------
  // Fetch balances
  // -----------------------------------------------------------------------

  const refreshBalances = useCallback(async () => {
    if (!valid) return;
    setLoading(true);
    setError(null);

    try {
      const conn = new TariConnection(networkConfig);
      const raw = await conn.getBalance(tariWallet);

      if (!raw || raw.balances.length === 0) {
        setBalances([]);
        setError('No balances found for this address.');
        return;
      }

      const display: DisplayBalance[] = raw.balances.map((tb: TariTokenBalance) => {
        const symbol = tb.tokenSymbol ?? '???';
        // Determine divisibility
        const div = tb.divisibility;
        return {
          symbol,
          balance: formatBalance(tb.balance, div, symbol),
          resourceAddress: tb.resourceAddress,
          resourceType: tb.resourceType,
        };
      });

      setBalances(display);
    } catch (err) {
      console.error('Tari balance fetch error:', err);
      setError(
        err instanceof Error
          ? `Failed: ${err.message}`
          : 'Failed to fetch Tari balances.',
      );
    } finally {
      setLoading(false);
    }
  }, [valid, tariWallet, networkConfig]);

  // Auto-refresh on mount
  useEffect(() => {
    if (valid) {
      const id = requestAnimationFrame(() => refreshBalances());
      return () => cancelAnimationFrame(id);
    }
  }, [valid]); // eslint-disable-line react-hooks/exhaustive-deps

  // -----------------------------------------------------------------------
  // Copy address
  // -----------------------------------------------------------------------

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(tariWallet);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const ta = document.createElement('textarea');
      ta.value = tariWallet;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <div className="rounded-lg border border-emerald-200 bg-white p-3">
      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <Wallet className="h-4 w-4 text-emerald-600" />
          <span className="text-sm font-medium text-gray-900">
            Tari Wallet
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {/* Network badge */}
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
            <Network className="h-2.5 w-2.5" />
            {networkConfig.name}
          </span>
          {/* Refresh */}
          <button
            onClick={refreshBalances}
            disabled={loading || !valid}
            className="inline-flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-800 disabled:opacity-50"
          >
            <RefreshCw
              className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`}
            />
            Refresh
          </button>
        </div>
      </div>

      {/* Address */}
      <div className="flex items-center gap-2 mb-1.5">
        <span className="font-mono text-[10px] text-gray-500 truncate flex-1">
          {tariWallet}
        </span>
        <button
          onClick={handleCopy}
          className="shrink-0 text-gray-400 hover:text-emerald-600 transition-colors"
          title="Copy address"
        >
          {copied ? (
            <Check className="h-3 w-3 text-green-500" />
          ) : (
            <Copy className="h-3 w-3" />
          )}
        </button>
      </div>

      {/* Invalid address warning */}
      {!valid && (
        <p className="text-xs text-amber-600">
          Address format not recognized. Balances will not be fetched.
        </p>
      )}

      {/* Error */}
      {error && (
        <div className="mt-1 rounded-md bg-red-50 px-2 py-1">
          <p className="text-xs text-red-600">{error}</p>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
          <RefreshCw className="h-3 w-3 animate-spin" />
          Fetching balances…
        </div>
      )}

      {/* Balances */}
      {!loading && balances.length > 0 && (
        <div className="space-y-0.5 mt-1">
          {balances.map((b, i) => (
            <div
              key={b.resourceAddress || i}
              className="flex items-baseline gap-2 text-xs"
            >
              <span className="font-medium text-gray-900">{b.balance}</span>
              <span className="text-[10px] text-gray-400 font-mono">
                {truncateAddress(b.resourceAddress)}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* No balances (after load) */}
      {!loading && !error && balances.length === 0 && valid && !loading && (
        <p className="text-xs text-gray-500 italic mt-1">
          Tap Refresh to load Tari balances.
        </p>
      )}
    </div>
  );
}
