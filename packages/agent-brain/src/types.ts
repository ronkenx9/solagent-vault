import { z } from 'zod';

export type LLMProvider = 'openai' | 'anthropic';

export interface AgentStrategy {
  id: string;
  name: string;
  description: string;
  riskTolerance: 'low' | 'medium' | 'high';
  maxSwapPercent: number;      // Max % of portfolio to swap per tick
  minConfidenceThreshold: number; // Minimum confidence to execute
  targetTokens: string[];      // Tokens this agent trades
}

export interface MarketContext {
  timestamp: string;
  agentId: string;
  wallet: {
    address: string;
    solBalance: number;
    tokens: Record<string, number>;
  };
  market: {
    solPriceUsd: number;
    solChange1h: number;
    solChange24h: number;
    bestSwapRoute?: SwapQuote | null;
  };
  strategy: AgentStrategy;
}

export const reasoningStepSchema = z.object({
  timestamp: z.string(),
  step: z.string(),
  detail: z.string(),
});

export type ReasoningStep = z.infer<typeof reasoningStepSchema>;

export const agentDecisionSchema = z.object({
  reasoning: z.string(),
  reasoningSteps: z.array(reasoningStepSchema),
  action: z.enum(['SWAP', 'HOLD', 'TRANSFER']),
  inputMint: z.string().optional(),
  outputMint: z.string().optional(),
  amountLamports: z.number().optional().default(0),
  confidence: z.number().min(0).max(1),
});

export type AgentDecision = z.infer<typeof agentDecisionSchema>;

export interface SwapQuote {
  inputMint: string;
  outputMint: string;
  inAmount: string;
  outAmount: string;
  priceImpact: number;
  routePlan: RouteStep[];
}

export interface RouteStep {
  swapInfo: {
    amm: string;
    label: string;
    inputMint: string;
    outputMint: string;
  };
}

export interface AgentConfig {
  id: string;
  strategy: AgentStrategy;
  vaultEndpoint: string;
}

export interface AgentEvent {
  type: 'reasoning' | 'decision' | 'tx_result' | 'error' | 'tick';
  agentId: string;
  data: unknown;
  timestamp: number;
}

export interface LLMConfig {
  provider: LLMProvider;
  model: string;
  apiKey: string;
  baseURL?: string;  // For OpenAI-compatible endpoints (e.g. Groq)
}