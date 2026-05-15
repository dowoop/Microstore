// ---------------------------------------------------------------------------
// Feature Flags — compile-time definitions, runtime activation via license
// ---------------------------------------------------------------------------

export enum Tier {
  Free = 'free',
  Pro = 'pro',
}

export interface FeatureFlag {
  name: string;
  tier: Tier;
  description: string;
}

const FEATURES: Record<string, FeatureFlag> = {
  POS: { name: 'Point of Sale', tier: Tier.Free, description: 'Core POS with QR-based Solana Pay' },
  SINGLE_SHOP: { name: 'Single Shop', tier: Tier.Free, description: 'Manage one shop with inventory tracking' },
  QR_PAYMENTS: { name: 'QR Payments', tier: Tier.Free, description: 'Generate and display Solana Pay QR codes' },
  MULTI_TOKEN: { name: 'Multi-Token Support', tier: Tier.Pro, description: 'Accept payments in multiple SPL tokens' },
  MULTI_SHOP: { name: 'Multi-Shop Management', tier: Tier.Pro, description: 'Create and manage multiple shop profiles' },
  CRM: { name: 'Customer CRM', tier: Tier.Pro, description: 'Customer directory, purchase history, and contact management' },
  PDF_RECEIPTS: { name: 'PDF Receipts', tier: Tier.Pro, description: 'Generate downloadable PDF receipts for customers' },
  ANALYTICS: { name: 'Sales Analytics', tier: Tier.Pro, description: 'Dashboards for revenue, inventory trends, and top-selling items' },
};

let activeTier: Tier = Tier.Free;

export function getActiveTier(): Tier { return activeTier; }
export function setActiveTier(tier: Tier): void { activeTier = tier; }
export function isPro(): boolean { return activeTier === Tier.Pro; }

export function isFeatureEnabled(featureName: string): boolean {
  const flag = FEATURES[featureName];
  if (!flag) return false;
  if (flag.tier === Tier.Free) return true;
  return activeTier === Tier.Pro;
}

export function getProFeatures(): string[] {
  return Object.entries(FEATURES).filter(([, f]) => f.tier === Tier.Pro).map(([n]) => n);
}

export { FEATURES };
