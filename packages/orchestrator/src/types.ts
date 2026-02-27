import type { Vault } from '@solagent/vault-core';
import type { AgentBrain } from '@solagent/agent-brain';
import type { AgentStrategy } from '@solagent/agent-brain';

export interface OrchestratorConfig {
  vault: Vault;
  agents: OrchestratorAgentConfig[];
  tickIntervalSeconds: number;
}

export interface OrchestratorAgentConfig {
  id: string;
  strategy: AgentStrategy;
  policies: {
    maxLamportsPerTx: number;
    allowedPrograms: string[];
    maxTxPerMinute: number;
  };
}

export interface OrchestratorState {
  running: boolean;
  agents: Map<string, OrchestratorAgentState>;
  startedAt?: number;
}

export interface OrchestratorAgentState {
  id: string;
  strategy: AgentStrategy;
  running: boolean;
  lastTick?: number;
  lastError?: string;
}

export interface OrchestratorEvent {
  type: 'agent_started' | 'agent_stopped' | 'agent_error' | 'orchestrator_started' | 'orchestrator_stopped';
  agentId?: string;
  data: unknown;
  timestamp: number;
}
