import { EventEmitter } from 'events';
import { RuleEngine } from './rule-engine.js';
import { Signer, type SignerConfig } from './signer.js';
import type { AgentPolicy, Intent, VaultResult, VaultEvent, WalletBalance } from './types.js';
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
export class Vault extends EventEmitter {
  private ruleEngine: RuleEngine;
  private signer: Signer;

  constructor(config: VaultConfig) {
    super();
    this.ruleEngine = new RuleEngine();
    this.signer = new Signer({
      rpcUrl: config.rpcUrl,
      keyManager: config.keyManager,
      confirmOptions: config.confirmOptions,
    });
  }

  /**
   * Register a new policy for an agent
   */
  async registerPolicy(policy: AgentPolicy): Promise<void> {
    await this.ruleEngine.registerPolicy(policy);
    this.emitEvent('policy_updated', policy.agentId, { policy });
  }

  /**
   * Update an existing policy
   */
  async updatePolicy(agentId: string, updates: Partial<Omit<AgentPolicy, 'agentId'>>): Promise<boolean> {
    const result = await this.ruleEngine.updatePolicy(agentId, updates);
    if (result) {
      const policy = await this.ruleEngine.getPolicy(agentId);
      this.emitEvent('policy_updated', agentId, { policy });
    }
    return result;
  }

  /**
   * Get current policy for an agent
   */
  async getPolicy(agentId: string): Promise<AgentPolicy | undefined> {
    return this.ruleEngine.getPolicy(agentId);
  }

  /**
   * Verify an API key for a specific agent
   */
  async verifyAgentApiKey(agentId: string, apiKey: string): Promise<boolean> {
    return this.ruleEngine.verifyAgentApiKey(agentId, apiKey);
  }

  /**
   * Get all registered policies (agents)
   */
  async getAllPolicies(): Promise<AgentPolicy[]> {
    return this.ruleEngine.getAllPolicies();
  }

  /**
   * Execute an intent from an agent.
   * This is the main entry point for all agent transactions.
   */
  async execute(intent: Intent): Promise<VaultResult> {
    // 0. Pre-flight Autonomous Rent Upkeep Check
    // Proves infrastructure self-preservation separately from LLM logic
    const currentBalance = await this.getSigner().getBalance(intent.agentId);
    const rentExemptThreshold = 0.005; // 0.005 SOL safe buffer

    if ((currentBalance.sol - (intent.lamports / 1e9)) < rentExemptThreshold) {
      const reason = `Autonomous Rent Upkeep: Transaction would drain wallet below safe threshold (${rentExemptThreshold} SOL). Preserving rent-exemption.`;

      this.emitEvent('tx_blocked', intent.agentId, {
        intent,
        reason,
      });
      await this.ruleEngine.logTransaction(intent, 'BLOCKED', null, { approved: false, reason });
      return {
        success: false,
        signature: null,
        reason,
        ruleCheck: { approved: false, reason },
      };
    }

    // 1. Check rules first — agent cannot bypass this
    const check = await this.ruleEngine.check(intent);

    if (!check.approved) {
      this.emitEvent('tx_blocked', intent.agentId, {
        intent,
        reason: check.reason,
      });
      await this.ruleEngine.logTransaction(intent, 'BLOCKED', null, check);
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
          signature = await this.signer.sendSol(intent);
          break;

        case 'SWAP':
          signature = await this.signer.swapTokens(intent);
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

      await this.ruleEngine.logTransaction(intent, 'EXECUTED', signature, check);

      return {
        success: true,
        signature,
        reason: 'Transaction executed successfully',
        ruleCheck: check,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await this.ruleEngine.logTransaction(intent, 'FAILED', null, { approved: true, reason: errorMessage });
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
  async getWalletAddress(agentId: string): Promise<string> {
    const pubkey = await this.signer.getWalletAddress(agentId);
    return pubkey.toBase58();
  }

  /**
   * Emergency pause for an agent
   */
  async pauseAgent(agentId: string): Promise<boolean> {
    const result = await this.ruleEngine.pauseAgent(agentId);
    if (result) {
      this.emitEvent('agent_paused', agentId, { agentId });
    }
    return result;
  }

  /**
   * Resume a paused agent
   */
  async resumeAgent(agentId: string): Promise<boolean> {
    const result = await this.ruleEngine.resumeAgent(agentId);
    if (result) {
      this.emitEvent('agent_resumed', agentId, { agentId });
    }
    return result;
  }

  /**
   * Check if agent is paused
   */
  async isPaused(agentId: string): Promise<boolean> {
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
  async getTxCountLastMinute(agentId: string): Promise<number> {
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