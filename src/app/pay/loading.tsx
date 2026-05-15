// Route-level loading skeleton for pay page
export default function PayLoading() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-gray-500">
      <div className="mb-4 h-10 w-10 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
      <p className="text-sm font-medium text-gray-500">Loading payment…</p>
    </div>
  );
}