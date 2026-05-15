'use client';
import { useState, useMemo, useEffect, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Search, UserPlus, X } from 'lucide-react';
import { db } from '@/lib/db';

export interface CustomerSelection { customerId?: number; customerName: string; customerPhone: string; }

export function CustomerSuggest({ shopId, selected, onSelect, onClear }: { shopId: number; selected: CustomerSelection|null; onSelect: (c: CustomerSelection) => void; onClear: () => void }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const customers = useLiveQuery(() => db.customers.where('shopId').equals(shopId).toArray(), [shopId]);
  const matches = useMemo(() => { if (!customers||!query.trim()) return []; const q=query.toLowerCase(); return customers.filter((c:any)=>c.name.toLowerCase().includes(q)||c.phone?.toLowerCase().includes(q)).slice(0,5); }, [customers, query]);
  useEffect(()=>{setHighlightIdx(0)},[matches]);
  useEffect(()=>{function h(e:MouseEvent){if(containerRef.current&&!containerRef.current.contains(e.target as Node))setOpen(false)};document.addEventListener('mousedown',h);return()=>document.removeEventListener('mousedown',h)},[]);
  const select = (c:any) => { onSelect({customerId:c.id, customerName:c.name, customerPhone:c.phone??''}); setQuery(''); setOpen(false); };
  const onKeyDown = (e:React.KeyboardEvent) => { if(!open||matches.length===0)return; if(e.key==='ArrowDown'){e.preventDefault();setHighlightIdx(i=>(i+1)%matches.length)}else if(e.key==='ArrowUp'){e.preventDefault();setHighlightIdx(i=>(i-1+matches.length)%matches.length)}else if(e.key==='Enter'){e.preventDefault();select(matches[highlightIdx])}else if(e.key==='Escape'){setOpen(false);inputRef.current?.blur()} };

  if (selected) return (
    <div className="flex items-center gap-2">
      <div className="flex-1 inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2"><span className="text-sm font-medium text-blue-800">{selected.customerName}</span>{selected.customerPhone&&<span className="text-xs text-blue-600">{selected.customerPhone}</span>}</div>
      <button onClick={onClear} className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200"><X className="h-4 w-4"/></button>
    </div>);

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500"/>
        <input ref={inputRef} type="text" value={query} onChange={e=>{setQuery(e.target.value);setOpen(true)}} onFocus={()=>{if(query.trim())setOpen(true)}} onKeyDown={onKeyDown} placeholder="Search customers… (or type new name)" className="w-full rounded-lg border border-gray-300 py-2.5 pl-9 pr-3 text-sm text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none"/>
        {query.trim()&&<button onClick={()=>{onSelect({customerName:query.trim(),customerPhone:''});setQuery('');setOpen(false)}} className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex items-center gap-1 rounded-md bg-blue-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-blue-700"><UserPlus className="h-3 w-3"/>New</button>}
      </div>
      {open&&query.trim()&&matches.length>0&&<div className="absolute z-50 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg overflow-hidden">{matches.map((c:any,i:number)=>(<button key={c.id} onClick={()=>select(c)} onMouseEnter={()=>setHighlightIdx(i)} className={`flex w-full items-center gap-3 px-3 py-2.5 text-left ${i===highlightIdx?'bg-blue-50':'hover:bg-gray-50'}`}><div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">{c.name.split(' ').map((n:string)=>n[0]).join('').toUpperCase().slice(0,2)}</div><div className="min-w-0 flex-1"><p className="text-sm font-medium text-gray-900 truncate">{c.name}</p>{c.phone&&<p className="text-xs text-gray-500">{c.phone}</p>}</div></button>))}</div>}
      {open&&query.trim()&&matches.length===0&&<div className="absolute z-50 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg p-3 text-center"><p className="text-xs text-gray-500">No existing customers match.</p><p className="mt-0.5 text-[11px] text-gray-400">Click &quot;New&quot; or press Enter to create a new entry.</p></div>}
    </div>);
}
