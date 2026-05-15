import { describe, it, expect, beforeEach } from 'vitest';
import { useCreateShopStore } from '@/lib/createShopStore';

beforeEach(() => {
  useCreateShopStore.getState().reset();
});

describe('createShopStore', () => {
  describe('setName + auto-slug', () => {
    it('sets name and auto-generates username slug', () => {
      useCreateShopStore.getState().setName('My Coffee Shop');

      const state = useCreateShopStore.getState();
      expect(state.name).toBe('My Coffee Shop');
      expect(state.username).toBe('my-coffee-shop');
    });

    it('auto-generated slug persists when name changes (slug computed from new name, not old)', () => {
      useCreateShopStore.getState().setName('My Coffee Shop');
      expect(useCreateShopStore.getState().username).toBe('my-coffee-shop');

      // Changing the name does NOT auto-update the slug because
      // autoSlugFromName(state.name) computes from the NEW name,
      // and the old username ('my-coffee-shop') doesn't match the new slug ('my-tea-shop')
      useCreateShopStore.getState().setName('My Tea Shop');
      expect(useCreateShopStore.getState().username).toBe('my-coffee-shop');
    });

    it('does NOT override manually edited username', () => {
      useCreateShopStore.getState().setName('My Coffee Shop');
      useCreateShopStore.getState().setUsername('coffee-hq');
      useCreateShopStore.getState().setName('My Tea Shop');

      // Should keep the manually set username
      expect(useCreateShopStore.getState().username).toBe('coffee-hq');
    });
  });

  describe('setUsername', () => {
    it('lowercases and strips invalid characters (spaces removed)', () => {
      useCreateShopStore.getState().setUsername('My Coffee & Tea!');

      // setUsername regex: lowercase, strip non-[a-z0-9-], collapse dashes
      // 'My Coffee & Tea!' -> 'my coffee & tea!' -> 'mycoffeetea' -> 'mycoffeetea'
      expect(useCreateShopStore.getState().username).toBe('mycoffeetea');
    });

    it('collapses multiple dashes', () => {
      useCreateShopStore.getState().setUsername('hello---world');

      expect(useCreateShopStore.getState().username).toBe('hello-world');
    });

    it('removes non-alphanumeric characters', () => {
      useCreateShopStore.getState().setUsername('café@#$%^&*()nico');

      expect(useCreateShopStore.getState().username).toBe('cafnico');
    });
  });

  describe('setPhotoUrl', () => {
    it('sets photo URL', () => {
      useCreateShopStore.getState().setPhotoUrl('blob:http://localhost/photo.png');
      expect(useCreateShopStore.getState().photoUrl).toBe('blob:http://localhost/photo.png');
    });

    it('sets photo URL to null', () => {
      useCreateShopStore.getState().setPhotoUrl('blob:http://localhost/photo.png');
      useCreateShopStore.getState().setPhotoUrl(null);
      expect(useCreateShopStore.getState().photoUrl).toBeNull();
    });
  });

  describe('setDescription', () => {
    it('sets description', () => {
      useCreateShopStore.getState().setDescription('Best coffee in town');
      expect(useCreateShopStore.getState().description).toBe('Best coffee in town');
    });
  });

  describe('toggleTipPreset', () => {
    it('removes a preset that already exists', () => {
      useCreateShopStore.getState().toggleTipPreset(10);
      expect(useCreateShopStore.getState().tipPresets).toEqual([0, 15, 20]);
    });

    it('adds a new preset and sorts', () => {
      useCreateShopStore.getState().toggleTipPreset(5);
      expect(useCreateShopStore.getState().tipPresets).toEqual([0, 5, 10, 15, 20]);
    });

    it('can remove all presets', () => {
      useCreateShopStore.getState().toggleTipPreset(0);
      useCreateShopStore.getState().toggleTipPreset(10);
      useCreateShopStore.getState().toggleTipPreset(15);
      useCreateShopStore.getState().toggleTipPreset(20);
      expect(useCreateShopStore.getState().tipPresets).toEqual([]);
    });
  });

  describe('tax and charity toggles', () => {
    it('toggles tax allocation', () => {
      expect(useCreateShopStore.getState().taxAllocationEnabled).toBe(false);
      useCreateShopStore.getState().setTaxAllocationEnabled(true);
      expect(useCreateShopStore.getState().taxAllocationEnabled).toBe(true);
      useCreateShopStore.getState().setTaxAllocationEnabled(false);
      expect(useCreateShopStore.getState().taxAllocationEnabled).toBe(false);
    });

    it('toggles charity', () => {
      expect(useCreateShopStore.getState().charityEnabled).toBe(false);
      useCreateShopStore.getState().setCharityEnabled(true);
      expect(useCreateShopStore.getState().charityEnabled).toBe(true);
    });
  });

  describe('wallet address setters', () => {
    it('sets merchant wallet and trims', () => {
      useCreateShopStore.getState().setMerchantWallet('  Abc111111111111111111111111111111111111111111  ');
      expect(useCreateShopStore.getState().merchantWallet).toBe('Abc111111111111111111111111111111111111111111');
    });

    it('sets tax wallet', () => {
      useCreateShopStore.getState().setTaxWallet('Tax2222222222222222222222222222222222222222');
      expect(useCreateShopStore.getState().taxWallet).toBe('Tax2222222222222222222222222222222222222222');
    });

    it('sets charity wallet', () => {
      useCreateShopStore.getState().setCharityWallet('Char3333333333333333333333333333333333333333');
      expect(useCreateShopStore.getState().charityWallet).toBe('Char3333333333333333333333333333333333333333');
    });

    it('sets spl token mint', () => {
      useCreateShopStore.getState().setSplTokenMint('Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr');
      expect(useCreateShopStore.getState().splTokenMint).toBe('Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr');
    });

    it('sets spl token symbol uppercased', () => {
      useCreateShopStore.getState().setSplTokenSymbol('usdc');
      expect(useCreateShopStore.getState().splTokenSymbol).toBe('USDC');
    });
  });

  describe('reset', () => {
    it('resets all fields to defaults', () => {
      useCreateShopStore.getState().setName('My Shop');
      useCreateShopStore.getState().setPhotoUrl('blob:photo');
      useCreateShopStore.getState().setTaxAllocationEnabled(true);
      useCreateShopStore.getState().setCharityEnabled(true);
      useCreateShopStore.getState().setMerchantWallet('Merch1111111111111111111111111111111111111111');
      useCreateShopStore.getState().toggleTipPreset(10);

      useCreateShopStore.getState().reset();

      const state = useCreateShopStore.getState();
      expect(state.name).toBe('');
      expect(state.username).toBe('');
      expect(state.photoUrl).toBeNull();
      expect(state.description).toBe('');
      expect(state.tipPresets).toEqual([0, 10, 15, 20]);
      expect(state.taxAllocationEnabled).toBe(false);
      expect(state.charityEnabled).toBe(false);
      expect(state.merchantWallet).toBe('');
      expect(state.taxWallet).toBe('');
      expect(state.charityWallet).toBe('');
      expect(state.splTokenMint).toBe('');
      expect(state.splTokenSymbol).toBe('');
    });
  });
});
