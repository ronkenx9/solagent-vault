import { PublicKey, Transaction, VersionedTransaction } from '@solana/web3.js';
import { KeyManager } from './key-manager.js';
export interface TurnkeyConfig {
    apiPublicKey: string;
    apiPrivateKey: string;
    organizationId: string;
    baseUrl?: string;
}
/**
 * TurnkeyKeyManager is an enterprise-grade MPC (Multi-Party Computation)
 * key manager integration.
 *
 * It proxies transaction signing requests to the Turnkey API enclave.
 * This guarantees the Solana Private Keys are geographically distributed
 * and never touch the Vercel or Node container memory.
 */
export declare class TurnkeyKeyManager implements KeyManager {
    private config;
    constructor(config: TurnkeyConfig);
    /**
     * Retrieves the public key for an agent by fetching the wallet address
     * mapped to this agent via Turnkey's Sub-Organizations.
     */
    getPublicKey(agentId: string): Promise<PublicKey>;
    /**
     * Proxies the transaction payload string to the Turnkey Enclave to be signed
     * and subsequently returns the fully signed object without ever revealing the private key.
     */
    signTransaction(agentId: string, tx: Transaction | VersionedTransaction): Promise<Transaction | VersionedTransaction>;
}
