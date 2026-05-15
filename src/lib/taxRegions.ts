// ---------------------------------------------------------------------------
// US state sales tax rates (combined state + average local rates)
// Source: Tax Foundation / Avalara 2024 midpoint estimates
// Rates are decimal (e.g. 0.08875 = 8.875%)
// ---------------------------------------------------------------------------

export interface TaxRegion {
  code: string;
  name: string;
  rate: number;
}

export const US_TAX_REGIONS: TaxRegion[] = [
  { code: 'AL', name: 'Alabama', rate: 0.0924 },
  { code: 'AK', name: 'Alaska', rate: 0.0176 },
  { code: 'AZ', name: 'Arizona', rate: 0.0840 },
  { code: 'AR', name: 'Arkansas', rate: 0.0946 },
  { code: 'CA', name: 'California', rate: 0.0725 },
  { code: 'CO', name: 'Colorado', rate: 0.0777 },
  { code: 'CT', name: 'Connecticut', rate: 0.0635 },
  { code: 'DE', name: 'Delaware', rate: 0 },
  { code: 'FL', name: 'Florida', rate: 0.0600 },
  { code: 'GA', name: 'Georgia', rate: 0.0737 },
  { code: 'HI', name: 'Hawaii', rate: 0.0444 },
  { code: 'ID', name: 'Idaho', rate: 0.0603 },
  { code: 'IL', name: 'Illinois', rate: 0.0883 },
  { code: 'IN', name: 'Indiana', rate: 0.0700 },
  { code: 'IA', name: 'Iowa', rate: 0.0694 },
  { code: 'KS', name: 'Kansas', rate: 0.0870 },
  { code: 'KY', name: 'Kentucky', rate: 0.0600 },
  { code: 'LA', name: 'Louisiana', rate: 0.0955 },
  { code: 'ME', name: 'Maine', rate: 0.0550 },
  { code: 'MD', name: 'Maryland', rate: 0.0600 },
  { code: 'MA', name: 'Massachusetts', rate: 0.0625 },
  { code: 'MI', name: 'Michigan', rate: 0.0600 },
  { code: 'MN', name: 'Minnesota', rate: 0.0749 },
  { code: 'MS', name: 'Mississippi', rate: 0.0707 },
  { code: 'MO', name: 'Missouri', rate: 0.0836 },
  { code: 'MT', name: 'Montana', rate: 0 },
  { code: 'NE', name: 'Nebraska', rate: 0.0694 },
  { code: 'NV', name: 'Nevada', rate: 0.0823 },
  { code: 'NH', name: 'New Hampshire', rate: 0 },
  { code: 'NJ', name: 'New Jersey', rate: 0.0660 },
  { code: 'NM', name: 'New Mexico', rate: 0.0762 },
  { code: 'NY', name: 'New York', rate: 0.08875 },
  { code: 'NC', name: 'North Carolina', rate: 0.0699 },
  { code: 'ND', name: 'North Dakota', rate: 0.0704 },
  { code: 'OH', name: 'Ohio', rate: 0.0722 },
  { code: 'OK', name: 'Oklahoma', rate: 0.0894 },
  { code: 'OR', name: 'Oregon', rate: 0 },
  { code: 'PA', name: 'Pennsylvania', rate: 0.0634 },
  { code: 'RI', name: 'Rhode Island', rate: 0.0700 },
  { code: 'SC', name: 'South Carolina', rate: 0.0743 },
  { code: 'SD', name: 'South Dakota', rate: 0.0611 },
  { code: 'TN', name: 'Tennessee', rate: 0.0955 },
  { code: 'TX', name: 'Texas', rate: 0.0625 },
  { code: 'UT', name: 'Utah', rate: 0.0718 },
  { code: 'VT', name: 'Vermont', rate: 0.0636 },
  { code: 'VA', name: 'Virginia', rate: 0.0573 },
  { code: 'WA', name: 'Washington', rate: 0.0886 },
  { code: 'WV', name: 'West Virginia', rate: 0.0657 },
  { code: 'WI', name: 'Wisconsin', rate: 0.0543 },
  { code: 'WY', name: 'Wyoming', rate: 0.0538 },
  { code: 'DC', name: 'District of Columbia', rate: 0.0600 },
];

// Custom region sentinel — used when the user enters a manual rate
export const CUSTOM_REGION_CODE = '__custom__';

export function getTaxRegionByCode(code: string): TaxRegion | undefined {
  return US_TAX_REGIONS.find((r) => r.code === code);
}

/** Given a numeric tax rate (decimal), find the closest US region. */
export function findRegionByRate(rate: number): TaxRegion | undefined {
  if (rate === 0) return US_TAX_REGIONS.find((r) => r.rate === 0);
  // Match exact rate first, then closest
  const exact = US_TAX_REGIONS.find((r) => r.rate === rate);
  if (exact) return exact;
  let best: TaxRegion | undefined;
  let bestDist = Infinity;
  for (const r of US_TAX_REGIONS) {
    const dist = Math.abs(r.rate - rate);
    if (dist < bestDist) {
      bestDist = dist;
      best = r;
    }
  }
  return best;
}

/** Format a decimal tax rate as a percentage string (e.g. 0.08875 → "8.875%") */
export function formatTaxRate(rate: number): string {
  return `${(rate * 100).toFixed(3).replace(/0+$/, '').replace(/\.$/, '')}%`;
}
