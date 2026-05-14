const { Keypair } = require('@solana/web3.js');

// Generate wallets for the E2E test
const merchant = Keypair.generate();
const tax = Keypair.generate();
const charity = Keypair.generate();
const customer = Keypair.generate();

console.log('=== DEVNET TEST WALLETS ===');
console.log('');
console.log('Merchant:');
console.log('  Public:  ' + merchant.publicKey.toBase58());
console.log('  Secret:  [' + Array.from(merchant.secretKey).join(',') + ']');
console.log('');
console.log('Tax Authority:');
console.log('  Public:  ' + tax.publicKey.toBase58());
console.log('  Secret:  [' + Array.from(tax.secretKey).join(',') + ']');
console.log('');
console.log('Charity:');
console.log('  Public:  ' + charity.publicKey.toBase58());
console.log('  Secret:  [' + Array.from(charity.secretKey).join(',') + ']');
console.log('');
console.log('Customer:');
console.log('  Public:  ' + customer.publicKey.toBase58());
console.log('  Secret:  [' + Array.from(customer.secretKey).join(',') + ']');
console.log('');
console.log('=== FUNDING INSTRUCTIONS ===');
console.log('Merchant: solana airdrop 2 ' + merchant.publicKey.toBase58() + ' --url devnet');
console.log('Customer: solana airdrop 2 ' + customer.publicKey.toBase58() + ' --url devnet');
