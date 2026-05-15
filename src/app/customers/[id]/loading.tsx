'use client';

import { Users } from 'lucide-react';

export default function CustomerDetailLoading() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-gray-500">
      <Users className="mb-3 h-10 w-10 animate-pulse" />
      <p className="text-sm font-medium">Loading customer…</p>
    </div>
  );
}
