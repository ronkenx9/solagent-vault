import * as bip39 from 'bip39';
import { derivePath } from 'ed25519-hd-key';
import { Keypair, VersionedTransaction } from '@solana/web3.js';
/**
 * LocalKeyManager is a reference integration that simulates an HSM
 * directly in memory for local development and testing.
 *
 * In a true production environment, this file would be completely removed
 * and replaced entirely by the `TurnkeyKeyManager` or AWS KMS equivalent,
 * ensuring that the `process.env.MASTER_SEED` is never loaded into memory.
 */
export class LocalKeyManager {
    masterSeed;
    constructor() {
        this.masterSeed = process.env.VAULT_MASTER_SEED || process.env.MASTER_SEED || '';
        if (!this.masterSeed) {
            console.warn('⚠️ [LocalKeyManager] VAULT_MASTER_SEED is missing from environment. Using ephemeral session keys (DATA WILL BE LOST).');
            this.masterSeed = bip39.generateMnemonic(256);
        }
    }
    /**
     * Retrieves the secure public key for an agent.
     */
    async getPublicKey(agentId) {
        const keypair = this.deriveAgentKeypair(agentId);
        return keypair.publicKey;
    }
    /**
     * Securely signs a transaction payload.
     * This represents the "Black Box" signing action where the `Keypair`
     * never escapes the KeyManager instance.
     */
    async signTransaction(agentId, tx) {
        const keypair = this.deriveAgentKeypair(agentId);
        if (tx instanceof VersionedTransaction) {
            tx.sign([keypair]);
            return tx;
        }
        else {
            // Partial sign the legacy transaction
            tx.partialSign(keypair);
            return tx;
        }
    }
    // --- Internal Secure Context ---
    /**
     * Derives a deterministic keypair for an agent from the master seed.
     * This is marked PRIVATE so the raw Keypair physically cannot leak to the Orchestrator.
     */
    deriveAgentKeypair(agentId) {
        const index = this.hashAgentId(agentId);
        const path = `m/44'/501'/${index}'/0'`;
        const seed = bip39.mnemonicToSeedSync(this.masterSeed);
        const { key } = derivePath(path, seed.toString('hex'));
        return Keypair.fromSeed(key);
    }
    /**
     * Stable hash of agentId to produce a derivation index.
     */
    hashAgentId(agentId) {
        let hash = 5381;
        for (let i = 0; i < agentId.length; i++) {
            hash = ((hash << 5) + hash) + agentId.charCodeAt(i);
            hash |= 0;
        }
        return Math.abs(hash) % 2_147_483_647;
    }
}
//# sourceMappingURL=local-manager.js.map