export default function ItemsPage() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Items</h1>
        <a href="/items/new" className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white">Add item</a>
      </div>
      <p className="text-gray-600">Manage inventory and products.</p>
    </div>
  );
}
