const { Connection, PublicKey, LAMPORTS_PER_SOL, Keypair } = require('@solana/web3.js');

const DEVNET_URL = 'https://api.devnet.solana.com';
const connection = new Connection(DEVNET_URL, 'confirmed');

async function airdrop(pubkeyStr, sol = 2) {
  const pubkey = new PublicKey(pubkeyStr);
  try {
    const sig = await connection.requestAirdrop(pubkey, sol * LAMPORTS_PER_SOL);
    console.log(`${pubkeyStr.slice(0,8)}...: Airdrop requested, sig=${sig}`);
    
    // Wait for confirmation
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
    await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight });
    
    const balance = await connection.getBalance(pubkey);
    console.log(`${pubkeyStr.slice(0,8)}...: Balance = ${balance / LAMPORTS_PER_SOL} SOL`);
  } catch (err) {
    console.error(`${pubkeyStr.slice(0,8)}...: Airdrop failed: ${err.message}`);
  }
}

async function main() {
  // Airdrop to merchant and customer wallets
  await airdrop('J2yzWTyzwPaqN3qRDmpWtP7diKPfkqURUpgYNPwArEpU');
  await airdrop('6G6BP6PysyyfL1ZDvBYmHFodMk7Kzaute8JjdPdNM1p6');
  console.log('Done.');
}

main().catch(console.error);
