// ---------------------------------------------------------------------------
// Feature Flags — compile-time definitions, runtime activation via license
// ---------------------------------------------------------------------------
//
// Each feature is assigned a minimum tier. Free-tier features are always on.
// Pro-tier features require a valid license key to activate at runtime.
//
// Usage:
//   import { isPro, isFeatureEnabled } from '@/lib/featureFlags';
//   if (isFeatureEnabled('MULTI_TOKEN')) { ... }
// ---------------------------------------------------------------------------

/** License tiers supported by Microstore. */
export enum Tier {
  Free = 'free',
  Pro = 'pro',
}

/** Shape of a single feature flag entry. */
export interface FeatureFlag {
  /** Human-readable name. */
  name: string;
  /** Minimum tier required to enable this feature. */
  tier: Tier;
  /** One-line description for docs / audit. */
  description: string;
}

// ---------------------------------------------------------------------------
// Feature registry
// ---------------------------------------------------------------------------

const FEATURES: Record<string, FeatureFlag> = {
  // Free tier — always available
  POS: {
    name: 'Point of Sale',
    tier: Tier.Free,
    description: 'Core POS interface with QR-based Solana Pay',
  },
  SINGLE_SHOP: {
    name: 'Single Shop',
    tier: Tier.Free,
    description: 'Manage one shop with inventory tracking',
  },
  QR_PAYMENTS: {
    name: 'QR Payments',
    tier: Tier.Free,
    description: 'Generate and display Solana Pay QR codes',
  },

  // Pro tier — requires valid license
  MULTI_TOKEN: {
    name: 'Multi-Token Support',
    tier: Tier.Pro,
    description: 'Accept payments in multiple SPL tokens (USDC, USDT, PYUSD, etc.)',
  },
  MULTI_SHOP: {
    name: 'Multi-Shop Management',
    tier: Tier.Pro,
    description: 'Create and manage multiple shop profiles',
  },
  CRM: {
    name: 'Customer CRM',
    tier: Tier.Pro,
    description: 'Customer directory, purchase history, and contact management',
  },
  PDF_RECEIPTS: {
    name: 'PDF Receipts',
    tier: Tier.Pro,
    description: 'Generate downloadable PDF receipts for customers',
  },
  ANALYTICS: {
    name: 'Sales Analytics',
    tier: Tier.Pro,
    description: 'Dashboards for revenue, inventory trends, and top-selling items',
  },
};

// ---------------------------------------------------------------------------
// Runtime tier state
// ---------------------------------------------------------------------------

/**
 * The currently active tier. Defaults to 'free'.
 * Only mutated by the license validation system — never set directly.
 */
let activeTier: Tier = Tier.Free;

/** Return the current active tier. */
export function getActiveTier(): Tier {
  return activeTier;
}

/**
 * Set the active tier. Intended to be called ONLY from the license
 * validation path (`licenseKey.ts`) after a valid key is verified.
 */
export function setActiveTier(tier: Tier): void {
  activeTier = tier;
}

// ---------------------------------------------------------------------------
// Public helpers
// ---------------------------------------------------------------------------

/** True when a Pro license is active. */
export function isPro(): boolean {
  return activeTier === Tier.Pro;
}

/**
 * Check whether a named feature is currently enabled.
 * Free-tier features always return `true`.
 * Pro-tier features return `true` only when a Pro license is active.
 */
export function isFeatureEnabled(featureName: string): boolean {
  const flag = FEATURES[featureName];
  if (!flag) return false;
  if (flag.tier === Tier.Free) return true;
  return activeTier === Tier.Pro;
}

/**
 * Return the list of feature names that require a Pro license.
 * Useful for showing upgrade prompts.
 */
export function getProFeatures(): string[] {
  return Object.entries(FEATURES)
    .filter(([, flag]) => flag.tier === Tier.Pro)
    .map(([name]) => name);
}

/** Re-export the feature registry for introspection (e.g. settings UI). */
export { FEATURES };
