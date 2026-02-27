import { PublicKey, Transaction } from '@solana/web3.js';

export interface AgentPolicy {
  agentId: string;
  maxLamportsPerTx: number;
  allowedPrograms: string[];
  maxTxPerMinute: number;
  paused: boolean;
}

export type IntentAction = 'TRANSFER' | 'SWAP' | 'STAKE';

export interface Intent {
  agentId: string;
  action: IntentAction;
  destinationProgram: string;
  lamports: number;
  reasoning: string;
  inputMint?: string;
  outputMint?: string;
}

export interface RuleCheckResult {
  approved: boolean;
  reason: string;
}

export interface VaultResult {
  success: boolean;
  signature: string | null;
  reason: string;
  ruleCheck?: RuleCheckResult;
}

export interface WalletBalance {
  sol: number;
  tokens: Record<string, number>;
}

export interface VaultEvent {
  type: 'tx_executed' | 'tx_blocked' | 'reasoning' | 'policy_updated' | 'agent_paused' | 'agent_resumed';
  agentId: string;
  data: unknown;
  timestamp: number;
}

export type EventCallback = (event: VaultEvent) => void;
