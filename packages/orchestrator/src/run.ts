import 'dotenv/config';
import { Orchestrator, createDefaultAgentConfigs } from './orchestrator.js';
// Dashboard is optional — comment out if not available
// import { Dashboard } from '@solagent/dashboard';

// Check for required environment variables
const requiredEnvVars = ['MASTER_SEED'];
const missing = requiredEnvVars.filter(v => !process.env[v]);

if (missing.length > 0) {
  console.error(`\n❌ Missing required environment variables: ${missing.join(', ')}`);
  console.log(`\nPlease create a .env file with:`);
  console.log(`  MASTER_SEED="your 24-word mnemonic"`);
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

  // Create LLM config — supports Groq via OPENAI_BASE_URL
  const llmConfig = {
    provider: hasOpenAI ? 'openai' as const : 'anthropic' as const,
    model: hasOpenAI
      ? (process.env.LLM_MODEL || 'llama-3.3-70b-versatile')
      : 'claude-sonnet-4-20250514',
    apiKey: hasOpenAI ? process.env.OPENAI_API_KEY! : process.env.ANTHROPIC_API_KEY!,
    baseURL: process.env.OPENAI_BASE_URL || undefined,
  };

  // Create orchestrator
  const orchestrator = new Orchestrator({
    llmConfig,
    rpcUrl: process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com',
    agents: createDefaultAgentConfigs(),
    tickIntervalSeconds: 120,
  });

  // Dashboard is optional — using SSE via vault-api server instead
  // const dashboard = new Dashboard();
  // const agentConfigs = createDefaultAgentConfigs();
  // dashboard.initialize(
  //   agentConfigs.map((c: any) => c.id),
  //   agentConfigs.map((c: any) => c.strategy.name)
  // );

  // Forward orchestrator events to console AND to vault-api SSE broadcast
  const VAULT_API = process.env.VAULT_API_URL || 'http://localhost:3001';
  orchestrator.on('event', (event: any) => {
    console.log(`[Event] ${event.type}`, JSON.stringify(event.data).slice(0, 120));
    // POST to vault-api so SSE clients (dashboard) receive the event
    fetch(`${VAULT_API}/vault/broadcast`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.VAULT_API_KEY}`
      },
      body: JSON.stringify(event),
    }).catch((err) => {
      console.warn(`[Orchestrator] Failed to broadcast event: ${err.message}`);
    });
  });

  // Handle shutdown
  process.on('SIGINT', async () => {
    console.log('\n\n🛑 Shutting down...');
    await orchestrator.stop();
    process.exit(0);
  });

  // Initialize and start
  await orchestrator.initialize();

  // Sync active agents to the Vault API so the Dashboard dynamically renders them
  for (const agent of orchestrator.getAllAgentStatuses()) {
    const policy = await orchestrator.getVault().getPolicy(agent.id);
    if (policy) {
      try {
        await fetch(`${VAULT_API}/vault/policy`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.VAULT_API_KEY}`
          },
          body: JSON.stringify({
            agent_id: policy.agentId,
            max_lamports_per_tx: policy.maxLamportsPerTx,
            allowed_programs: policy.allowedPrograms,
            max_tx_per_minute: policy.maxTxPerMinute,
          }),
        });
      } catch (err) {
        console.warn(`[Orchestrator] Failed to sync policy to API for ${agent.id}`);
      }
    }
  }

  console.log('\n📊 Dashboard running. Press Ctrl+C to stop.\n');

  await orchestrator.start();
}

main().catch(console.error);
