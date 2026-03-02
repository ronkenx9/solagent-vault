import { PublicKey, Transaction, VersionedTransaction } from '@solana/web3.js';
import { KeyManager } from './key-manager.js';
/**
 * LocalKeyManager is a reference integration that simulates an HSM
 * directly in memory for local development and testing.
 *
 * In a true production environment, this file would be completely removed
 * and replaced entirely by the `TurnkeyKeyManager` or AWS KMS equivalent,
 * ensuring that the `process.env.MASTER_SEED` is never loaded into memory.
 */
export declare class LocalKeyManager implements KeyManager {
    private masterSeed;
    constructor();
    /**
     * Retrieves the secure public key for an agent.
     */
    getPublicKey(agentId: string): Promise<PublicKey>;
    /**
     * Securely signs a transaction payload.
     * This represents the "Black Box" signing action where the `Keypair`
     * never escapes the KeyManager instance.
     */
    signTransaction(agentId: string, tx: Transaction | VersionedTransaction): Promise<Transaction | VersionedTransaction>;
    /**
     * Derives a deterministic keypair for an agent from the master seed.
     * This is marked PRIVATE so the raw Keypair physically cannot leak to the Orchestrator.
     */
    private deriveAgentKeypair;
    /**
     * Stable hash of agentId to produce a derivation index.
     */
    private hashAgentId;
}
