import 'fake-indexeddb/auto';
const s: Record<string, string> = {};
Object.defineProperty(globalThis, 'localStorage', { value: {
  getItem: (k: string) => s[k] ?? null, setItem: (k: string, v: string) => { s[k] = v; },
  removeItem: (k: string) => { delete s[k]; }, clear: () => { for (const k of Object.keys(s)) delete s[k]; },
  get length() { return Object.keys(s).length; }, key: (i: number) => Object.keys(s)[i] ?? null,
}, writable: true, configurable: true });
