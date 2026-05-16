// Throwaway test — verify registry compiles and works
// Run: npx tsx src/lib/chains/__test_registry.ts

import { type ChainAdapter } from './types';
import { registerChain, getAdapter, listAdapters } from './registry';

// Build a noop adapter
const noop: ChainAdapter = {
  id: 'solana',
  name: 'Solana Noop',
  validateAddress: (_addr: string) => true,
  detectChainFromAddress: (_addr: string) => 'solana',
  // The rest are required by the interface — fill with noop stubs
} as ChainAdapter;

// register
registerChain(noop);
console.log('PASS: registered solana noop');

// get
const found = getAdapter('solana');
if (!found) throw new Error('getAdapter returned undefined');
console.log('PASS: getAdapter("solana") returned adapter');

// get unknown
// @ts-expect-error — testing an unsupported chain id that isn't in the local ChainId union
const missing = getAdapter('bitcoin');
if (missing !== undefined) throw new Error('getAdapter should return undefined');
console.log('PASS: getAdapter("bitcoin") returned undefined');

// list
const all = listAdapters();
if (all.length !== 1) throw new Error(`expected 1 adapter, got ${all.length}`);
console.log('PASS: listAdapters() returned 1 adapter');

// duplicate register throws
let threw = false;
try {
  registerChain(noop);
} catch {
  threw = true;
}
if (!threw) throw new Error('expected duplicate registerChain to throw');
console.log('PASS: duplicate registerChain throws');

console.log('\nAll registry tests passed.');
