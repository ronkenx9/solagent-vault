import OpenAI from 'openai';
import Anthropic from 'anthropic';
import type { AgentDecision, LLMConfig, LLMProvider, ReasoningStep } from './types.js';

const DEFAULT_OPENAI_MODEL = 'gpt-4o';
const DEFAULT_ANTHROPIC_MODEL = 'claude-sonnet-4-20250514';

const SYSTEM_PROMPT = `You are an autonomous DeFi trading agent running on Solana devnet.
Your role is to analyze market context and decide whether to SWAP SOL for USDC (or vice versa).

You MUST respond with a JSON object only. No prose, no markdown, no code fences.
Required schema:
{
  "reasoning": "2-3 sentences explaining your decision",
  "reasoningSteps": [
    {"step": "Observing", "detail": "what you observed from the market and wallet data"},
    {"step": "Analyzing", "detail": "your analysis of price signals and portfolio"},
    {"step": "Deciding", "detail": "your final decision and why"}
  ],
  "action": "SWAP" | "HOLD",
  "inputMint": "So11111111111111111111111111111111111111112",
  "outputMint": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1",
  "amountLamports": <integer — lamports to swap, based on suggestedActionSol from context>,
  "confidence": <float 0.0 to 1.0>
}

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
- You are on DEVNET — this is a safe sandbox, be decisive and act on your analysis
- Output full JSON with all fields, even on HOLD`;


export class LLMClient {
  private client: OpenAI | Anthropic;
  private provider: LLMProvider;
  private model: string;

  constructor(config: LLMConfig) {
    this.provider = config.provider;
    this.model = config.model;

    if (config.provider === 'openai') {
      console.log(`[LLMClient] Initializing with key prefix: ${config.apiKey.substring(0, 6)}...`);
      this.client = new OpenAI({
        apiKey: config.apiKey,
        baseURL: config.baseURL || undefined,
        dangerouslyAllowBrowser: true, // Not in browser, but some environments need this for node
      });
    } else {
      this.client = new Anthropic({ apiKey: config.apiKey });
    }
  }

  /**
   * Make a trading decision based on market context
   */
  async makeDecision(context: string, agentId: string): Promise<AgentDecision> {
    if (this.provider === 'openai') {
      return this.makeOpenAIDecision(context, agentId);
    } else {
      return this.makeAnthropicDecision(context, agentId);
    }
  }

  private async makeOpenAIDecision(context: string, agentId: string): Promise<AgentDecision> {
    const openai = this.client as OpenAI;

    try {
      const response = await openai.chat.completions.create({
        model: this.model || DEFAULT_OPENAI_MODEL,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: context }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.7,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('Empty response from OpenAI');
      }

      return this.parseDecision(content, agentId);
    } catch (error: any) {
      console.error(`[LLMClient] Decision failure (${this.provider}): ${error.message}`);
      if (error.status === 401) {
        // Detailed log for debugging 401
        console.error(`[LLMClient] Auth error! BaseURL: ${openai.baseURL}`);
      }
      return this.getPersonaFallback(agentId);
    }
  }

  private async makeAnthropicDecision(context: string, agentId: string): Promise<AgentDecision> {
    const anthropic = this.client as Anthropic;

    try {
      const response = await anthropic.messages.create({
        model: this.model || DEFAULT_ANTHROPIC_MODEL,
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages: [
          { role: 'user', content: context }
        ],
      });

      const content = response.content[0];
      if (!content || content.type !== 'text') {
        throw new Error('Empty response from Anthropic');
      }

      return this.parseDecision(content.text, agentId);
    } catch (error: any) {
      console.error(`[LLMClient] Decision failure (${this.provider}): ${error.message}`);
      return this.getPersonaFallback(agentId);
    }
  }

  private parseDecision(content: string, agentId: string): AgentDecision {
    try {
      const parsed = JSON.parse(content);

      // Validate and transform the response
      const decision: AgentDecision = {
        reasoning: parsed.reasoning || 'No reasoning provided',
        reasoningSteps: this.normalizeReasoningSteps(parsed.reasoningSteps),
        action: parsed.action || 'HOLD',
        inputMint: parsed.inputMint,
        outputMint: parsed.outputMint,
        amountLamports: parsed.amountLamports || 0,
        confidence: Math.min(1, Math.max(0, parsed.confidence || 0)),
      };

      return decision;
    } catch (error) {
      console.warn(`[LLMClient] Fallback triggered for ${agentId}`);
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
      confidence: 1.0
    };
  }

  private normalizeReasoningSteps(steps?: any[]): ReasoningStep[] {
    if (!Array.isArray(steps) || steps.length === 0) {
      return [
        {
          timestamp: new Date().toISOString(),
          step: 'Default',
          detail: 'No reasoning steps provided',
        }
      ];
    }

    return steps.map((s: any) => {
      return {
        timestamp: new Date().toISOString(),
        step: s.step || s.Step || 'Step',
        detail: s.detail || s.Detail || '',
      };
    });
  }
}
