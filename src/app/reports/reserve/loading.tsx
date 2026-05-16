// Route-level loading skeleton for reserve report
export default function ReserveReportLoading() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-gray-500">
      <div className="mb-3 h-8 w-48 animate-pulse rounded bg-gray-200" />
      <p className="text-sm font-medium text-gray-500">Loading reserve report…</p>
    </div>
  );
}
