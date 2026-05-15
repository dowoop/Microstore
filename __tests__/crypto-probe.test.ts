import { describe, it, expect } from 'vitest';

describe('crypto probe', () => {
  it('has crypto.subtle', () => {
    expect(crypto).toBeDefined();
    expect(crypto.subtle).toBeDefined();
    console.log('crypto.subtle available:', !!crypto.subtle);
  });

  it('supports ECDSA', async () => {
    try {
      const key = await crypto.subtle.generateKey(
        { name: 'ECDSA', namedCurve: 'P-256' },
        false,
        ['sign', 'verify'],
      );
      console.log('ECDSA generation: OK');
      expect(key).toBeDefined();
    } catch (e) {
      console.log('ECDSA generation FAILED:', e.message);
    }
  });
});
