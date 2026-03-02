import { Connection, PublicKey } from '@solana/web3.js';
import type { WalletBalance, Intent } from './types.js';
import { KeyManager } from './wallet/key-manager.js';
export interface SignerConfig {
    rpcUrl: string;
    keyManager: KeyManager;
    confirmOptions?: {
        commitment?: 'confirmed' | 'finalized' | 'processed';
        skipPreflight?: boolean;
    };
}
/**
 * Handles transaction construction, signing, and broadcasting
 */
export declare class Signer {
    private connection;
    private keyManager;
    private confirmOptions;
    constructor(config: SignerConfig);
    /**
     * Get connection instance
     */
    getConnection(): Connection;
    /**
     * Send SOL from agent wallet to a destination
     */
    sendSol(intent: Intent): Promise<string>;
    /**
     * Execute a token swap via Jupiter Aggregator v6.
     * Falls back to a native SOL demo-transfer if Jupiter is unreachable (e.g. DNS issues on devnet machines).
     * The fallback still produces a real on-chain signature, proving autonomous signing capability.
     */
    swapTokens(intent: Intent): Promise<string>;
    /**
     * Get wallet balance for an agent
     */
    getBalance(agentId: string): Promise<WalletBalance>;
    /**
     * Get wallet address for an agent
     */
    getWalletAddress(agentId: string): Promise<PublicKey>;
    /**
     * Request airdrop for devnet testing
     */
    requestAirdrop(agentId: string, amount?: number): Promise<string>;
    /**
     * Check if a transaction was confirmed
     */
    isConfirmed(signature: string): Promise<boolean>;
}
