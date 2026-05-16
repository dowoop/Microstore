'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * /reports/tax has been renamed to /reports/reserve.
 * This page redirects transparently.
 */
export default function TaxReportRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/reports/reserve');
  }, [router]);

  return (
    <div className="flex flex-col items-center justify-center py-20 text-gray-500">
      <p className="text-sm">Redirecting to reserve report…</p>
    </div>
  );
}
