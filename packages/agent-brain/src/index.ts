export type {
  AgentStrategy,
  MarketContext,
  AgentDecision,
  ReasoningStep,
  SwapQuote,
  RouteStep,
  AgentConfig,
  AgentEvent,
  LLMConfig,
  LLMProvider,
} from './types.js';

export { AgentBrain } from './agent.js';
export { LLMClient } from './llm-client.js';
export { fetchMarketContext } from './market-context.js';

// Default strategies
export const DEFAULT_STRATEGIES = {
  MOMENTUM_TRADER: {
    id: 'momentum_trader',
    name: 'Momentum Trader',
    description: 'Aggressively trades based on short-term price movements',
    riskTolerance: 'high' as const,
    maxSwapPercent: 0.5,      // Up to 50% of portfolio
    minConfidenceThreshold: 0.6,
    targetTokens: ['SOL', 'USDC'],
  },
  CONSERVATIVE_HOLDER: {
    id: 'conservative_holder',
    name: 'Conservative Holder',
    description: 'Makes small, safe trades only when very confident',
    riskTolerance: 'low' as const,
    maxSwapPercent: 0.1,      // Max 10% of portfolio
    minConfidenceThreshold: 0.8,
    targetTokens: ['SOL', 'USDC'],
  },
  REBALANCER: {
    id: 'portfolio_rebalancer',
    name: 'Portfolio Rebalancer',
    description: 'Maintains target allocation between SOL and USDC',
    riskTolerance: 'medium' as const,
    maxSwapPercent: 0.25,    // Max 25% of portfolio
    minConfidenceThreshold: 0.7,
    targetTokens: ['SOL', 'USDC'],
  },
} as const;

// Token mint addresses
export const TOKENS = {
  SOL: 'So11111111111111111111111111111111111111112',
  USDC: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1',
  USDT: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
} as const;