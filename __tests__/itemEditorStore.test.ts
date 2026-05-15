import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock security module to pass through values unchanged
vi.mock('@/lib/security', () => ({
  sanitizeTextField: (input: string, _maxLength?: number) => input?.trim() ?? '',
  sanitizeRichHtml: (input: string) => input,
  isValidSolanaAddress: (_addr: string) => true,
  sanitizeHtml: (html: string) => html,
  stripHtml: (input: string) => input,
  sanitizePhotoUrl: (url: string | null | undefined) => url ?? '',
  sanitizePhone: (input: string) => input?.replace(/\D/g, '') ?? '',
}));

import { useItemEditorStore } from '@/lib/itemEditorStore';

beforeEach(() => {
  useItemEditorStore.getState().reset();
});

describe('itemEditorStore', () => {
  describe('default state', () => {
    it('has correct default values', () => {
      const state = useItemEditorStore.getState();
      expect(state.type).toBe('product');
      expect(state.name).toBe('');
      expect(state.description).toBe('');
      expect(state.price).toBe('');
      expect(state.cost).toBe('');
      expect(state.sku).toBe('');
      expect(state.barcode).toBe('');
      expect(state.stock).toBe('0');
      expect(state.lowStockThreshold).toBe('');
      expect(state.category).toBe('');
      expect(state.status).toBe('draft');
      expect(state.photoUrl).toBeNull();
      expect(state.payUpfrontTemplate).toBe('');
      expect(state.listingRulesEnabled).toBe(false);
    });
  });

  describe('field setters', () => {
    it('sets type', () => {
      useItemEditorStore.getState().setType('service');
      expect(useItemEditorStore.getState().type).toBe('service');
    });

    it('sets name', () => {
      useItemEditorStore.getState().setName('My Item');
      expect(useItemEditorStore.getState().name).toBe('My Item');
    });

    it('sets description', () => {
      useItemEditorStore.getState().setDescription('A great product');
      expect(useItemEditorStore.getState().description).toBe('A great product');
    });

    it('sets price as string', () => {
      useItemEditorStore.getState().setPrice('19.99');
      expect(useItemEditorStore.getState().price).toBe('19.99');
    });

    it('sets cost as string', () => {
      useItemEditorStore.getState().setCost('5.50');
      expect(useItemEditorStore.getState().cost).toBe('5.50');
    });

    it('sets sku', () => {
      useItemEditorStore.getState().setSku('SKU-001');
      expect(useItemEditorStore.getState().sku).toBe('SKU-001');
    });

    it('sets barcode', () => {
      useItemEditorStore.getState().setBarcode('123456789');
      expect(useItemEditorStore.getState().barcode).toBe('123456789');
    });

    it('sets stock as string', () => {
      useItemEditorStore.getState().setStock('42');
      expect(useItemEditorStore.getState().stock).toBe('42');
    });

    it('sets low stock threshold', () => {
      useItemEditorStore.getState().setLowStockThreshold('5');
      expect(useItemEditorStore.getState().lowStockThreshold).toBe('5');
    });

    it('sets category', () => {
      useItemEditorStore.getState().setCategory('Beverages');
      expect(useItemEditorStore.getState().category).toBe('Beverages');
    });

    it('sets status', () => {
      useItemEditorStore.getState().setStatus('live');
      expect(useItemEditorStore.getState().status).toBe('live');
    });

    it('sets photoUrl', () => {
      useItemEditorStore.getState().setPhotoUrl('blob:photo');
      expect(useItemEditorStore.getState().photoUrl).toBe('blob:photo');
    });

    it('sets photoUrl to null', () => {
      useItemEditorStore.getState().setPhotoUrl('blob:photo');
      useItemEditorStore.getState().setPhotoUrl(null);
      expect(useItemEditorStore.getState().photoUrl).toBeNull();
    });

    it('sets pay upfront template', () => {
      useItemEditorStore.getState().setPayUpfrontTemplate('Pay before service');
      expect(useItemEditorStore.getState().payUpfrontTemplate).toBe('Pay before service');
    });

    it('sets listing rules enabled', () => {
      useItemEditorStore.getState().setListingRulesEnabled(true);
      expect(useItemEditorStore.getState().listingRulesEnabled).toBe(true);
    });
  });

  describe('loadItem', () => {
    it('populates all fields from an existing item', () => {
      useItemEditorStore.getState().loadItem({
        type: 'service',
        name: 'Consultation',
        description: '1 hour session',
        price: 100,
        cost: 0,
        sku: 'CONS-001',
        barcode: '987654',
        stock: 999,
        lowStockThreshold: 5,
        category: 'Services',
        status: 'live',
        photoUrl: 'blob:existing-photo',
        payUpfrontTemplate: 'Pay upfront',
        listingRules: { enabled: true },
      });

      const state = useItemEditorStore.getState();
      expect(state.type).toBe('service');
      expect(state.name).toBe('Consultation');
      expect(state.description).toBe('1 hour session');
      expect(state.price).toBe('100');
      expect(state.cost).toBe('0');
      expect(state.sku).toBe('CONS-001');
      expect(state.barcode).toBe('987654');
      expect(state.stock).toBe('999');
      expect(state.lowStockThreshold).toBe('5');
      expect(state.category).toBe('Services');
      expect(state.status).toBe('live');
      expect(state.photoUrl).toBe('blob:existing-photo');
      expect(state.payUpfrontTemplate).toBe('Pay upfront');
      expect(state.listingRulesEnabled).toBe(true);
    });

    it('handles missing optional fields', () => {
      useItemEditorStore.getState().loadItem({
        type: 'product',
        name: 'Widget',
        price: 10,
        stock: 50,
        status: 'draft',
        listingRules: { enabled: false },
      });

      const state = useItemEditorStore.getState();
      expect(state.description).toBe('');
      expect(state.cost).toBe('');
      expect(state.sku).toBe('');
      expect(state.barcode).toBe('');
      expect(state.lowStockThreshold).toBe('');
      expect(state.category).toBe('');
      expect(state.photoUrl).toBeNull();
      expect(state.payUpfrontTemplate).toBe('');
    });

    it('handles cost=0 correctly (not defaulted to empty)', () => {
      useItemEditorStore.getState().loadItem({
        type: 'product',
        name: 'Widget',
        price: 10,
        cost: 0,
        stock: 50,
        status: 'draft',
        listingRules: { enabled: false },
      });

      expect(useItemEditorStore.getState().cost).toBe('0');
    });

    it('handles lowStockThreshold=0 correctly', () => {
      useItemEditorStore.getState().loadItem({
        type: 'product',
        name: 'Widget',
        price: 10,
        stock: 50,
        lowStockThreshold: 0,
        status: 'draft',
        listingRules: { enabled: false },
      });

      expect(useItemEditorStore.getState().lowStockThreshold).toBe('0');
    });
  });

  describe('reset', () => {
    it('resets to default after being populated', () => {
      useItemEditorStore.getState().setName('Changed');
      useItemEditorStore.getState().setPrice('99.99');
      useItemEditorStore.getState().setStatus('live');
      useItemEditorStore.getState().setPhotoUrl('blob:photo');

      useItemEditorStore.getState().reset();

      const state = useItemEditorStore.getState();
      expect(state.name).toBe('');
      expect(state.price).toBe('');
      expect(state.status).toBe('draft');
      expect(state.photoUrl).toBeNull();
      expect(state.stock).toBe('0');
    });
  });
});
