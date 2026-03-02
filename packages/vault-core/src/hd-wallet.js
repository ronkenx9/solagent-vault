import * as bip39 from 'bip39';
import { derivePath } from 'ed25519-hd-key';
import { Keypair } from '@solana/web3.js';
const MASTER_SEED = process.env.VAULT_MASTER_SEED || process.env.MASTER_SEED;
/**
 * Derives a deterministic keypair for an agent from the master seed.
 * Each agent gets a unique derivation path based on their agentId.
 * This allows one seed to spawn unlimited isolated agent wallets.
 */
export function deriveAgentKeypair(agentId) {
    if (!MASTER_SEED) {
        throw new Error('MISSION_CRITICAL: VAULT_MASTER_SEED or MASTER_SEED environment variable is missing. Check your deployment settings.');
    }
    const index = hashAgentId(agentId);
    const path = `m/44'/501'/${index}'/0'`;
    const seed = bip39.mnemonicToSeedSync(MASTER_SEED);
    const { key } = derivePath(path, seed.toString('hex'));
    return Keypair.fromSeed(key);
}
/**
 * Get the public key for an agent without deriving the full keypair
 */
export function deriveAgentPublicKey(agentId) {
    const keypair = deriveAgentKeypair(agentId);
    return keypair.publicKey;
}
/**
 * Stable hash of agentId to produce a derivation index.
 * Uses a simple djb2-like hash for stability.
 */
function hashAgentId(agentId) {
    let hash = 5381;
    for (let i = 0; i < agentId.length; i++) {
        hash = ((hash << 5) + hash) + agentId.charCodeAt(i);
        hash |= 0;
    }
    return Math.abs(hash) % 2_147_483_647;
}
/**
 * Generate a fresh mnemonic for development
 */
export function generateMnemonic() {
    return bip39.generateMnemonic(256);
}
/**
 * Validate a mnemonic
 */
export function validateMnemonic(mnemonic) {
    return bip39.validateMnemonic(mnemonic);
}
//# sourceMappingURL=hd-wallet.js.map