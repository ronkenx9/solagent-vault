import type { AgentPolicy, Intent, RuleCheckResult } from './types.js';
export declare class RuleEngine {
    private supabase;
    private localPolicies;
    private localTxLog;
    constructor();
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
     * Check if an intent passes all rules
     */
    check(intent: Intent): Promise<RuleCheckResult>;
    /**
     * Log an executed or blocked transaction to the database
     */
    logTransaction(intent: Intent, status: 'EXECUTED' | 'BLOCKED' | 'FAILED', signature?: string | null, checkResult?: RuleCheckResult): Promise<void>;
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
     * Get transaction count for an agent in the last minute
     */
    getTxCountLastMinute(agentId: string): Promise<number>;
}
