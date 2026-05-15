'use client';

import { useMemo, type ReactNode } from 'react';
import {
  ConnectionProvider,
  WalletProvider,
} from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { PhantomWalletAdapter, SolflareWalletAdapter } from '@solana/wallet-adapter-wallets';
import { clusterApiUrl } from '@solana/web3.js';

// Import wallet adapter styles
import '@solana/wallet-adapter-react-ui/styles.css';

interface AppWalletProviderProps {
  children: ReactNode;
  cluster?: 'devnet' | 'mainnet-beta';
}

export function AppWalletProvider({
  children,
  cluster = 'devnet',
}: AppWalletProviderProps) {
  const endpoint = useMemo(() => {
    // Prefer Helius if configured, fall back to public RPC
    const heliusKey = process.env.NEXT_PUBLIC_HELIUS_API_KEY;
    if (heliusKey) {
      const base =
        cluster === 'mainnet-beta'
          ? 'https://mainnet.helius-rpc.com'
          : 'https://devnet.helius-rpc.com';
      return `${base}/?api-key=${heliusKey}`;
    }
    return clusterApiUrl(cluster === 'mainnet-beta' ? 'mainnet-beta' : 'devnet');
  }, [cluster]);

  const wallets = useMemo(
    () => [new PhantomWalletAdapter(), new SolflareWalletAdapter()],
    [],
  );

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
