import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { resolve } from 'path';
// Load env explicitly for local dev
if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
    dotenv.config({ path: resolve(process.cwd(), '../../.env') });
}
export class RuleEngine {
    supabase = null;
    // Fallback map for local testing if DB fails or env misconfigured
    localPolicies = new Map();
    localTxLog = new Map();
    constructor() {
        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (supabaseUrl && supabaseKey) {
            this.supabase = createClient(supabaseUrl, supabaseKey);
            console.log('[RuleEngine] Connected to Postgres database');
        }
        else {
            console.warn('[RuleEngine] Supabase configuration missing. Falling back to in-memory state (DATA WILL BE LOST ON REBOOT)');
        }
    }
    /**
     * Register a new policy for an agent
     */
    async registerPolicy(policy) {
        if (this.supabase) {
            // 1. Upsert Agent
            const { error: agentError } = await this.supabase
                .from('agents')
                .upsert({
                id: policy.agentId,
                max_lamports_per_tx: policy.maxLamportsPerTx,
                max_tx_per_minute: policy.maxTxPerMinute,
                paused: policy.paused
            });
            if (agentError) {
                console.error(`[RuleEngine] Failed to register agent ${policy.agentId}:`, agentError);
                return;
            }
            // 2. Clear existing programs + Insert new ones
            await this.supabase.from('agent_allowed_programs').delete().eq('agent_id', policy.agentId);
            const programsToInsert = policy.allowedPrograms.map(p => ({
                agent_id: policy.agentId,
                program_id: p
            }));
            if (programsToInsert.length > 0) {
                const { error: progError } = await this.supabase.from('agent_allowed_programs').insert(programsToInsert);
                if (progError)
                    console.error(`[RuleEngine] Failed to register programs for ${policy.agentId}:`, progError);
            }
        }
        else {
            this.localPolicies.set(policy.agentId, { ...policy });
            this.localTxLog.set(policy.agentId, []);
        }
    }
    /**
     * Update an existing policy
     */
    async updatePolicy(agentId, updates) {
        if (this.supabase) {
            const dbUpdates = { updated_at: new Date().toISOString() };
            if (updates.maxLamportsPerTx !== undefined)
                dbUpdates.max_lamports_per_tx = updates.maxLamportsPerTx;
            if (updates.maxTxPerMinute !== undefined)
                dbUpdates.max_tx_per_minute = updates.maxTxPerMinute;
            if (updates.paused !== undefined)
                dbUpdates.paused = updates.paused;
            const { error } = await this.supabase
                .from('agents')
                .update(dbUpdates)
                .eq('id', agentId);
            if (error) {
                console.error(`[RuleEngine] Failed to update policy for ${agentId}:`, error);
                return false;
            }
            if (updates.allowedPrograms) {
                await this.supabase.from('agent_allowed_programs').delete().eq('agent_id', agentId);
                const programsToInsert = updates.allowedPrograms.map(p => ({ agent_id: agentId, program_id: p }));
                if (programsToInsert.length > 0) {
                    await this.supabase.from('agent_allowed_programs').insert(programsToInsert);
                }
            }
            return true;
        }
        else {
            const policy = this.localPolicies.get(agentId);
            if (!policy)
                return false;
            this.localPolicies.set(agentId, { ...policy, ...updates });
            return true;
        }
    }
    /**
     * Get current policy for an agent
     */
    async getPolicy(agentId) {
        if (this.supabase) {
            const { data: agent, error } = await this.supabase
                .from('agents')
                .select(`
          id, max_lamports_per_tx, max_tx_per_minute, paused,
          agent_allowed_programs (program_id)
        `)
                .eq('id', agentId)
                .single();
            if (error || !agent)
                return undefined;
            return {
                agentId: agent.id,
                maxLamportsPerTx: Number(agent.max_lamports_per_tx),
                maxTxPerMinute: agent.max_tx_per_minute,
                paused: agent.paused,
                allowedPrograms: agent.agent_allowed_programs.map((p) => p.program_id)
            };
        }
        else {
            return this.localPolicies.get(agentId);
        }
    }
    /**
     * Get all registered policies (agents)
     */
    async getAllPolicies() {
        if (this.supabase) {
            const { data: agents, error } = await this.supabase
                .from('agents')
                .select(`
          id, max_lamports_per_tx, max_tx_per_minute, paused,
          agent_allowed_programs (program_id)
        `);
            if (error || !agents)
                return [];
            return agents.map(agent => ({
                agentId: agent.id,
                maxLamportsPerTx: Number(agent.max_lamports_per_tx),
                maxTxPerMinute: agent.max_tx_per_minute,
                paused: agent.paused,
                allowedPrograms: agent.agent_allowed_programs.map((p) => p.program_id)
            }));
        }
        else {
            return Array.from(this.localPolicies.values());
        }
    }
    /**
     * Check if an intent passes all rules
     */
    async check(intent) {
        const policy = await this.getPolicy(intent.agentId);
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
        if (this.supabase) {
            // Calculate exactly one minute ago
            const oneMinuteAgo = new Date(Date.now() - 60_000).toISOString();
            const { count, error } = await this.supabase
                .from('transactions')
                .select('*', { count: 'exact', head: true })
                .eq('agent_id', intent.agentId)
                .gte('created_at', oneMinuteAgo)
                // Rate limit applies only to EXECUTED transactions, not blocked ones
                .eq('status', 'EXECUTED');
            if (error) {
                console.error('[RuleEngine] DB rate limit check failed:', error);
            }
            const recentTxs = count || 0;
            if (recentTxs >= policy.maxTxPerMinute) {
                return {
                    approved: false,
                    reason: `Rate limit exceeded: ${recentTxs}/${policy.maxTxPerMinute} tx/min`
                };
            }
        }
        else {
            // Fallback
            const now = Date.now();
            const recentTxs = (this.localTxLog.get(intent.agentId) || []).filter(t => now - t < 60_000);
            if (recentTxs.length >= policy.maxTxPerMinute) {
                return {
                    approved: false,
                    reason: `Rate limit exceeded: ${recentTxs.length}/${policy.maxTxPerMinute} tx/min`
                };
            }
        }
        // All rules passed
        return { approved: true, reason: 'All rules passed' };
    }
    /**
     * Log an executed or blocked transaction to the database
     */
    async logTransaction(intent, status, signature = null, checkResult) {
        if (this.supabase) {
            const { error } = await this.supabase.from('transactions').insert({
                agent_id: intent.agentId,
                action: intent.action,
                lamports: intent.lamports,
                signature: signature,
                status: status,
                reasoning: intent.reasoning || checkResult?.reason || 'Unknown',
            });
            if (error) {
                console.error('[RuleEngine] DB Insert Error for transaction log:', error);
            }
        }
        else {
            if (status === 'EXECUTED') {
                const now = Date.now();
                const recentTxs = this.localTxLog.get(intent.agentId) || [];
                this.localTxLog.set(intent.agentId, [...recentTxs, now]);
            }
        }
    }
    /**
     * Emergency pause for an agent
     */
    async pauseAgent(agentId) {
        return this.updatePolicy(agentId, { paused: true });
    }
    /**
     * Resume a paused agent
     */
    async resumeAgent(agentId) {
        return this.updatePolicy(agentId, { paused: false });
    }
    /**
     * Check if agent is paused
     */
    async isPaused(agentId) {
        const policy = await this.getPolicy(agentId);
        return policy?.paused ?? true;
    }
    /**
     * Get transaction count for an agent in the last minute
     */
    async getTxCountLastMinute(agentId) {
        if (this.supabase) {
            const oneMinuteAgo = new Date(Date.now() - 60_000).toISOString();
            const { count } = await this.supabase
                .from('transactions')
                .select('*', { count: 'exact', head: true })
                .eq('agent_id', agentId)
                .gte('created_at', oneMinuteAgo)
                .eq('status', 'EXECUTED');
            return count || 0;
        }
        else {
            const now = Date.now();
            const recentTxs = (this.localTxLog.get(agentId) || []).filter(t => now - t < 60_000);
            return recentTxs.length;
        }
    }
}
//# sourceMappingURL=rule-engine.js.map