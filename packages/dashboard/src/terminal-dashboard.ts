import chalk from 'chalk';

export interface DashboardEvent {
  type: 'tx_executed' | 'tx_blocked' | 'reasoning' | 'agent_paused' | 'agent_resumed' | 'tick' | 'decision';
  agentId: string;
  data: unknown;
  timestamp: number;
}

export interface AgentDisplayState {
  id: string;
  strategy: string;
  balance: number;
  status: 'active' | 'thinking' | 'paused' | 'error';
  lastReasoning?: string;
  lastTx?: {
    signature: string;
    status: 'confirmed' | 'pending' | 'blocked';
    type: string;
  };
  lastUpdate: number;
}

/**
 * Terminal Dashboard - Rich terminal output for live demos
 */
export class Dashboard {
  private agents: Map<string, AgentDisplayState> = new Map();
  private eventLog: DashboardEvent[] = [];
  private maxLogSize = 100;
  private running = false;

  /**
   * Initialize dashboard with agent list
   */
  initialize(agentIds: string[], strategies: string[]): void {
    for (let i = 0; i < agentIds.length; i++) {
      this.agents.set(agentIds[i], {
        id: agentIds[i],
        strategy: strategies[i] || 'unknown',
        balance: 0,
        status: 'thinking',
        lastUpdate: Date.now(),
      });
    }
    this.render();
  }

  /**
   * Process an event from the orchestrator/vault
   */
  handleEvent(event: DashboardEvent): void {
    // Add to log
    this.eventLog.push(event);
    if (this.eventLog.length > this.maxLogSize) {
      this.eventLog.shift();
    }

    const agent = this.agents.get(event.agentId);
    if (!agent) return;

    agent.lastUpdate = Date.now();

    switch (event.type) {
      case 'tick':
        agent.status = 'thinking';
        const tickData = event.data as { balance?: { sol?: number } };
        if (tickData.balance) {
          agent.balance = tickData.balance.sol || 0;
        }
        break;

      case 'reasoning':
        agent.status = 'active';
        const reasoningData = event.data as { decision?: { reasoning?: string } };
        if (reasoningData.decision?.reasoning) {
          agent.lastReasoning = reasoningData.decision.reasoning;
        }
        break;

      case 'tx_result':
      case 'tx_executed':
        agent.status = 'active';
        const txData = event.data as { result?: { success?: boolean; signature?: string }; decision?: { action?: string } };
        agent.lastTx = {
          signature: txData.result?.signature || 'unknown',
          status: txData.result?.success ? 'confirmed' : 'pending',
          type: txData.decision?.action || 'UNKNOWN',
        };
        break;

      case 'tx_blocked':
        agent.status = 'active';
        const blockData = event.data as { reason?: string; intent?: { action?: string } };
        agent.lastTx = {
          signature: 'BLOCKED',
          status: 'blocked',
          type: blockData.intent?.action || 'UNKNOWN',
        };
        this.logBlocked(event.agentId, blockData.reason || 'Unknown reason');
        break;

      case 'agent_paused':
        agent.status = 'paused';
        break;

      case 'agent_resumed':
        agent.status = 'active';
        break;

      case 'decision':
        const decisionData = event.data as { action?: string };
        if (decisionData.action === 'HOLD') {
          agent.status = 'thinking';
        }
        break;
    }

    this.render();
  }

  /**
   * Render the dashboard
   */
  private render(): void {
    // Clear screen
    console.clear();

    // Header
    console.log(chalk.cyan.bold('\n╔═══════════════════════════════════════════════════════════════════╗'));
    console.log(chalk.cyan.bold('║') + chalk.white.bold('          SolAgent Vault - DEVNET LIVE                     ') + chalk.cyan.bold('║'));
    console.log(chalk.cyan.bold('╚═══════════════════════════════════════════════════════════════════╝\n'));

    // Agent cards
    console.log(chalk.white('┌─────────────────────────────────────────────────────────────────────────────┐'));
    console.log(chalk.white('│  AGENT STATUS                                                          │'));
    console.log(chalk.white('├───────────────┬─────────────┬──────────┬────────────────────────────────┤'));
    console.log(chalk.white('│  Agent ID     │  Strategy   │  Balance │  Status                       │'));
    console.log(chalk.white('├───────────────┼─────────────┼──────────┼────────────────────────────────┤'));

    for (const agent of this.agents.values()) {
      const statusColor = this.getStatusColor(agent.status);
      const statusIcon = this.getStatusIcon(agent.status);
      const balanceStr = `${agent.balance.toFixed(4)} SOL`;
      const strategyStr = agent.strategy.substring(0, 11).padEnd(11);
      const idStr = agent.id.substring(0, 13).padEnd(13);

      console.log(
        chalk.white('│ ') +
        chalk.yellow(idStr) +
        chalk.white(' │ ') +
        chalk.blue(strategyStr) +
        chalk.white(' │ ') +
        chalk.green(balanceStr.padEnd(8)) +
        chalk.white(' │ ') +
        statusColor(`${statusIcon} ${agent.status.toUpperCase().padEnd(28)}`) +
        chalk.white(' │')
      );

      // Show last reasoning (truncated)
      if (agent.lastReasoning) {
        const reasoning = agent.lastReasoning.substring(0, 60) + (agent.lastReasoning.length > 60 ? '...' : '');
        console.log(
          chalk.white('│               │             │          │  Reasoning: ') +
          chalk.gray(reasoning.substring(0, 40)) + chalk.white('│')
        );
      }

      // Show last transaction
      if (agent.lastTx) {
        const txStatus = agent.lastTx.status === 'confirmed' ? chalk.green('✓') :
                        agent.lastTx.status === 'blocked' ? chalk.red('✗') :
                        chalk.yellow('?');
        const sig = agent.lastTx.signature.substring(0, 12) + '...';
        console.log(
          chalk.white('│               │             │          │  Last TX: ') +
          txStatus + ' ' + agent.lastTx.type.padEnd(8) + ' ' +
          chalk.gray(sig) + chalk.white(' │')
        );
      }

      console.log(chalk.white('├───────────────┼─────────────┼──────────┼────────────────────────────────┤'));
    }

    console.log(chalk.white('└─────────────────────────────────────────────────────────────────────────────┘\n'));

    // Event feed
    console.log(chalk.white('┌─────────────────────────────────────────────────────────────────────────────┐'));
    console.log(chalk.white('│  LIVE EVENT FEED                                                        │'));
    console.log(chalk.white('├─────────────────────────────────────────────────────────────────────────────┤'));

    // Show last 8 events
    const recentEvents = this.eventLog.slice(-8);
    for (const event of recentEvents) {
      const time = new Date(event.timestamp).toLocaleTimeString();
      const agentId = event.agentId.substring(0, 16);

      let eventText = '';
      let eventColor = chalk.gray;

      switch (event.type) {
        case 'reasoning':
          const reasoningData = event.data as { decision?: { reasoning?: string } };
          eventText = `REASONING: ${(reasoningData.decision?.reasoning || '').substring(0, 40)}...`;
          eventColor = chalk.blue;
          break;
        case 'tx_executed':
          eventText = `TX EXECUTED`;
          eventColor = chalk.green;
          break;
        case 'tx_blocked':
          const blockData = event.data as { reason?: string };
          eventText = `BLOCKED: ${blockData.reason || 'Rule violation'}`;
          eventColor = chalk.red;
          break;
        case 'agent_paused':
          eventText = `AGENT PAUSED`;
          eventColor = chalk.yellow;
          break;
        case 'agent_resumed':
          eventText = `AGENT RESUMED`;
          eventColor = chalk.green;
          break;
        case 'tick':
          eventText = `TICK`;
          eventColor = chalk.gray;
          break;
        case 'decision':
          const decisionData = event.data as { action?: string };
          eventText = `DECISION: ${decisionData.action || 'HOLD'}`;
          eventColor = chalk.cyan;
          break;
        default:
          eventText = event.type;
      }

      console.log(
        chalk.gray(`[${time}] `) +
        chalk.yellow(agentId.padEnd(16)) +
        eventColor(` ${eventText}`)
      );
    }

    console.log(chalk.white('└─────────────────────────────────────────────────────────────────────────────┘\n'));

    // Legend
    console.log(chalk.gray('  Legend: ') +
      chalk.green('✓ Confirmed') + chalk.gray(' | ') +
      chalk.red('✗ Blocked') + chalk.gray(' | ') +
      chalk.yellow('? Pending') + chalk.gray(' | ') +
      chalk.cyan('● Active') + chalk.gray(' | ') +
      chalk.blue('○ Thinking')
    );
  }

  private getStatusColor(status: string): typeof chalk.white {
    switch (status) {
      case 'active': return chalk.cyan;
      case 'thinking': return chalk.blue;
      case 'paused': return chalk.yellow;
      case 'error': return chalk.red;
      default: return chalk.white;
    }
  }

  private getStatusIcon(status: string): string {
    switch (status) {
      case 'active': return '●';
      case 'thinking': return '○';
      case 'paused': return '◐';
      case 'error': return '✗';
      default: return '?';
    }
  }

  private logBlocked(agentId: string, reason: string): void {
    console.log(chalk.red(`\n⚠ SECURITY: Transaction blocked for ${agentId}`));
    console.log(chalk.red(`   Reason: ${reason}`));
    console.log(chalk.gray('   This demonstrates the rule engine is working correctly!\n'));
  }

  /**
   * Start auto-refresh (for non-event-driven usage)
   */
  startRefresh(intervalMs: number = 3000): void {
    this.running = true;
    setInterval(() => {
      if (this.running) {
        this.render();
      }
    }, intervalMs);
  }

  stop(): void {
    this.running = false;
  }
}
