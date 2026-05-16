import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { RootShell } from '@/components/root-shell';
import { AppWalletProvider } from '@/components/WalletProvider';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Microstore',
  description: 'Merchant management app — POS, inventory, and Solana payments',
  manifest: '/manifest.json',
  icons: {
    icon: '/icons/icon-192.svg',
    apple: '/icons/apple-touch-icon.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Microstore',
  },
  other: {
    'theme-color': '#2563eb',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <a href="#main-content" className="skip-to-content">
          Skip to content
        </a>
        <AppWalletProvider>
          <RootShell>{children}</RootShell>
        </AppWalletProvider>
      </body>
    </html>
  );
}
