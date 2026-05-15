// ---------------------------------------------------------------------------
// Global Loading State (Next.js App Router loading.tsx)
// Shown during page transitions and initial route loads.
// ---------------------------------------------------------------------------

export default function GlobalLoading() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-gray-500">
      <div className="mb-4 h-10 w-10 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
      <p className="text-sm font-medium text-gray-500">Loading…</p>
    </div>
  );
}
