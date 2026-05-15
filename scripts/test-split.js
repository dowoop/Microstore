// Verify the computeAtomicSplit logic + token decimal conversions
function computeAtomicSplit(params) {
  const { subtotal, tipPercent, taxRate, charityRoundUp, merchantWallet, taxWallet, charityWallet, charityPartners } = params;
  const tip = subtotal * (tipPercent / 100);
  const tax = subtotal * taxRate;
  const preCharity = subtotal + tip + tax;
  const charity = charityRoundUp ? Math.ceil(preCharity) - preCharity : 0;
  return {
    merchant: { address: merchantWallet, amount: subtotal + tip, label: 'Merchant + Tip' },
    tax: { address: taxWallet, amount: tax, label: 'Tax' },
    charity: { address: charityWallet, amount: charity, label: charityPartners.length > 0 ? charityPartners.join(' and ') : 'Charity' },
  };
}

/**
 * Convert human-readable amount to raw token units (smallest denomination).
 * This mirrors src/lib/solanaTokens.ts:humanToRaw.
 */
function humanToRaw(humanAmount, decimals) {
  return Math.round(humanAmount * Math.pow(10, decimals));
}

/**
 * Convert raw token units to human-readable string.
 * This mirrors src/lib/solanaTokens.ts:formatTokenAmount.
 */
function rawToHuman(rawAmount, decimals) {
  return (rawAmount / Math.pow(10, decimals)).toFixed(Math.min(decimals, 6));
}

// =========================================================================
// 1. ComputeAtomicSplit tests (existing)
// =========================================================================

console.log('=== ComputeAtomicSplit Tests ===\n');

const testCases = [
  { desc: 'Basic - no tip, no charity', subtotal: 10, tipPercent: 0, taxRate: 0.08875, charityRoundUp: false },
  { desc: 'With 15% tip', subtotal: 19.45, tipPercent: 15, taxRate: 0.08875, charityRoundUp: false },
  { desc: 'With charity round-up', subtotal: 10.00, tipPercent: 10, taxRate: 0.08875, charityRoundUp: true },
  { desc: 'Edge: zero amounts', subtotal: 0, tipPercent: 0, taxRate: 0.08875, charityRoundUp: false },
  { desc: 'Edge: high tip', subtotal: 100, tipPercent: 30, taxRate: 0.08875, charityRoundUp: true },
  { desc: 'Edge: very small amount', subtotal: 0.50, tipPercent: 0, taxRate: 0.08875, charityRoundUp: true },
];

let allPassed = true;

for (const tc of testCases) {
  const split = computeAtomicSplit({
    ...tc,
    merchantWallet: 'MERC',
    taxWallet: 'TAX',
    charityWallet: 'CHAR',
    charityPartners: ['GiveDirectly'],
  });
  const total = split.merchant.amount + split.tax.amount + split.charity.amount;
  const individSum = Number(split.merchant.amount.toFixed(2)) + Number(split.tax.amount.toFixed(2)) + Number(split.charity.amount.toFixed(2));

  console.log('--- ' + tc.desc + ' ---');
  console.log('  Subtotal: ' + tc.subtotal.toFixed(2));
  console.log('  Merchant: ' + split.merchant.amount.toFixed(4) + ' (' + split.merchant.amount.toFixed(2) + ')');
  console.log('  Tax:      ' + split.tax.amount.toFixed(4) + ' (' + split.tax.amount.toFixed(2) + ')');
  console.log('  Charity:  ' + split.charity.amount.toFixed(4) + ' (' + split.charity.amount.toFixed(2) + ')');
  console.log('  Raw total: ' + total.toFixed(6));
  console.log('  Total .toFixed(2): ' + total.toFixed(2));
  console.log('  Sum of rounded: ' + individSum.toFixed(2));

  const roundingDiff = Math.abs(Number(total.toFixed(2)) - individSum);
  console.log('  Rounding diff: ' + roundingDiff.toFixed(2));
  if (roundingDiff > 0.02) {
    console.log('  ⚠️  WARNING: rounding diff exceeds 0.02');
    allPassed = false;
  }
  console.log('');
}

// =========================================================================
// 2. Decimal conversion tests (USDC = 6, standard SPL = 9)
// =========================================================================

console.log('=== Decimal Conversion Tests ===\n');

/**
 * Test configs: { decimals, cases: [{ humanAmount, expectedRaw }] }
 */
const decimalTests = [
  {
    name: 'USDC (6 decimals)',
    decimals: 6,
    cases: [
      { humanAmount: 1.00,        expectedRaw: 1_000_000 },
      { humanAmount: 0.01,        expectedRaw: 10_000 },
      { humanAmount: 10.50,       expectedRaw: 10_500_000 },
      { humanAmount: 0.000001,    expectedRaw: 1 },
      { humanAmount: 1000.00,     expectedRaw: 1_000_000_000 },
      { humanAmount: 0,           expectedRaw: 0 },
    ],
  },
  {
    name: 'Standard SPL (9 decimals)',
    decimals: 9,
    cases: [
      { humanAmount: 1.00,              expectedRaw: 1_000_000_000 },
      { humanAmount: 0.000000001,       expectedRaw: 1 },
      { humanAmount: 10.50,             expectedRaw: 10_500_000_000 },
      { humanAmount: 0.123456789,       expectedRaw: 123_456_789 },
      { humanAmount: 0,                 expectedRaw: 0 },
    ],
  },
  {
    name: 'Edge: very large amount (6 decimals)',
    decimals: 6,
    cases: [
      { humanAmount: 999_999.999999, expectedRaw: 999_999_999_999 },
    ],
  },
  {
    name: 'Edge: sub-cent amounts (6 decimals)',
    decimals: 6,
    cases: [
      { humanAmount: 0.004999,   expectedRaw: 4_999 },
      { humanAmount: 0.005000,   expectedRaw: 5_000 },
      { humanAmount: 0.005001,   expectedRaw: 5_001 },
    ],
  },
];

for (const test of decimalTests) {
  let testPassed = true;
  console.log(`--- ${test.name} ---`);
  for (const c of test.cases) {
    const raw = humanToRaw(c.humanAmount, test.decimals);
    const humanBack = rawToHuman(raw, test.decimals);
    const match = raw === c.expectedRaw;
    const icon = match ? '✓' : '✗';
    console.log(`  ${icon} humanToRaw(${c.humanAmount}, ${test.decimals}) = ${raw} (expected ${c.expectedRaw})`);
    if (!match) testPassed = false;
  }
  console.log(`  → ${testPassed ? 'PASS' : 'FAIL'}`);
  console.log('');
  if (!testPassed) allPassed = false;
}

// =========================================================================
// 3. Round-trip tests: human → raw → human
// =========================================================================

console.log('=== Round-Trip Tests ===\n');

const roundTripTests = [
  { amount: 10.50, decimals: 6, expected: '10.500000' },
  { amount: 10.50, decimals: 9, expected: '10.500000' },
  { amount: 0.01,  decimals: 6, expected: '0.010000' },
  { amount: 0.01,  decimals: 9, expected: '0.010000' },
  { amount: 1.234567, decimals: 6, expected: '1.234567' },
  { amount: 1.234567890, decimals: 9, expected: '1.234568' }, // capped at 6dp display, rounds up
];

for (const t of roundTripTests) {
  const raw = humanToRaw(t.amount, t.decimals);
  const human = rawToHuman(raw, t.decimals);
  const match = human === t.expected;
  const icon = match ? '✓' : '✗';
  console.log(`  ${icon} ${t.amount} → raw → ${human} (expected ${t.expected}) [${t.decimals}d]`);
  if (!match) allPassed = false;
}

console.log('');

// =========================================================================
// 4. BuildAtomicSplit rounding precision test
//    Simulates the raw conversion in buildAtomicSplitTransaction
// =========================================================================

console.log('=== Amount → Raw Precision Tests ===\n');

/**
 * Simulates the rounding behavior from buildAtomicSplitTransaction:
 *   rawAmount = Math.round(amount * Math.pow(10, decimals))
 * Tests that split amounts round correctly for 6-decimal USDC.
 */
const precisionTests = [
  { desc: 'USDC: $10.00 + 15% tip', amount: 11.50, decimals: 6, expectedRaw: 11_500_000 },
  { desc: 'USDC: $19.45 + 15% tip = $22.3675', amount: 22.3675, decimals: 6, expectedRaw: 22_367_500 },
  { desc: 'USDC: tax 8.875% on $10 = $0.8875', amount: 0.8875, decimals: 6, expectedRaw: 887_500 },
  { desc: 'USDC: charity round-up 0.02', amount: 0.02, decimals: 6, expectedRaw: 20_000 },
  { desc: 'USDC: sub-cent charity', amount: 0.001, decimals: 6, expectedRaw: 1_000 },
  { desc: 'USDC: $1.999999', amount: 1.999999, decimals: 6, expectedRaw: 1_999_999 },
];

for (const t of precisionTests) {
  const raw = humanToRaw(t.amount, t.decimals);
  const match = raw === t.expectedRaw;
  const icon = match ? '✓' : '✗';
  console.log(`  ${icon} ${t.desc}: ${t.amount} × 10^${t.decimals} = ${raw.toLocaleString()} (expected ${t.expectedRaw.toLocaleString()})`);
  if (!match) allPassed = false;
}

console.log('');
console.log('========================================');
console.log(allPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED');
console.log('========================================');
process.exit(allPassed ? 0 : 1);
