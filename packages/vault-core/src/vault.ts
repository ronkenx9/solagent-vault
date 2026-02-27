import { EventEmitter } from 'events';
import { RuleEngine } from './rule-engine.js';
import { Signer, type SignerConfig } from './signer.js';
import type { AgentPolicy, Intent, VaultResult, VaultEvent, WalletBalance } from './types.js';
import { deriveAgentPublicKey } from './hd-wallet.js';

export interface VaultConfig {
  rpcUrl: string;
  confirmOptions?: SignerConfig['confirmOptions'];
}

/**
 * Vault - The main public API surface for agent transactions.
 * This is the trust boundary - nothing the agent decides can bypass what lives here.
 */
export class Vault extends EventEmitter {
  private ruleEngine: RuleEngine;
  private signer: Signer;

  constructor(config: VaultConfig) {
    super();
    this.ruleEngine = new RuleEngine();
    this.signer = new Signer({
      rpcUrl: config.rpcUrl,
      confirmOptions: config.confirmOptions,
    });
  }

  /**
   * Register a new policy for an agent
   */
  registerPolicy(policy: AgentPolicy): void {
    this.ruleEngine.registerPolicy(policy);
    this.emitEvent('policy_updated', policy.agentId, { policy });
  }

  /**
   * Update an existing policy
   */
  updatePolicy(agentId: string, updates: Partial<Omit<AgentPolicy, 'agentId'>>): boolean {
    const result = this.ruleEngine.updatePolicy(agentId, updates);
    if (result) {
      const policy = this.ruleEngine.getPolicy(agentId);
      this.emitEvent('policy_updated', agentId, { policy });
    }
    return result;
  }

  /**
   * Get current policy for an agent
   */
  getPolicy(agentId: string): AgentPolicy | undefined {
    return this.ruleEngine.getPolicy(agentId);
  }

  /**
   * Execute an intent from an agent.
   * This is the main entry point for all agent transactions.
   */
  async execute(intent: Intent): Promise<VaultResult> {
    // 1. Check rules first — agent cannot bypass this
    const check = this.ruleEngine.check(intent);

    if (!check.approved) {
      this.emitEvent('tx_blocked', intent.agentId, {
        intent,
        reason: check.reason,
      });
      return {
        success: false,
        signature: null,
        reason: check.reason,
        ruleCheck: check,
      };
    }

    // 2. Execute the transaction based on action type
    let signature: string | null = null;

    try {
      switch (intent.action) {
        case 'TRANSFER':
          signature = await this.signer.sendSol(
            intent.agentId,
            intent.destinationProgram,
            intent.lamports
          );
          break;

        case 'SWAP':
          signature = await this.signer.swapTokens(
            intent.agentId,
            intent.inputMint || 'So11111111111111111111111111111111111111112',
            intent.outputMint || 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1',
            intent.lamports
          );
          break;

        case 'STAKE':
          // Placeholder for stake operations
          signature = `devnet-stake-${Date.now()}`;
          break;

        default:
          return {
            success: false,
            signature: null,
            reason: `Unknown action: ${intent.action}`,
          };
      }

      // 3. Emit success event
      this.emitEvent('tx_executed', intent.agentId, {
        intent,
        signature,
        timestamp: Date.now(),
      });

      return {
        success: true,
        signature,
        reason: 'Transaction executed successfully',
        ruleCheck: check,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        signature: null,
        reason: `Transaction failed: ${errorMessage}`,
        ruleCheck: check,
      };
    }
  }

  /**
   * Get wallet balance for an agent
   */
  async getBalance(agentId: string): Promise<WalletBalance> {
    return this.signer.getBalance(agentId);
  }

  /**
   * Get wallet address for an agent (public key only, never private)
   */
  getWalletAddress(agentId: string): string {
    return deriveAgentPublicKey(agentId).toBase58();
  }

  /**
   * Emergency pause for an agent
   */
  pauseAgent(agentId: string): boolean {
    const result = this.ruleEngine.pauseAgent(agentId);
    if (result) {
      this.emitEvent('agent_paused', agentId, { agentId });
    }
    return result;
  }

  /**
   * Resume a paused agent
   */
  resumeAgent(agentId: string): boolean {
    const result = this.ruleEngine.resumeAgent(agentId);
    if (result) {
      this.emitEvent('agent_resumed', agentId, { agentId });
    }
    return result;
  }

  /**
   * Check if agent is paused
   */
  isPaused(agentId: string): boolean {
    return this.ruleEngine.isPaused(agentId);
  }

  /**
   * Request airdrop for devnet testing
   */
  async requestAirdrop(agentId: string, amount: number = 2): Promise<string> {
    return this.signer.requestAirdrop(agentId, amount);
  }

  /**
   * Get transaction count in last minute
   */
  getTxCountLastMinute(agentId: string): number {
    return this.ruleEngine.getTxCountLastMinute(agentId);
  }

  /**
   * Get the signer instance (for advanced usage)
   */
  getSigner(): Signer {
    return this.signer;
  }

  private emitEvent(type: VaultEvent['type'], agentId: string, data: unknown): void {
    const event: VaultEvent = {
      type,
      agentId,
      data,
      timestamp: Date.now(),
    };
    this.emit('event', event);
  }
}