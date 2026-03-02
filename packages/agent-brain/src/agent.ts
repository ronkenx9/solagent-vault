import { EventEmitter } from 'events';
import type { Vault } from '@solagent/vault-core';
import type { AgentStrategy, AgentDecision, AgentEvent, AgentConfig, LLMConfig, MarketContext } from './types.js';
import { LLMClient } from './llm-client.js';
import { fetchMarketContext } from './market-context.js';

// Token mint addresses
const SOL_MINT = 'So11111111111111111111111111111111111111112';
const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1';

/**
 * AgentBrain - The LLM decision loop for an autonomous agent.
 * Each agent instance runs this loop independently.
 */
export class AgentBrain extends EventEmitter {
  private vault: Vault;
  private config: AgentConfig;
  private llm: LLMClient;
  private running: boolean = false;
  private intervalId?: NodeJS.Timeout;

  constructor(vault: Vault, config: AgentConfig, llmConfig: LLMConfig) {
    super();
    this.vault = vault;
    this.config = config;
    this.llm = new LLMClient(llmConfig);
  }

  /**
   * Get the agent's ID
   */
  getAgentId(): string {
    return this.config.id;
  }

  /**
   * Get the agent's strategy
   */
  getStrategy(): AgentStrategy {
    return this.config.strategy;
  }

  private isProcessing: boolean = false;

  /**
   * Run the agent decision loop
   */
  async run(intervalSeconds: number = 30): Promise<void> {
    if (this.running) {
      console.log(`[AgentBrain:${this.config.id}] Already running`);
      return;
    }

    this.running = true;
    console.log(`[AgentBrain:${this.config.id}] Starting decision loop (interval: ${intervalSeconds}s)`);

    const loop = async () => {
      if (!this.running) return;

      if (this.isProcessing) {
        console.warn(`[AgentBrain:${this.config.id}] ⚠️ Previous tick still processing, skipping this cycle prevents race conditions.`);
      } else {
        this.isProcessing = true;
        try {
          await this.tick();
        } catch (err) {
          console.error(`[AgentBrain:${this.config.id}] Critical tick failure:`, err);
        } finally {
          this.isProcessing = false;
        }
      }

      // Schedule next tick only after this logic completes
      this.intervalId = setTimeout(loop, intervalSeconds * 1000);
    };

    // Kick off loop immediately
    loop();
  }

  /**
   * Stop the agent
   */
  stop(): void {
    if (this.intervalId) {
      clearTimeout(this.intervalId);
      this.intervalId = undefined;
    }
    this.running = false;
    console.log(`[AgentBrain:${this.config.id}] Stopped`);
  }

  /**
   * Check if the agent is running
   */
  isRunning(): boolean {
    return this.running;
  }

  /**
   * Execute one decision cycle
   */
  async tick(): Promise<void> {
    const agentId = this.config.id;
    const strategy = this.config.strategy;

    console.log(`[AgentBrain:${agentId}] Tick started`);

    try {
      // 1. Get wallet info
      const walletAddress = await this.vault.getWalletAddress(agentId);
      const balance = await this.vault.getBalance(agentId);

      // 2. Fetch market context
      const contextData = await fetchMarketContext(walletAddress, balance);
      // Get the agent's policy if available (for spend limit injection)
      const agentPolicy = await (this.vault as any).ruleEngine?.getPolicy?.(agentId);
      const maxSwapLamports = agentPolicy?.maxLamportsPerTx ?? 250_000_000;

      // Build enriched context for LLM
      const context = {
        ...(contextData as any),
        agentId,
        strategy,
        policy: {
          maxSwapLamports,
          maxSwapSol: maxSwapLamports / 1e9,
          note: `You MUST NOT set amountLamports above ${maxSwapLamports} or the transaction will be blocked.`,
        },
      };

      // 3. Emit tick event
      this.emitEvent('tick', { balance, timestamp: Date.now() });

      // 4. Ask LLM to reason and decide
      const contextJson = JSON.stringify(context, null, 2);
      console.log(`[AgentBrain:${agentId}] signal: ${(contextData as any).market?.priceSignal} | canTrade: ${(contextData as any).tradingHints?.canTrade} | maxSol: ${maxSwapLamports / 1e9}`);
      const decision = await this.llm.makeDecision(contextJson, agentId);

      // 5. Emit reasoning event (for dashboard visibility)
      this.emitEvent('reasoning', {
        decision,
        context,
        timestamp: Date.now(),
      });

      // 6. Check confidence threshold
      if (decision.confidence < strategy.minConfidenceThreshold) {
        console.log(`[AgentBrain:${agentId}] Confidence too low: ${decision.confidence} < ${strategy.minConfidenceThreshold}`);
        this.emitEvent('decision', {
          action: 'HOLD',
          reason: `Confidence below threshold: ${decision.confidence}`,
          timestamp: Date.now(),
        });
        return;
      }

      // 7. Check max swap percentage
      const percentageCap = Math.floor(balance.sol * strategy.maxSwapPercent * 1e9);
      if (decision.amountLamports && decision.amountLamports > percentageCap) {
        decision.amountLamports = percentageCap;
        console.log(`[AgentBrain:${agentId}] Capped amount to ${percentageCap} lamports (${strategy.maxSwapPercent * 100}% of balance)`);
      }

      // 8. Execute if action is SWAP
      if (decision.action === 'SWAP' && decision.amountLamports && decision.amountLamports > 0) {
        const inputMint = decision.inputMint || SOL_MINT;
        const outputMint = decision.outputMint || USDC_MINT;

        const result = await this.vault.execute({
          agentId,
          action: 'SWAP',
          destinationProgram: 'JUP6LkbZbjS1jKKwapdHNy74zaZWiGdp52teN2pLr',
          lamports: decision.amountLamports,
          reasoning: decision.reasoning,
          inputMint,
          outputMint,
        });

        this.emitEvent('tx_result', {
          decision,
          result,
          timestamp: Date.now(),
        });

        console.log(`[AgentBrain:${agentId}] Swap result:`, result);
      } else {
        this.emitEvent('decision', {
          action: decision.action,
          reason: decision.reasoning,
          timestamp: Date.now(),
        });
        console.log(`[AgentBrain:${agentId}] Decision: ${decision.action} (${decision.reasoning})`);
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[AgentBrain:${agentId}] Error:`, errorMessage);
      this.emitEvent('error', {
        error: errorMessage,
        timestamp: Date.now(),
      });
    }
  }

  /**
   * Force a decision (for manual triggering)
   */
  async forceDecision(): Promise<void> {
    await this.tick();
  }

  private emitEvent(type: AgentEvent['type'], data: unknown): void {
    const event: AgentEvent = {
      type,
      agentId: this.config.id,
      data,
      timestamp: Date.now(),
    };
    this.emit('event', event);
    // Also emit on the vault so listeners like vault-api pick it up
    this.vault.emit('event', event);
  }
}
