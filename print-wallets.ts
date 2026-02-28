import 'dotenv/config';
import { Vault } from './packages/vault-core/src/index.js';

async function main() {
    const vault = new Vault({
        rpcUrl: process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com',
    });

    const agents = ['agent-momentum-01', 'agent-conservative-02', 'agent-rebalancer-03'];

    console.log('\n🏦 Agent Wallet Addresses (Devnet)\n');
    for (const id of agents) {
        const address = vault.getWalletAddress(id);
        console.log(`- ${id}: ${address}`);
    }
    console.log('\n');
}

main().catch(console.error);
