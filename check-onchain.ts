import 'dotenv/config';
import { Connection, PublicKey } from '@solana/web3.js';
import { Vault } from './packages/vault-core/src/index.js';

async function main() {
    const rpcUrl = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
    const connection = new Connection(rpcUrl, 'confirmed');
    const vault = new Vault({ rpcUrl });

    const agents = ['agent-momentum-01', 'agent-conservative-02', 'agent-rebalancer-03'];

    console.log('\n🔍 Checking Devnet Balances...\n');
    for (const id of agents) {
        const address = vault.getWalletAddress(id);
        const balance = await connection.getBalance(new PublicKey(address));
        console.log(`- ${id}: ${address} -> ${balance / 1e9} SOL`);
    }
    console.log('\n');
}

main().catch(console.error);
