// Standalone script to generate a mnemonic and derive the first agent wallet address
// Run: node generate-wallet.mjs

import { Keypair } from '@solana/web3.js';
import * as bip39 from 'bip39';
import { derivePath } from 'ed25519-hd-key';

function djb2Hash(str) {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) + hash) + str.charCodeAt(i);
        hash = hash & 0x7FFFFFFF;
    }
    return hash;
}

function deriveAgentKeypair(mnemonic, agentId) {
    const seed = bip39.mnemonicToSeedSync(mnemonic);
    const agentIndex = djb2Hash(agentId) % 2147483647;
    const path = `m/44'/501'/${agentIndex}'/0'`;
    const derived = derivePath(path, seed.toString('hex'));
    return Keypair.fromSeed(derived.key);
}

// Generate or use existing mnemonic
const existingMnemonic = process.argv[2];
const mnemonic = existingMnemonic || bip39.generateMnemonic(256);

console.log('\n🔑 SolAgent Vault - Wallet Generator\n');
console.log('='.repeat(60));

if (!existingMnemonic) {
    console.log('\n📝 NEW MASTER SEED (save this in .env as VAULT_MASTER_SEED):');
    console.log(`\n   ${mnemonic}\n`);
}

const agents = ['momentum-trader', 'conservative-holder', 'rebalancer'];

console.log('🏦 Agent Wallet Addresses (devnet):\n');
for (const agentId of agents) {
    const kp = deriveAgentKeypair(mnemonic, agentId);
    console.log(`   ${agentId.padEnd(25)} → ${kp.publicKey.toBase58()}`);
}

console.log('\n' + '='.repeat(60));
console.log('\n💡 Send devnet SOL to ANY of these addresses.');
console.log('   Or use: solana airdrop 2 <ADDRESS> --url devnet\n');
