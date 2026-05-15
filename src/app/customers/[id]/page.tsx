'use client';
import { useState, useMemo, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Phone, Calendar, DollarSign, ShoppingCart, Clock, Edit3, Save, X, ChevronRight } from 'lucide-react';
import { db } from '@/lib/db';
import { useAppStore } from '@/lib/store';

function formatDate(date: Date): string { return new Date(date).toLocaleDateString('en-US', { year:'numeric', month:'short', day:'numeric' }); }
function formatDateTime(date: Date): string { return new Date(date).toLocaleString('en-US', { year:'numeric', month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' }); }

export default function CustomerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { activeShopId } = useAppStore();
  const customerId = Number(params.id);
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesDraft, setNotesDraft] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);

  const customer = useLiveQuery(() => db.customers.get(customerId), [customerId]);
  const orders = useLiveQuery(() => activeShopId ? db.orders.where('shopId').equals(activeShopId).toArray() : [], [activeShopId]);

  const customerOrders = useMemo(() => {
    if (!orders || !customer) return [];
    return orders.filter((o: any) => (o.customerId && o.customerId===customer.id) || (!o.customerId && o.customerName?.toLowerCase()===customer.name.toLowerCase() && (o.customerPhone===customer.phone||(!o.customerPhone&&!customer.phone)))).sort((a:any,b:any)=>new Date(b.createdAt).getTime()-new Date(a.createdAt).getTime());
  }, [orders, customer]);

  const stats = useMemo(() => {
    const completed = customerOrders.filter((o:any)=>o.status!=='cancelled');
    const totalSpent = completed.reduce((s:number,o:any)=>s+o.total,0);
    const lastVisit = customerOrders.length>0?new Date(Math.max(...customerOrders.map((o:any)=>new Date(o.createdAt).getTime()))):null;
    return {totalSpent, orderCount:customerOrders.length, avgOrderValue:completed.length>0?totalSpent/completed.length:0, lastVisit};
  }, [customerOrders]);

  const handleSaveNotes = useCallback(async () => {
    if (!customer) return;
    setSavingNotes(true);
    try { await db.customers.update(customer.id, { notes: notesDraft }); setEditingNotes(false); }
    catch(e) { console.error(e); }
    finally { setSavingNotes(false); }
  }, [customer, notesDraft]);

  if (!customer) return <div className="flex flex-col items-center justify-center py-20 text-gray-500"><p className="text-sm font-medium">Customer not found</p><Link href="/customers" className="mt-2 text-sm text-blue-600 hover:underline">Back to customers</Link></div>;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3"><button onClick={()=>router.back()} className="rounded-full p-2 -ml-2 text-gray-500 hover:bg-gray-100"><ArrowLeft className="h-5 w-5"/></button><div className="flex-1"><h1 className="text-xl font-bold text-gray-900">{(customer as any).name}</h1><p className="text-sm text-gray-500">Customer profile</p></div></div>
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="bg-blue-50 px-4 py-5 flex items-center gap-4"><div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-blue-600 text-lg font-bold text-white">{(customer as any).name.split(' ').map((n:string)=>n[0]).join('').toUpperCase().slice(0,2)}</div><div><h2 className="text-lg font-bold text-gray-900">{(customer as any).name}</h2>{(customer as any).phone&&<p className="text-sm text-gray-600 flex items-center gap-1 mt-0.5"><Phone className="h-3.5 w-3.5"/>{(customer as any).phone}</p>}</div></div>
        <div className="grid grid-cols-2 gap-px bg-gray-100">
          <div className="bg-white px-4 py-3"><p className="text-[11px] text-gray-500 flex items-center gap-1"><DollarSign className="h-3 w-3"/>Total spent</p><p className="mt-0.5 text-sm font-semibold text-gray-900">${stats.totalSpent.toFixed(2)}</p></div>
          <div className="bg-white px-4 py-3"><p className="text-[11px] text-gray-500 flex items-center gap-1"><ShoppingCart className="h-3 w-3"/>Orders</p><p className="mt-0.5 text-sm font-semibold text-gray-900">{stats.orderCount}</p></div>
          <div className="bg-white px-4 py-3"><p className="text-[11px] text-gray-500 flex items-center gap-1"><DollarSign className="h-3 w-3"/>Avg. order</p><p className="mt-0.5 text-sm font-semibold text-gray-900">${stats.avgOrderValue.toFixed(2)}</p></div>
          <div className="bg-white px-4 py-3"><p className="text-[11px] text-gray-500 flex items-center gap-1"><Calendar className="h-3 w-3"/>Last visit</p><p className="mt-0.5 text-sm font-semibold text-gray-900">{stats.lastVisit?formatDate(stats.lastVisit):'—'}</p></div>
        </div>
        <div className="px-4 py-3 border-t border-gray-100">
          <div className="flex items-center justify-between mb-2"><h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Notes</h3>{!editingNotes&&<button onClick={()=>{setNotesDraft((customer as any).notes??'');setEditingNotes(true)}} className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"><Edit3 className="h-3 w-3"/>{(customer as any).notes?'Edit':'Add'}</button>}</div>
          {editingNotes?<div className="space-y-2"><textarea value={notesDraft} onChange={e=>setNotesDraft(e.target.value)} placeholder="Add notes…" rows={3} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none resize-none" autoFocus/><div className="flex items-center gap-2"><button onClick={handleSaveNotes} disabled={savingNotes} className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"><Save className="h-3.5 w-3.5"/>{savingNotes?'Saving…':'Save'}</button><button onClick={()=>setEditingNotes(false)} className="inline-flex items-center gap-1 rounded-md bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-200"><X className="h-3.5 w-3.5"/>Cancel</button></div></div>:(customer as any).notes?<p className="text-sm text-gray-700 whitespace-pre-wrap">{(customer as any).notes}</p>:<p className="text-sm text-gray-400 italic">No notes yet.</p>}
        </div>
      </div>
      <div><h3 className="text-sm font-semibold text-gray-700 mb-2">Order history ({customerOrders.length})</h3>
        {customerOrders.length===0?<div className="rounded-lg border border-gray-200 bg-white px-4 py-8 text-center"><Clock className="mx-auto mb-2 h-8 w-8 text-gray-300"/><p className="text-sm text-gray-500">No orders yet</p></div>
        :<div className="space-y-2">{customerOrders.map((o:any)=>(<Link key={o.id} href={`/orders/${o.id}`} className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-3 py-3 shadow-sm hover:border-blue-300 hover:shadow-md transition-all"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-bold text-gray-700">#{o.id}</div><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><span className="text-sm font-medium text-gray-900">{formatDateTime(o.createdAt)}</span><span className="inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-medium bg-gray-50 text-gray-600">{o.status}</span></div><div className="mt-0.5 text-xs text-gray-500">{o.items.length} item{o.items.length!==1?'s':''} · {o.items.map((i:any)=>`${i.name} ×${i.quantity}`).join(', ')}</div></div><div className="shrink-0 text-right"><span className="text-sm font-bold text-gray-900">${o.total.toFixed(2)}</span></div><ChevronRight className="h-4 w-4 text-gray-400"/></Link>))}</div>}
      </div>
    </div>);
}
