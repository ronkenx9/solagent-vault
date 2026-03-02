import { Keypair, PublicKey } from '@solana/web3.js';
/**
 * Derives a deterministic keypair for an agent from the master seed.
 * Each agent gets a unique derivation path based on their agentId.
 * This allows one seed to spawn unlimited isolated agent wallets.
 */
export declare function deriveAgentKeypair(agentId: string): Keypair;
/**
 * Get the public key for an agent without deriving the full keypair
 */
export declare function deriveAgentPublicKey(agentId: string): PublicKey;
/**
 * Generate a fresh mnemonic for development
 */
export declare function generateMnemonic(): string;
/**
 * Validate a mnemonic
 */
export declare function validateMnemonic(mnemonic: string): boolean;
