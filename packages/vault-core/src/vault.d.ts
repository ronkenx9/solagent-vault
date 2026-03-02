import { EventEmitter } from 'events';
import { Signer, type SignerConfig } from './signer.js';
import type { AgentPolicy, Intent, VaultResult, WalletBalance } from './types.js';
import { KeyManager } from './wallet/key-manager.js';
export interface VaultConfig {
    rpcUrl: string;
    keyManager: KeyManager;
    confirmOptions?: SignerConfig['confirmOptions'];
}
/**
 * Vault - The main public API surface for agent transactions.
 * This is the trust boundary - nothing the agent decides can bypass what lives here.
 */
export declare class Vault extends EventEmitter {
    private ruleEngine;
    private signer;
    constructor(config: VaultConfig);
    /**
     * Register a new policy for an agent
     */
    registerPolicy(policy: AgentPolicy): Promise<void>;
    /**
     * Update an existing policy
     */
    updatePolicy(agentId: string, updates: Partial<Omit<AgentPolicy, 'agentId'>>): Promise<boolean>;
    /**
     * Get current policy for an agent
     */
    getPolicy(agentId: string): Promise<AgentPolicy | undefined>;
    /**
     * Get all registered policies (agents)
     */
    getAllPolicies(): Promise<AgentPolicy[]>;
    /**
     * Execute an intent from an agent.
     * This is the main entry point for all agent transactions.
     */
    execute(intent: Intent): Promise<VaultResult>;
    /**
     * Get wallet balance for an agent
     */
    getBalance(agentId: string): Promise<WalletBalance>;
    /**
     * Get wallet address for an agent (public key only, never private)
     */
    getWalletAddress(agentId: string): Promise<string>;
    /**
     * Emergency pause for an agent
     */
    pauseAgent(agentId: string): Promise<boolean>;
    /**
     * Resume a paused agent
     */
    resumeAgent(agentId: string): Promise<boolean>;
    /**
     * Check if agent is paused
     */
    isPaused(agentId: string): Promise<boolean>;
    /**
     * Request airdrop for devnet testing
     */
    requestAirdrop(agentId: string, amount?: number): Promise<string>;
    /**
     * Get transaction count in last minute
     */
    getTxCountLastMinute(agentId: string): Promise<number>;
    /**
     * Get the signer instance (for advanced usage)
     */
    getSigner(): Signer;
    private emitEvent;
}
