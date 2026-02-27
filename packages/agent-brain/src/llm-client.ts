import OpenAI from 'openai';
import Anthropic from 'anthropic';
import type { AgentDecision, LLMConfig, LLMProvider, ReasoningStep } from './types.js';

const DEFAULT_OPENAI_MODEL = 'gpt-4o';
const DEFAULT_ANTHROPIC_MODEL = 'claude-sonnet-4-20250514';

const SYSTEM_PROMPT = `You are an autonomous DeFi trading agent on Solana devnet.
Your job is to analyze on-chain data and decide whether to execute a swap via Jupiter.

You MUST respond with a JSON object only. No prose, no markdown.
Schema:
{
  "reasoning": "string — explain your decision in 2-3 sentences",
  "reasoningSteps": [
    {"step": "Observing", "detail": "what you observed"},
    {"step": "Analyzing", "detail": "your analysis"},
    {"step": "Deciding", "detail": "your decision"}
  ],
  "action": "SWAP" | "HOLD" | "TRANSFER",
  "inputMint": "string — token mint address (optional)",
  "outputMint": "string — token mint address (optional)",
  "amountLamports": number,
  "confidence": number — 0 to 1
}

Rules you follow:
- Never trade if confidence < 0.6
- Never recommend an amount larger than your stated balance
- Always show your reasoning before your action
- Output the full JSON with all fields`;

export class LLMClient {
  private client: OpenAI | Anthropic;
  private provider: LLMProvider;
  private model: string;

  constructor(config: LLMConfig) {
    this.provider = config.provider;
    this.model = config.model;

    if (config.provider === 'openai') {
      this.client = new OpenAI({ apiKey: config.apiKey });
    } else {
      this.client = new Anthropic({ apiKey: config.apiKey });
    }
  }

  /**
   * Make a trading decision based on market context
   */
  async makeDecision(context: string): Promise<AgentDecision> {
    if (this.provider === 'openai') {
      return this.makeOpenAIDecision(context);
    } else {
      return this.makeAnthropicDecision(context);
    }
  }

  private async makeOpenAIDecision(context: string): Promise<AgentDecision> {
    const openai = this.client as OpenAI;

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

    return this.parseDecision(content);
  }

  private async makeAnthropicDecision(context: string): Promise<AgentDecision> {
    const anthropic = this.client as Anthropic;

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

    return this.parseDecision(content.text);
  }

  private parseDecision(content: string): AgentDecision {
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
      console.error('[LLMClient] Failed to parse decision:', error);
      console.error('[LLMClient] Raw content:', content);

      // Return a safe fallback
      return {
        reasoning: 'Failed to parse LLM response',
        reasoningSteps: [
          { timestamp: new Date().toISOString(), step: 'Error', detail: 'Parse failure' }
        ],
        action: 'HOLD',
        confidence: 0,
      };
    }
  }

  private normalizeReasoningSteps(steps?: unknown[]): ReasoningStep[] {
    if (!Array.isArray(steps) || steps.length === 0) {
      return [
        {
          timestamp: new Date().toISOString(),
          step: 'Default',
          detail: 'No reasoning steps provided',
        }
      ];
    }

    return steps.map((s: unknown) => {
      const step = s as Record<string, string>;
      return {
        timestamp: new Date().toISOString(),
        step: step.step || step.Step || 'Step',
        detail: step.detail || step.Detail || step.detail || '',
      };
    });
  }
}
