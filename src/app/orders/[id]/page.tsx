export default function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-gray-900">Order Detail</h1>
      <p className="text-gray-600">View order details and status.</p>
    </div>
  );
}
