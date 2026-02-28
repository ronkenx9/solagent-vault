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

export interface AgentDecision {
  reasoning: string;           // Human-readable reasoning chain
  reasoningSteps: ReasoningStep[]; // Structured step-by-step reasoning
  action: 'SWAP' | 'HOLD' | 'TRANSFER';
  inputMint?: string;
  outputMint?: string;
  amountLamports?: number;
  confidence: number;          // 0-1
}

export interface ReasoningStep {
  timestamp: string;
  step: string;
  detail: string;
}

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