import { describe, it, expect, beforeEach } from 'vitest';
import { useCreateShopStore } from '@/lib/createShopStore';

describe('createShopStore', () => {
  beforeEach(() => {
    useCreateShopStore.getState().reset();
  });

  describe('initial state', () => {
    it('has empty default values', () => {
      const s = useCreateShopStore.getState();
      expect(s.name).toBe('');
      expect(s.username).toBe('');
      expect(s.photoUrl).toBeNull();
      expect(s.description).toBe('');
      expect(s.merchantWallet).toBe('');
      expect(s.taxWallet).toBe('');
      expect(s.charityWallet).toBe('');
      expect(s.splTokenMint).toBe('');
      expect(s.splTokenSymbol).toBe('');
    });

    it('has default tip presets [0, 10, 15, 20]', () => {
      expect(useCreateShopStore.getState().tipPresets).toEqual([0, 10, 15, 20]);
    });

    it('has tax allocation and charity disabled by default', () => {
      const s = useCreateShopStore.getState();
      expect(s.taxAllocationEnabled).toBe(false);
      expect(s.taxRate).toBe(0);
      expect(s.taxRegion).toBe('');
      expect(s.charityEnabled).toBe(false);
    });

    it('has empty acceptedTokens array', () => {
      expect(useCreateShopStore.getState().acceptedTokens).toEqual([]);
    });
  });

  describe('setName', () => {
    it('sets the name field', () => {
      useCreateShopStore.getState().setName('My Shop');
      expect(useCreateShopStore.getState().name).toBe('My Shop');
    });

    it('auto-generates username slug from name when username is empty', () => {
      useCreateShopStore.getState().setName('My Awesome Shop');
      expect(useCreateShopStore.getState().username).toBe('my-awesome-shop');
    });

    it('strips special characters from auto-generated slug', () => {
      useCreateShopStore.getState().setName('Shop! @#$ Test');
      expect(useCreateShopStore.getState().username).toBe('shop-test');
    });

    it('does not overwrite manually edited username', () => {
      useCreateShopStore.getState().setUsername('my-custom-slug');
      useCreateShopStore.getState().setName('New Name');
      expect(useCreateShopStore.getState().username).toBe('my-custom-slug');
    });

    it('updates username if it matches the previous auto-slug', () => {
      useCreateShopStore.getState().setName('My Shop');
      expect(useCreateShopStore.getState().username).toBe('my-shop');
      useCreateShopStore.getState().setName('My New Shop');
      expect(useCreateShopStore.getState().username).toBe('my-shop');
    });
  });

  describe('setUsername', () => {
    it('sets username with lowercase and dash normalization', () => {
      useCreateShopStore.getState().setUsername('My Awesome Store!');
      expect(useCreateShopStore.getState().username).toBe('myawesomestore');
    });

    it('removes invalid characters', () => {
      useCreateShopStore.getState().setUsername('hello@world#2024');
      expect(useCreateShopStore.getState().username).toBe('helloworld2024');
    });

    it('collapses multiple dashes', () => {
      useCreateShopStore.getState().setUsername('my---shop');
      expect(useCreateShopStore.getState().username).toBe('my-shop');
    });
  });

  describe('setPhotoUrl', () => {
    it('sets photo URL', () => {
      useCreateShopStore.getState().setPhotoUrl('blob:http://example.com/photo');
      expect(useCreateShopStore.getState().photoUrl).toBe('blob:http://example.com/photo');
    });

    it('sets photo URL to null', () => {
      useCreateShopStore.getState().setPhotoUrl('some-url');
      useCreateShopStore.getState().setPhotoUrl(null);
      expect(useCreateShopStore.getState().photoUrl).toBeNull();
    });
  });

  describe('setDescription', () => {
    it('sets the description field', () => {
      useCreateShopStore.getState().setDescription('A great store');
      expect(useCreateShopStore.getState().description).toBe('A great store');
    });
  });

  describe('toggleTipPreset', () => {
    it('adds a new tip preset and keeps sorted', () => {
      useCreateShopStore.getState().toggleTipPreset(18);
      expect(useCreateShopStore.getState().tipPresets).toEqual([0, 10, 15, 18, 20]);
    });

    it('removes an existing tip preset', () => {
      useCreateShopStore.getState().toggleTipPreset(15);
      expect(useCreateShopStore.getState().tipPresets).toEqual([0, 10, 20]);
    });

    it('does nothing when toggling a non-existent preset to remove', () => {
      useCreateShopStore.getState().toggleTipPreset(99);
      expect(useCreateShopStore.getState().tipPresets).toEqual([0, 10, 15, 20, 99]);
    });
  });

  describe('setTaxAllocationEnabled', () => {
    it('enables tax allocation', () => {
      useCreateShopStore.getState().setTaxAllocationEnabled(true);
      expect(useCreateShopStore.getState().taxAllocationEnabled).toBe(true);
    });

    it('disables tax allocation', () => {
      useCreateShopStore.getState().setTaxAllocationEnabled(true);
      useCreateShopStore.getState().setTaxAllocationEnabled(false);
      expect(useCreateShopStore.getState().taxAllocationEnabled).toBe(false);
    });
  });

  describe('setTaxRate / setTaxRegion', () => {
    it('sets tax rate with clamping (0–0.5)', () => {
      useCreateShopStore.getState().setTaxRate(0.08875);
      expect(useCreateShopStore.getState().taxRate).toBe(0.08875);
    });

    it('clamps tax rate to 0 minimum', () => {
      useCreateShopStore.getState().setTaxRate(-0.1);
      expect(useCreateShopStore.getState().taxRate).toBe(0);
    });

    it('clamps tax rate to 0.5 maximum', () => {
      useCreateShopStore.getState().setTaxRate(1.0);
      expect(useCreateShopStore.getState().taxRate).toBe(0.5);
    });

    it('sets tax region', () => {
      useCreateShopStore.getState().setTaxRegion('NY');
      expect(useCreateShopStore.getState().taxRegion).toBe('NY');
    });
  });

  describe('setCharityEnabled', () => {
    it('enables charity', () => {
      useCreateShopStore.getState().setCharityEnabled(true);
      expect(useCreateShopStore.getState().charityEnabled).toBe(true);
    });
  });

  describe('wallet address setters', () => {
    it('sets and trims merchant wallet', () => {
      useCreateShopStore.getState().setMerchantWallet('  Abc123  ');
      expect(useCreateShopStore.getState().merchantWallet).toBe('Abc123');
    });

    it('sets and trims tax wallet', () => {
      useCreateShopStore.getState().setTaxWallet('  Xyz789  ');
      expect(useCreateShopStore.getState().taxWallet).toBe('Xyz789');
    });

    it('sets and trims charity wallet', () => {
      useCreateShopStore.getState().setCharityWallet('  Def456  ');
      expect(useCreateShopStore.getState().charityWallet).toBe('Def456');
    });
  });

  describe('setSplTokenMint', () => {
    it('sets and trims SPL token mint address', () => {
      useCreateShopStore.getState().setSplTokenMint('  MintAddr  ');
      expect(useCreateShopStore.getState().splTokenMint).toBe('MintAddr');
    });
  });

  describe('setSplTokenSymbol', () => {
    it('sets, trims, and uppercases SPL token symbol', () => {
      useCreateShopStore.getState().setSplTokenSymbol('  usdc  ');
      expect(useCreateShopStore.getState().splTokenSymbol).toBe('USDC');
    });
  });

  // ---- Multi-token actions ----

  describe('acceptedTokens', () => {
    const sampleToken = {
      mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
      symbol: 'USDC',
      decimals: 6,
      name: 'USD Coin',
    };

    const sampleToken2 = {
      mint: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
      symbol: 'USDT',
      decimals: 6,
      name: 'Tether USD',
    };

    const sampleToken3 = {
      mint: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
      symbol: 'SAMO',
      decimals: 9,
      name: 'Samoyed Coin',
    };

    describe('addAcceptedToken', () => {
      it('adds a token', () => {
        useCreateShopStore.getState().addAcceptedToken(sampleToken);
        const tokens = useCreateShopStore.getState().acceptedTokens;
        expect(tokens).toHaveLength(1);
        expect(tokens[0]).toEqual(sampleToken);
      });

      it('appends to end of list', () => {
        useCreateShopStore.getState().addAcceptedToken(sampleToken);
        useCreateShopStore.getState().addAcceptedToken(sampleToken2);
        const tokens = useCreateShopStore.getState().acceptedTokens;
        expect(tokens).toHaveLength(2);
        expect(tokens[0].symbol).toBe('USDC');
        expect(tokens[1].symbol).toBe('USDT');
      });

      it('does not add duplicate mint', () => {
        useCreateShopStore.getState().addAcceptedToken(sampleToken);
        useCreateShopStore.getState().addAcceptedToken(sampleToken); // same mint
        expect(useCreateShopStore.getState().acceptedTokens).toHaveLength(1);
      });
    });

    describe('removeAcceptedToken', () => {
      it('removes a token by mint', () => {
        useCreateShopStore.getState().addAcceptedToken(sampleToken);
        useCreateShopStore.getState().removeAcceptedToken(sampleToken.mint);
        expect(useCreateShopStore.getState().acceptedTokens).toHaveLength(0);
      });

      it('does nothing for non-existent mint', () => {
        useCreateShopStore.getState().addAcceptedToken(sampleToken);
        useCreateShopStore.getState().removeAcceptedToken('nonexistent');
        expect(useCreateShopStore.getState().acceptedTokens).toHaveLength(1);
      });
    });

    describe('reorderAcceptedTokens', () => {
      beforeEach(() => {
        const store = useCreateShopStore.getState();
        store.addAcceptedToken(sampleToken);
        store.addAcceptedToken(sampleToken2);
        store.addAcceptedToken(sampleToken3);
      });

      it('moves token from position 0 to 2', () => {
        useCreateShopStore.getState().reorderAcceptedTokens(0, 2);
        const tokens = useCreateShopStore.getState().acceptedTokens;
        expect(tokens.map((t) => t.symbol)).toEqual(['USDT', 'SAMO', 'USDC']);
      });

      it('moves token from position 2 to 0', () => {
        useCreateShopStore.getState().reorderAcceptedTokens(2, 0);
        const tokens = useCreateShopStore.getState().acceptedTokens;
        expect(tokens.map((t) => t.symbol)).toEqual(['SAMO', 'USDC', 'USDT']);
      });

      it('does nothing for out-of-bounds fromIndex', () => {
        useCreateShopStore.getState().reorderAcceptedTokens(99, 0);
        const tokens = useCreateShopStore.getState().acceptedTokens;
        expect(tokens.map((t) => t.symbol)).toEqual(['USDC', 'USDT', 'SAMO']);
      });

      it('does nothing for out-of-bounds toIndex', () => {
        useCreateShopStore.getState().reorderAcceptedTokens(0, 99);
        const tokens = useCreateShopStore.getState().acceptedTokens;
        expect(tokens.map((t) => t.symbol)).toEqual(['USDC', 'USDT', 'SAMO']);
      });
    });

    describe('setAcceptedTokens', () => {
      it('replaces the entire list', () => {
        useCreateShopStore.getState().addAcceptedToken(sampleToken);
        useCreateShopStore.getState().setAcceptedTokens([sampleToken2, sampleToken3]);
        const tokens = useCreateShopStore.getState().acceptedTokens;
        expect(tokens.map((t) => t.symbol)).toEqual(['USDT', 'SAMO']);
      });
    });
  });

  describe('reset', () => {
    it('restores all fields to defaults', () => {
      const store = useCreateShopStore.getState();
      store.setName('Test');
      store.setUsername('custom');
      store.setDescription('desc');
      store.setMerchantWallet('wallet1');
      store.setCharityEnabled(true);
      store.toggleTipPreset(25);
      store.addAcceptedToken({
        mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        symbol: 'USDC',
        decimals: 6,
      });

      store.reset();

      const s = useCreateShopStore.getState();
      expect(s.name).toBe('');
      expect(s.username).toBe('');
      expect(s.description).toBe('');
      expect(s.merchantWallet).toBe('');
      expect(s.charityEnabled).toBe(false);
      expect(s.taxRate).toBe(0);
      expect(s.taxRegion).toBe('');
      expect(s.tipPresets).toEqual([0, 10, 15, 20]);
      expect(s.acceptedTokens).toEqual([]);
    });
  });
});
