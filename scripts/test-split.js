// Verify the computeAtomicSplit logic
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

const testCases = [
  { desc: 'Basic - no tip, no charity', subtotal: 10, tipPercent: 0, taxRate: 0.08875, charityRoundUp: false },
  { desc: 'With 15% tip', subtotal: 19.45, tipPercent: 15, taxRate: 0.08875, charityRoundUp: false },
  { desc: 'With charity round-up', subtotal: 10.00, tipPercent: 10, taxRate: 0.08875, charityRoundUp: true },
  { desc: 'Edge: zero amounts', subtotal: 0, tipPercent: 0, taxRate: 0.08875, charityRoundUp: false },
  { desc: 'Edge: high tip', subtotal: 100, tipPercent: 30, taxRate: 0.08875, charityRoundUp: true },
  { desc: 'Edge: very small amount', subtotal: 0.50, tipPercent: 0, taxRate: 0.08875, charityRoundUp: true },
];

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
  console.log('  Rounding diff: ' + (Number(total.toFixed(2)) - individSum).toFixed(2));
  console.log('');
}
