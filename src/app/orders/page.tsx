export default function OrdersPage() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Orders</h1>
        <a href="/orders/new" className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white">New order</a>
      </div>
      <p className="text-gray-600">Track and manage orders.</p>
    </div>
  );
}
