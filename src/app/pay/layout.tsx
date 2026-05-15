import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Pay with Solana — Microstore',
  description:
    'Pay with your Solana wallet. Fast, low-fee payments powered by Solana Pay. Scan the QR code to complete your purchase.',
  openGraph: {
    title: 'Pay with Solana — Microstore',
    description:
      'Complete your payment with Solana. Fast, secure, and low fees.',
    siteName: 'Microstore',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'Pay with Solana — Microstore',
    description: 'Scan to pay with your Solana wallet.',
  },
};

export default function PayLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}