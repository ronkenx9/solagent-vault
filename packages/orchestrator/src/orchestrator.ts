import { EventEmitter } from 'events';
import { Vault, type VaultConfig } from '@solagent/vault-core';
import { AgentBrain, DEFAULT_STRATEGIES, type LLMConfig, type AgentConfig, type AgentStrategy } from '@solagent/agent-brain';
import type { OrchestratorConfig, OrchestratorAgentConfig, OrchestratorState, OrchestratorAgentState, OrchestratorEvent } from './types.js';

// Default RPC for devnet
const DEFAULT_RPC_URL = 'https://api.devnet.solana.com';

/**
 * Orchestrator - Manages multiple AI agents with different strategies
 */
export class Orchestrator extends EventEmitter {
  private vault: Vault;
  private agents: Map<string, AgentBrain> = new Map();
  private config: OrchestratorConfig;
  private state: OrchestratorState;
  private llmConfig: LLMConfig;

  constructor(config: Partial<OrchestratorConfig> & { llmConfig: LLMConfig }) {
    super();

    this.llmConfig = config.llmConfig;

    this.vault = new Vault({
      rpcUrl: (config as any).rpcUrl || DEFAULT_RPC_URL,
    });

    this.config = {
      vault: this.vault,
      agents: config.agents || [],
      tickIntervalSeconds: config.tickIntervalSeconds || 30,
    };

    this.state = {
      running: false,
      agents: new Map(),
    };

    // Note: Agent events flow to vault via AgentBrain.emitEvent() directly.
    // Orchestrator receives them via agentBrain.on('event') in startAgent().
    // No need to forward vault events here — that would duplicate them.
  }

  /**
   * Get the vault instance
   */
  getVault(): Vault {
    return this.vault;
  }

  /**
   * Get current state
   */
  getState(): OrchestratorState {
    return {
      ...this.state,
      agents: new Map(this.state.agents),
    };
  }

  /**
   * Initialize all agents (register policies, airdrop)
   */
  async initialize(): Promise<void> {
    console.log('[Orchestrator] Initializing agents...');

    for (const agentConfig of this.config.agents) {
      // Register policy
      this.vault.registerPolicy({
        agentId: agentConfig.id,
        maxLamportsPerTx: agentConfig.policies.maxLamportsPerTx,
        allowedPrograms: agentConfig.policies.allowedPrograms,
        maxTxPerMinute: agentConfig.policies.maxTxPerMinute,
        paused: false,
      });

      // Get wallet address
      const walletAddress = this.vault.getWalletAddress(agentConfig.id);
      console.log(`[Orchestrator] Agent ${agentConfig.id}: ${walletAddress}`);

      // Initialize agent state
      this.state.agents.set(agentConfig.id, {
        id: agentConfig.id,
        strategy: agentConfig.strategy,
        running: false,
      });

      // Skip airdrop for now since we funded manually
      // console.log(`[Orchestrator] Skipping auto-airdrop for ${agentConfig.id} (already funded)`);
      /*
      try {
        await this.vault.requestAirdrop(agentConfig.id, 2);
        console.log(`[Orchestrator] Airdropped 2 SOL to ${agentConfig.id}`);
      } catch (error) {
        console.warn(`[Orchestrator] Airdrop failed for ${agentConfig.id}:`, error);
      }
      */
    }

    console.log('[Orchestrator] Initialization complete');
  }

  /**
   * Start all agents
   */
  async start(): Promise<void> {
    if (this.state.running) {
      console.log('[Orchestrator] Already running');
      return;
    }

    console.log('[Orchestrator] Starting all agents...');

    for (const agentConfig of this.config.agents) {
      await this.startAgent(agentConfig.id);
    }

    this.state.running = true;
    this.state.startedAt = Date.now();

    this.emitEvent('orchestrator_started', {});
    console.log('[Orchestrator] All agents started');
  }

  /**
   * Start a specific agent
   */
  async startAgent(agentId: string): Promise<void> {
    const agentConfig = this.config.agents.find(a => a.id === agentId);
    if (!agentConfig) {
      throw new Error(`Agent ${agentId} not found in config`);
    }

    // Create agent
    const agentBrain = new AgentBrain(this.vault, {
      id: agentConfig.id,
      strategy: agentConfig.strategy,
      vaultEndpoint: '',
    }, this.llmConfig);

    // Forward events
    agentBrain.on('event', (event) => {
      this.emit('event', event);

      // Update state
      const state = this.state.agents.get(agentId);
      if (state) {
        state.lastTick = Date.now();
        if (event.type === 'error') {
          state.lastError = (event.data as { error?: string }).error;
        }
      }
    });

    // Start agent
    await agentBrain.run(this.config.tickIntervalSeconds);

    this.agents.set(agentId, agentBrain);

    const state = this.state.agents.get(agentId);
    if (state) {
      state.running = true;
    }

    this.emitEvent('agent_started', { agentId });
    console.log(`[Orchestrator] Agent ${agentId} started`);
  }

  /**
   * Stop all agents
   */
  async stop(): Promise<void> {
    if (!this.state.running) {
      return;
    }

    console.log('[Orchestrator] Stopping all agents...');

    for (const [agentId, agent] of this.agents) {
      agent.stop();

      const state = this.state.agents.get(agentId);
      if (state) {
        state.running = false;
      }

      this.emitEvent('agent_stopped', { agentId });
    }

    this.agents.clear();
    this.state.running = false;

    this.emitEvent('orchestrator_stopped', {});
    console.log('[Orchestrator] All agents stopped');
  }

  /**
   * Stop a specific agent
   */
  async stopAgent(agentId: string): Promise<void> {
    const agent = this.agents.get(agentId);
    if (!agent) {
      return;
    }

    agent.stop();
    this.agents.delete(agentId);

    const state = this.state.agents.get(agentId);
    if (state) {
      state.running = false;
    }

    this.emitEvent('agent_stopped', { agentId });
  }

  /**
   * Pause an agent
   */
  pauseAgent(agentId: string): boolean {
    return this.vault.pauseAgent(agentId);
  }

  /**
   * Resume an agent
   */
  resumeAgent(agentId: string): boolean {
    return this.vault.resumeAgent(agentId);
  }

  /**
   * Get agent status
   */
  getAgentStatus(agentId: string): OrchestratorAgentState | undefined {
    return this.state.agents.get(agentId);
  }

  /**
   * Get all agent statuses
   */
  getAllAgentStatuses(): OrchestratorAgentState[] {
    return Array.from(this.state.agents.values());
  }

  /**
   * Force tick for an agent
   */
  async tickAgent(agentId: string): Promise<void> {
    const agent = this.agents.get(agentId);
    if (agent) {
      await agent.forceDecision();
    }
  }

  private emitEvent(type: OrchestratorEvent['type'], data: unknown): void {
    const event: OrchestratorEvent = {
      type,
      data,
      timestamp: Date.now(),
    };
    this.emit('event', event);
  }
}

/**
 * Create default agent configurations for demo
 */
export function createDefaultAgentConfigs(): OrchestratorAgentConfig[] {
  return [
    // ── BLADE and WARD disabled to save LLM costs ──
    // Re-enable by uncommenting:
    {
      id: 'agent-momentum-01',
      strategy: { ...DEFAULT_STRATEGIES.MOMENTUM_TRADER, targetTokens: [...DEFAULT_STRATEGIES.MOMENTUM_TRADER.targetTokens] },
      policies: {
        maxLamportsPerTx: 500_000_000,
        allowedPrograms: ['JUP6LkbZbjS1jKKwapdHNy74zaZWiGdp52teN2pLr'],
        maxTxPerMinute: 3,
      },
    },
    // {
    //   id: 'agent-conservative-02',
    //   strategy: { ...DEFAULT_STRATEGIES.CONSERVATIVE_HOLDER, targetTokens: [...DEFAULT_STRATEGIES.CONSERVATIVE_HOLDER.targetTokens] },
    //   policies: {
    //     maxLamportsPerTx: 100_000_000,
    //     allowedPrograms: ['JUP6LkbZbjS1jKKwapdHNy74zaZWiGdp52teN2pLr'],
    //     maxTxPerMinute: 1,
    //   },
    // },
    {
      // ── SAGE: Active agent (5 SOL wallet) ──
      id: 'agent-rebalancer-03',
      strategy: { ...DEFAULT_STRATEGIES.REBALANCER, targetTokens: [...DEFAULT_STRATEGIES.REBALANCER.targetTokens] },
      policies: {
        maxLamportsPerTx: 500_000_000,    // 0.5 SOL — 10% of 5 SOL wallet
        allowedPrograms: [
          'JUP6LkbZbjS1jKKwapdHNy74zaZWiGdp52teN2pLr', // Jupiter Aggregator v6
          'DFLOWxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        ],
        maxTxPerMinute: 2,
      },
    },
  ];
}

