export default function ItemDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-gray-900">Item Detail</h1>
      <p className="text-gray-600">View and edit item details.</p>
    </div>
  );
}
