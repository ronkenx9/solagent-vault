import { PublicKey, Transaction, VersionedTransaction } from '@solana/web3.js';

/**
 * KeyManager represents an abstract interface for signing transactions.
 * This ensures that the SolAgent Vault can securely integrate with remote 
 * Hardware Security Modules (HSMs), MPC wallets like Turnkey, or AWS KMS 
 * WITHOUT the Node.js process ever having access to the raw private key.
 */
export interface KeyManager {
    /**
     * Retrieves the public key for a specific agent.
     */
    getPublicKey(agentId: string): Promise<PublicKey>;

    /**
     * Securely signs a transaction payload. The actual signing logic is 
     * delegated to the secure enclave/HSM backend.
     */
    signTransaction(agentId: string, tx: Transaction | VersionedTransaction): Promise<Transaction | VersionedTransaction>;
}
