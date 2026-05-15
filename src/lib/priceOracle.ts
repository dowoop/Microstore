/** Lightweight price oracle for SPL tokens. */
export function isStablecoin(s: string): boolean { return new Set(['USDC','USDT','PYUSD']).has(s.toUpperCase()); }
const cache = new Map<string,{price:number,ts:number}>();
export function formatUsd(u: number): string {
  if(u===0) return '$0.00'; if(u>=0.01) return `$${u.toFixed(2)}`;
  if(u>=0.0001) return `$${u.toFixed(4)}`; return `$${u.toFixed(6)}`;
}
export async function fetchPricesFromJupiter(mints: string[]): Promise<Map<string,number>> {
  const r = new Map<string,number>(); if(!mints.length) return r;
  try {
    const resp = await fetch(`https://price.jup.ag/v6/price?ids=${encodeURIComponent(mints.join(','))}&vsToken=USDC`);
    if(!resp.ok) return r;
    const j = await resp.json();
    for(const m of mints){ const e=j.data?.[m]; if(e?.price!=null) r.set(m,e.price); }
  } catch {}
  return r;
}
export async function getTokenPrice(mint: string, symbol: string): Promise<number> {
  if(isStablecoin(symbol)) return 1;
  const c=cache.get(mint); if(c&&Date.now()-c.ts<60_000) return c.price;
  const p=await fetchPricesFromJupiter([mint]); const v=p.get(mint);
  if(v!=null){ cache.set(mint,{price:v,ts:Date.now()}); return v; }
  return c?.price??0;
}
export async function getTokenPrices(tokens:{mint:string,symbol:string}[]): Promise<Map<string,number>> {
  const r=new Map<string,number>(); const query:string[]=[];
  for(const t of tokens){
    if(isStablecoin(t.symbol)){ r.set(t.mint,1); continue; }
    const c=cache.get(t.mint); if(c&&Date.now()-c.ts<60_000){ r.set(t.mint,c.price); continue; }
    query.push(t.mint);
  }
  if(query.length){
    const jp=await fetchPricesFromJupiter(query);
    for(const t of tokens){
      if(query.includes(t.mint)){
        const v=jp.get(t.mint);
        if(v!=null){ r.set(t.mint,v); cache.set(t.mint,{price:v,ts:Date.now()}); }
        else{ const c2=cache.get(t.mint); if(c2) r.set(t.mint,c2.price); }
      }
    }
  }
  return r;
}
