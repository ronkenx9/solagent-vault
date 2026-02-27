import type { AgentPolicy, Intent, RuleCheckResult } from './types.js';

export class RuleEngine {
  private policies: Map<string, AgentPolicy> = new Map();
  private txLog: Map<string, number[]> = new Map();

  /**
   * Register a new policy for an agent
   */
  registerPolicy(policy: AgentPolicy): void {
    this.policies.set(policy.agentId, { ...policy });
    this.txLog.set(policy.agentId, []);
  }

  /**
   * Update an existing policy
   */
  updatePolicy(agentId: string, updates: Partial<Omit<AgentPolicy, 'agentId'>>): boolean {
    const policy = this.policies.get(agentId);
    if (!policy) return false;

    this.policies.set(agentId, { ...policy, ...updates });
    return true;
  }

  /**
   * Get current policy for an agent
   */
  getPolicy(agentId: string): AgentPolicy | undefined {
    return this.policies.get(agentId);
  }

  /**
   * Check if an intent passes all rules
   */
  check(intent: Intent): RuleCheckResult {
    const policy = this.policies.get(intent.agentId);

    if (!policy) {
      return { approved: false, reason: 'No policy registered for agent' };
    }

    if (policy.paused) {
      return { approved: false, reason: 'Agent wallet is paused' };
    }

    // Rule 1: Spending limit
    if (intent.lamports > policy.maxLamportsPerTx) {
      return {
        approved: false,
        reason: `Exceeds spending limit: ${intent.lamports} lamports > ${policy.maxLamportsPerTx} lamports limit`
      };
    }

    // Rule 2: Program whitelist
    if (!policy.allowedPrograms.includes(intent.destinationProgram)) {
      return {
        approved: false,
        reason: `Program not whitelisted: ${intent.destinationProgram}. Allowed: ${policy.allowedPrograms.join(', ')}`
      };
    }

    // Rule 3: Rate limit (transactions per minute)
    const now = Date.now();
    const recentTxs = (this.txLog.get(intent.agentId) || [])
      .filter(t => now - t < 60_000);

    if (recentTxs.length >= policy.maxTxPerMinute) {
      return {
        approved: false,
        reason: `Rate limit exceeded: ${recentTxs.length}/${policy.maxTxPerMinute} tx/min`
      };
    }

    // All rules passed — record transaction timestamp
    this.txLog.set(intent.agentId, [...recentTxs, now]);
    return { approved: true, reason: 'All rules passed' };
  }

  /**
   * Emergency pause for an agent
   */
  pauseAgent(agentId: string): boolean {
    const policy = this.policies.get(agentId);
    if (!policy) return false;
    policy.paused = true;
    return true;
  }

  /**
   * Resume a paused agent
   */
  resumeAgent(agentId: string): boolean {
    const policy = this.policies.get(agentId);
    if (!policy) return false;
    policy.paused = false;
    return true;
  }

  /**
   * Check if agent is paused
   */
  isPaused(agentId: string): boolean {
    const policy = this.policies.get(agentId);
    return policy?.paused ?? true;
  }

  /**
   * Get transaction count for an agent in the last minute
   */
  getTxCountLastMinute(agentId: string): number {
    const now = Date.now();
    const recentTxs = (this.txLog.get(agentId) || [])
      .filter(t => now - t < 60_000);
    return recentTxs.length;
  }

  /**
   * Clear transaction log (useful for testing)
   */
  clearTxLog(agentId?: string): void {
    if (agentId) {
      this.txLog.delete(agentId);
    } else {
      this.txLog.clear();
    }
  }
}
