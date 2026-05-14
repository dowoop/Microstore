const { Connection, Keypair, LAMPORTS_PER_SOL } = require('@solana/web3.js');

const endpoints = [
  'https://api.devnet.solana.com',
  'https://devnet.helius-rpc.com/?api-key=',
  'https://solana-devnet.g.alchemy.com/v2/demo',
];

async function tryAirdrop() {
  const wallet = Keypair.generate();
  const pubkey = wallet.publicKey.toBase58();
  console.log('Wallet:', pubkey);

  for (const url of endpoints) {
    try {
      const conn = new Connection(url, 'confirmed');
      const sig = await conn.requestAirdrop(wallet.publicKey, 2 * LAMPORTS_PER_SOL);
      console.log('SUCCESS via', url.split('?')[0], 'sig:', sig);
      console.log('PUBKEY:', pubkey);
      console.log('SECRET:', JSON.stringify(Array.from(wallet.secretKey)));
      return;
    } catch(e) {
      console.log('FAIL', url.split('?')[0].slice(0,40), ':', e.message.slice(0,100));
    }
  }
  console.log('ALL FAILED');
}

tryAirdrop();
