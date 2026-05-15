'use client';

import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import {
  Search,
  ShieldCheck,
  Check,
  Plus,
  X,
  GripVertical,
  Loader2,
  AlertTriangle,
  Wallet,
  ChevronDown,
} from 'lucide-react';
import {
  getKnownTokens,
  searchKnownTokens,
  validateMint,
  type KnownToken,
} from '@/lib/solanaTokens';
import type { AcceptedToken } from '@/lib/db';
import { getConnection } from '@/lib/solanaPay';

export interface TokenPickerProps {
  selected: AcceptedToken[];
  onAdd: (token: AcceptedToken) => void;
  onRemove: (mint: string) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
  cluster?: string;
}

export default function TokenPicker({
  selected,
  onAdd,
  onRemove,
  onReorder,
  cluster = 'devnet',
}: TokenPickerProps) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCustom, setShowCustom] = useState(false);
  const knownTokens = useMemo(() => getKnownTokens(cluster), [cluster]);
  const filtered = useMemo(
    () => (searchQuery.trim() ? searchKnownTokens(searchQuery, cluster) : knownTokens),
    [searchQuery, knownTokens, cluster],
  );
  const selectedMints = useMemo(() => new Set(selected.map((t) => t.mint)), [selected]);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
        setShowCustom(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleAddToken = useCallback(
    (token: KnownToken) => {
      if (selectedMints.has(token.mint)) return;
      onAdd({
        mint: token.mint,
        symbol: token.symbol,
        decimals: token.decimals,
        name: token.name,
        logoURI: token.logoURI,
      });
      setShowDropdown(false);
      setSearchQuery('');
    },
    [onAdd, selectedMints],
  );

  const [dragIndex, setDragIndex] = useState<number | null>(null);

  return (
    <div ref={containerRef} className="space-y-3">
      <label className="block text-sm font-medium text-gray-700">Accepted tokens</label>
      {selected.length > 0 && (
        <div className="space-y-1.5">
          {selected.map((token, idx) => {
            const isKnown = knownTokens.find((t) => t.mint === token.mint);
            return (
              <div
                key={token.mint}
                draggable
                onDragStart={() => setDragIndex(idx)}
                onDragOver={(e) => {
                  e.preventDefault();
                  if (dragIndex !== null && dragIndex !== idx) {
                    onReorder(dragIndex, idx);
                    setDragIndex(idx);
                  }
                }}
                onDragEnd={() => setDragIndex(null)}
                className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 cursor-grab active:cursor-grabbing transition-colors hover:border-purple-200"
              >
                <GripVertical className="h-4 w-4 text-gray-300 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-medium text-gray-900">{token.symbol}</span>
                    {isKnown?.verified && <ShieldCheck className="h-3.5 w-3.5 text-blue-500" />}
                  </div>
                  <div className="text-[11px] text-gray-500 font-mono truncate">
                    {token.mint.slice(0, 6)}...{token.mint.slice(-4)}
                    {token.name ? ' \u00b7 ' + token.name : ''}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onRemove(token.mint)}
                  className="shrink-0 rounded-full p-1 text-gray-400 hover:text-red-500 hover:bg-red-50"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}
      {selected.length === 0 && (
        <p className="text-xs text-gray-500">
          No tokens selected. Add tokens customers can pay with.
        </p>
      )}
      <div className="relative">
        <button
          type="button"
          onClick={() => {
            setShowDropdown(!showDropdown);
            setShowCustom(false);
            setSearchQuery('');
          }}
          className="flex w-full items-center justify-between gap-2 rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-500 hover:border-purple-400 hover:text-purple-700"
        >
          <span className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Add token...
          </span>
          <ChevronDown
            className={`h-4 w-4 transition-transform ${showDropdown ? 'rotate-180' : ''}`}
          />
        </button>
        {showDropdown && (
          <div className="absolute z-20 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg max-h-80 flex flex-col">
            <div className="p-2 border-b border-gray-100">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by symbol, name, or mint..."
                  autoFocus
                  className="w-full rounded-md border border-gray-200 pl-9 pr-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-purple-400 focus:ring-1 focus:ring-purple-400/30 outline-none"
                />
              </div>
            </div>
            <div className="overflow-y-auto flex-1">
              {filtered.length === 0 && !showCustom && (
                <p className="px-4 py-3 text-sm text-gray-500 text-center">
                  No matching tokens found.
                </p>
              )}
              {filtered.map((token) => {
                const alreadySelected = selectedMints.has(token.mint);
                return (
                  <button
                    key={token.mint}
                    type="button"
                    disabled={alreadySelected}
                    onClick={() => handleAddToken(token)}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-left hover:bg-purple-50 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-purple-100 text-xs font-bold text-purple-700">
                      {token.symbol.slice(0, 3)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium text-gray-900">{token.symbol}</span>
                        {token.verified && <ShieldCheck className="h-3.5 w-3.5 text-blue-500" />}
                      </div>
                      <div className="text-xs text-gray-500 truncate">
                        {token.name} \u00b7 {token.decimals} decimals
                      </div>
                    </div>
                    {alreadySelected ? (
                      <Check className="h-4 w-4 text-green-500 shrink-0" />
                    ) : (
                      <Plus className="h-4 w-4 text-gray-300 shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
            <div className="border-t border-gray-100">
              {showCustom ? (
                <CustomTokenEntry
                  cluster={cluster}
                  selectedMints={selectedMints}
                  onAdd={onAdd}
                  onCancel={() => setShowCustom(false)}
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setShowCustom(true)}
                  className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-gray-500 hover:bg-gray-50"
                >
                  <Wallet className="h-4 w-4" />
                  Enter custom token mint...
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function CustomTokenEntry({
  cluster,
  selectedMints,
  onAdd,
  onCancel,
}: {
  cluster: string;
  selectedMints: Set<string>;
  onAdd: (token: AcceptedToken) => void;
  onCancel: () => void;
}) {
  const [mintAddress, setMintAddress] = useState('');
  const [validating, setValidating] = useState(false);
  const [valid, setValid] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tokenInfo, setTokenInfo] = useState<{
    decimals: number;
    symbol?: string;
    name?: string;
  } | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (!mintAddress.trim() || mintAddress.trim().length < 32) {
      const id = requestAnimationFrame(() => {
        setValid(null);
        setError(null);
        setTokenInfo(null);
      });
      return () => cancelAnimationFrame(id);
    }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setValidating(true);
      setValid(null);
      setError(null);
      try {
        const connection = getConnection(cluster as 'devnet' | 'mainnet-beta');
        const result = await validateMint(mintAddress.trim(), connection);
        if (result.valid) {
          setValid(true);
          setTokenInfo({
            decimals: result.decimals!,
            symbol: result.knownToken?.symbol,
            name: result.knownToken?.name,
          });
        } else {
          setValid(false);
          setError(result.error ?? 'Validation failed');
        }
      } catch {
        setValid(false);
        setError('Failed to validate mint on-chain.');
      } finally {
        setValidating(false);
      }
    }, 600);
    return () => clearTimeout(debounceRef.current);
  }, [mintAddress, cluster]);

  const handleAdd = useCallback(() => {
    if (!valid || !tokenInfo || selectedMints.has(mintAddress.trim())) return;
    onAdd({
      mint: mintAddress.trim(),
      symbol: tokenInfo.symbol ?? mintAddress.trim().slice(0, 8),
      decimals: tokenInfo.decimals,
      name: tokenInfo.name,
    });
    setMintAddress('');
    setValid(null);
    setTokenInfo(null);
  }, [valid, tokenInfo, mintAddress, selectedMints, onAdd]);

  return (
    <div className="px-4 py-3 space-y-2">
      <div className="relative">
        <input
          type="text"
          value={mintAddress}
          onChange={(e) => setMintAddress(e.target.value)}
          placeholder="Paste SPL token mint address..."
          className={`w-full rounded-md border px-3 py-2 text-sm font-mono placeholder:text-gray-400 focus:ring-1 outline-none transition-colors ${
            valid === true
              ? 'border-green-400 focus:border-green-500 focus:ring-green-400/30 pr-8'
              : valid === false
                ? 'border-red-300 focus:border-red-500 focus:ring-red-400/30 pr-8'
                : 'border-gray-200 focus:border-purple-400 focus:ring-purple-400/30'
          }`}
        />
        {validating && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-gray-400" />
        )}
        {!validating && valid === true && (
          <Check className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-green-500" />
        )}
        {!validating && valid === false && (
          <AlertTriangle className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-red-400" />
        )}
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
      {valid && tokenInfo && (
        <div className="rounded-md border border-green-200 bg-green-50 px-3 py-2">
          <p className="text-xs text-green-800">
            <span className="font-medium">{tokenInfo.symbol ?? 'Token'}</span>
            {tokenInfo.name ? ' \u00b7 ' + tokenInfo.name : ''} \u00b7 {tokenInfo.decimals} decimals
          </p>
          <p className="text-[10px] text-green-600/70 font-mono mt-0.5">
            {mintAddress.trim().slice(0, 12)}...{mintAddress.trim().slice(-8)}
          </p>
        </div>
      )}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleAdd}
          disabled={!valid || selectedMints.has(mintAddress.trim())}
          className="flex-1 rounded-md bg-purple-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-purple-700 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Add token
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-gray-200 px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
