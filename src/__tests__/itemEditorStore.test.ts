import { describe, it, expect, beforeEach } from 'vitest';
import { useItemEditorStore } from '@/lib/itemEditorStore';

describe('itemEditorStore', () => {
  beforeEach(() => {
    useItemEditorStore.getState().reset();
  });

  describe('initial state', () => {
    it('has sensible default values', () => {
      const s = useItemEditorStore.getState();
      expect(s.type).toBe('product');
      expect(s.name).toBe('');
      expect(s.description).toBe('');
      expect(s.price).toBe('');
      expect(s.cost).toBe('');
      expect(s.sku).toBe('');
      expect(s.barcode).toBe('');
      expect(s.stock).toBe('0');
      expect(s.lowStockThreshold).toBe('');
      expect(s.category).toBe('');
      expect(s.status).toBe('draft');
      expect(s.photoUrl).toBeNull();
      expect(s.payUpfrontTemplate).toBe('');
      expect(s.listingRulesEnabled).toBe(false);
    });
  });

  describe('field setters', () => {
    it('setType changes item type', () => {
      useItemEditorStore.getState().setType('service');
      expect(useItemEditorStore.getState().type).toBe('service');
    });

    it('setName updates name', () => {
      useItemEditorStore.getState().setName('Widget');
      expect(useItemEditorStore.getState().name).toBe('Widget');
    });

    it('setDescription updates description', () => {
      useItemEditorStore.getState().setDescription('A useful widget');
      expect(useItemEditorStore.getState().description).toBe('A useful widget');
    });

    it('setPrice updates price string', () => {
      useItemEditorStore.getState().setPrice('19.99');
      expect(useItemEditorStore.getState().price).toBe('19.99');
    });

    it('setCost updates cost string', () => {
      useItemEditorStore.getState().setCost('5.50');
      expect(useItemEditorStore.getState().cost).toBe('5.50');
    });

    it('setSku updates SKU', () => {
      useItemEditorStore.getState().setSku('SKU-123');
      expect(useItemEditorStore.getState().sku).toBe('SKU-123');
    });

    it('setBarcode updates barcode', () => {
      useItemEditorStore.getState().setBarcode('123456789');
      expect(useItemEditorStore.getState().barcode).toBe('123456789');
    });

    it('setStock updates stock string', () => {
      useItemEditorStore.getState().setStock('42');
      expect(useItemEditorStore.getState().stock).toBe('42');
    });

    it('setLowStockThreshold updates threshold', () => {
      useItemEditorStore.getState().setLowStockThreshold('10');
      expect(useItemEditorStore.getState().lowStockThreshold).toBe('10');
    });

    it('setCategory updates category', () => {
      useItemEditorStore.getState().setCategory('Electronics');
      expect(useItemEditorStore.getState().category).toBe('Electronics');
    });

    it('setStatus changes item status', () => {
      useItemEditorStore.getState().setStatus('live');
      expect(useItemEditorStore.getState().status).toBe('live');
    });

    it('setPhotoUrl sets photo URL', () => {
      useItemEditorStore.getState().setPhotoUrl('blob:photo1');
      expect(useItemEditorStore.getState().photoUrl).toBe('blob:photo1');
    });

    it('setPhotoUrl handles null', () => {
      useItemEditorStore.getState().setPhotoUrl('blob:photo1');
      useItemEditorStore.getState().setPhotoUrl(null);
      expect(useItemEditorStore.getState().photoUrl).toBeNull();
    });

    it('setPayUpfrontTemplate updates template', () => {
      useItemEditorStore.getState().setPayUpfrontTemplate('Pay upfront for this service');
      expect(useItemEditorStore.getState().payUpfrontTemplate).toBe('Pay upfront for this service');
    });

    it('setListingRulesEnabled toggles listing rules', () => {
      useItemEditorStore.getState().setListingRulesEnabled(true);
      expect(useItemEditorStore.getState().listingRulesEnabled).toBe(true);
    });
  });

  describe('loadItem', () => {
    it('populates all fields from an item object', () => {
      useItemEditorStore.getState().loadItem({
        type: 'service',
        name: 'Consultation',
        description: '1-hour session',
        price: 99.99,
        cost: 10,
        sku: 'CONS-001',
        barcode: 'BAR-001',
        stock: 0,
        lowStockThreshold: 5,
        category: 'Services',
        status: 'live',
        photoUrl: 'blob:img',
        payUpfrontTemplate: 'Pay now',
        listingRules: { enabled: true },
      });

      const s = useItemEditorStore.getState();
      expect(s.type).toBe('service');
      expect(s.name).toBe('Consultation');
      expect(s.description).toBe('1-hour session');
      expect(s.price).toBe('99.99');
      expect(s.cost).toBe('10');
      expect(s.sku).toBe('CONS-001');
      expect(s.barcode).toBe('BAR-001');
      expect(s.stock).toBe('0');
      expect(s.lowStockThreshold).toBe('5');
      expect(s.category).toBe('Services');
      expect(s.status).toBe('live');
      expect(s.photoUrl).toBe('blob:img');
      expect(s.payUpfrontTemplate).toBe('Pay now');
      expect(s.listingRulesEnabled).toBe(true);
    });

    it('handles missing optional fields with defaults', () => {
      useItemEditorStore.getState().loadItem({
        type: 'product',
        name: 'Minimal Item',
        price: 5.0,
        stock: 10,
        status: 'draft',
        listingRules: { enabled: false },
      });

      const s = useItemEditorStore.getState();
      expect(s.name).toBe('Minimal Item');
      expect(s.price).toBe('5');
      expect(s.stock).toBe('10');
      expect(s.description).toBe('');
      expect(s.cost).toBe('');
      expect(s.sku).toBe('');
      expect(s.barcode).toBe('');
      expect(s.lowStockThreshold).toBe('');
      expect(s.category).toBe('');
      expect(s.photoUrl).toBeNull();
      expect(s.payUpfrontTemplate).toBe('');
      expect(s.listingRulesEnabled).toBe(false);
    });

    it('converts null photoUrl properly', () => {
      useItemEditorStore.getState().loadItem({
        type: 'product',
        name: 'No Photo',
        price: 10,
        stock: 5,
        status: 'draft',
        listingRules: { enabled: false },
      });

      expect(useItemEditorStore.getState().photoUrl).toBeNull();
    });
  });

  describe('reset', () => {
    it('restores all fields to initial defaults', () => {
      const store = useItemEditorStore.getState();
      store.setName('Changed');
      store.setPrice('99');
      store.setType('service');
      store.setStatus('live');
      store.setListingRulesEnabled(true);

      store.reset();

      const s = useItemEditorStore.getState();
      expect(s.type).toBe('product');
      expect(s.name).toBe('');
      expect(s.price).toBe('');
      expect(s.status).toBe('draft');
      expect(s.listingRulesEnabled).toBe(false);
    });
  });
});
