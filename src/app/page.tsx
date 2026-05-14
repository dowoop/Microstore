export default function HomePage() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-gray-900">Dashboard</h1>
      <p className="text-gray-600">Overview of your shops, orders, and recent activity.</p>
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border bg-white p-4">
          <div className="text-sm text-gray-500">Orders today</div>
          <div className="text-2xl font-semibold">0</div>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <div className="text-sm text-gray-500">Revenue today</div>
          <div className="text-2xl font-semibold">$0.00</div>
        </div>
      </div>
    </div>
  );
}
