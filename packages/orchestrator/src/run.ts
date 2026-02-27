import 'dotenv/config';
import { Orchestrator, createDefaultAgentConfigs } from './src/orchestrator.js';
import { Dashboard } from '@solagent/dashboard';

// Check for required environment variables
const requiredEnvVars = ['VAULT_MASTER_SEED'];
const missing = requiredEnvVars.filter(v => !process.env[v]);

if (missing.length > 0) {
  console.error(`\n❌ Missing required environment variables: ${missing.join(', ')}`);
  console.log(`\nPlease create a .env file with:`);
  console.log(`  VAULT_MASTER_SEED="your 24-word mnemonic"`);
  console.log(`  OPENAI_API_KEY="sk-..."`);
  console.log(`\nRun: pnpm generate-seed\n`);
  process.exit(1);
}

// Check for LLM API key
const hasOpenAI = !!process.env.OPENAI_API_KEY;
const hasAnthropic = !!process.env.ANTHROPIC_API_KEY;

if (!hasOpenAI && !hasAnthropic) {
  console.error(`\n❌ Missing LLM API key`);
  console.log(`Please set either OPENAI_API_KEY or ANTHROPIC_API_KEY in .env\n`);
  process.exit(1);
}

async function main() {
  console.log('\n🚀 Starting SolAgent Vault...\n');

  // Create LLM config
  const llmConfig = {
    provider: hasOpenAI ? 'openai' as const : 'anthropic' as const,
    model: hasOpenAI ? 'gpt-4o' : 'claude-sonnet-4-20250514',
    apiKey: hasOpenAI ? process.env.OPENAI_API_KEY! : process.env.ANTHROPIC_API_KEY!,
  };

  // Create orchestrator
  const orchestrator = new Orchestrator({
    llmConfig,
    rpcUrl: process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com',
    agents: createDefaultAgentConfigs(),
    tickIntervalSeconds: 30,
  });

  // Create dashboard
  const dashboard = new Dashboard();

  // Initialize dashboard with agent info
  const agentConfigs = createDefaultAgentConfigs();
  dashboard.initialize(
    agentConfigs.map(c => c.id),
    agentConfigs.map(c => c.strategy.name)
  );

  // Forward orchestrator events to dashboard
  orchestrator.on('event', (event: any) => {
    dashboard.handleEvent({
      type: event.type as any,
      agentId: event.agentId || 'system',
      data: event.data,
      timestamp: event.timestamp,
    });
  });

  // Handle shutdown
  process.on('SIGINT', async () => {
    console.log('\n\n🛑 Shutting down...');
    await orchestrator.stop();
    dashboard.stop();
    process.exit(0);
  });

  // Initialize and start
  await orchestrator.initialize();

  console.log('\n📊 Dashboard running. Press Ctrl+C to stop.\n');

  await orchestrator.start();
}

main().catch(console.error);
