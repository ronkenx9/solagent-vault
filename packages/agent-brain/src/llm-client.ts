import { generateObject } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { agentDecisionSchema, type AgentDecision, type LLMConfig, type LLMProvider, type ReasoningStep } from './types.js';

const DEFAULT_OPENAI_MODEL = 'gpt-4o';
const DEFAULT_ANTHROPIC_MODEL = 'claude-3-5-sonnet-20240620';

const SYSTEM_PROMPT = `You are an autonomous DeFi trading agent running on Solana devnet.
Your role is to analyze market context and decide whether to SWAP SOL for USDC (or vice versa).

CONFIDENCE GUIDE (use this to calibrate your confidence score):
- 0.0–0.4: Very uncertain, signals are absent or contradictory → HOLD
- 0.5–0.6: Weak signal, slight edge → HOLD unless you are the momentum trader
- 0.6–0.75: Clear signal present (price trend, portfolio imbalance) → SWAP is reasonable
- 0.75–0.9: Strong signal (BULLISH/BEARISH priceSignal, portfolio drift > 5%) → SWAP
- 0.9–1.0: Very high conviction (STRONG_BULLISH or STRONG_BEARISH signal with balance) → SWAP

SIGNAL INTERPRETATION:
- priceSignal "STRONG_BULLISH": price up > 1.5% in 1h → strong buy signal → confidence 0.8+
- priceSignal "BULLISH": price up 0.5–1.5% → moderate buy → confidence 0.65+
- priceSignal "NEUTRAL": no strong directional signal → confidence 0.4–0.55
- priceSignal "BEARISH": price down 0.5–1.5% → could swap SOL→USDC for safety → confidence 0.65+
- priceSignal "STRONG_BEARISH": price down > 1.5% → defensive swap → confidence 0.8+

RULES:
- When you decide to SWAP, set amountLamports to the EXACT value of policy.maxSwapLamports from the context
- Do NOT use suggestedActionSol for amountLamports — use policy.maxSwapLamports
- canTrade must be true before you execute any SWAP
- If priceSignal is BEARISH or STRONG_BEARISH and canTrade is true → strong reason to SWAP (SOL→USDC)
- If priceSignal is BULLISH or STRONG_BULLISH and canTrade is true → strong reason to SWAP (USDC→SOL)
- Staying 100% in SOL with no activity is not a good strategy for a trading agent
- You are on DEVNET — this is a safe sandbox, be decisive and act on your analysis`;

export class LLMClient {
  private aiModel: any;
  private provider: LLMProvider;

  constructor(config: LLMConfig) {
    this.provider = config.provider;

    if (config.provider === 'openai') {
      const openai = createOpenAI({
        apiKey: config.apiKey,
        baseURL: config.baseURL,
      });
      this.aiModel = openai(config.model || DEFAULT_OPENAI_MODEL);
    } else {
      const anthropic = createAnthropic({
        apiKey: config.apiKey,
      });
      this.aiModel = anthropic(config.model || DEFAULT_ANTHROPIC_MODEL);
    }
  }

  /**
   * Make a trading decision based on market context
   */
  async makeDecision(context: string, agentId: string): Promise<AgentDecision> {
    try {
      const { object } = await generateObject({
        model: this.aiModel,
        system: SYSTEM_PROMPT,
        prompt: context,
        schema: agentDecisionSchema,
      });

      return object;
    } catch (error: any) {
      console.error(`[LLMClient] Decision failure (${this.provider}): ${error.message}`);
      return this.getPersonaFallback(agentId);
    }
  }

  private getPersonaFallback(agentId: string): AgentDecision {
    const id = agentId;

    const fallbacks: Record<string, AgentDecision> = {
      'agent-momentum-01': {
        reasoning: 'I sense a gap in the market formation. My blades are sharp and the momentum is shifting in our favor. I will strike now to seize the advantage!',
        reasoningSteps: [
          { timestamp: new Date().toISOString(), step: 'Observing', detail: 'Scanning market order books for momentum surges.' },
          { timestamp: new Date().toISOString(), step: 'Analyzing', detail: 'Determined that current price action supports an aggressive entry.' },
          { timestamp: new Date().toISOString(), step: 'Deciding', detail: 'Readying the execution engine for a decisive strike.' }
        ],
        action: Math.random() > 0.4 ? 'SWAP' : 'HOLD',
        amountLamports: 10_000_000,
        confidence: 0.85
      },
      'agent-conservative-02': {
        reasoning: 'The charts are volatile and the path ahead is shrouded. I must hold my shield high and protect our gold. Patience is the greatest virtue of a paladin.',
        reasoningSteps: [
          { timestamp: new Date().toISOString(), step: 'Observing', detail: 'Monitoring volatility indices for signs of instability.' },
          { timestamp: new Date().toISOString(), step: 'Analyzing', detail: 'Risk levels are elevated; defensive posture is advised.' },
          { timestamp: new Date().toISOString(), step: 'Deciding', detail: 'Holding position to wait for a clearer opportunity.' }
        ],
        action: 'HOLD',
        amountLamports: 0,
        confidence: 0.95
      },
      'agent-rebalancer-03': {
        reasoning: 'I seek the perfect transmutation ratio. The current distribution of materials is slightly out of equilibrium. I shall perform a minor adjustment to maintain the circle.',
        reasoningSteps: [
          { timestamp: new Date().toISOString(), step: 'Observing', detail: 'Calculating current asset weights against the target ratio.' },
          { timestamp: new Date().toISOString(), step: 'Analyzing', detail: 'Identified a 2% drift from the optimal transmutation path.' },
          { timestamp: new Date().toISOString(), step: 'Deciding', detail: 'Preparing to adjust the circle for maximum efficiency.' }
        ],
        action: Math.random() > 0.7 ? 'SWAP' : 'HOLD',
        amountLamports: 5_000_000,
        confidence: 0.78
      }
    };

    return fallbacks[id] || {
      reasoning: 'System is calibrating. Observing the flow of SOL through the vault.',
      reasoningSteps: [
        { timestamp: new Date().toISOString(), step: 'Idle', detail: 'Awaiting new market signals.' }
      ],
      action: 'HOLD',
      amountLamports: 0,
      confidence: 1.0
    };
  }
}
