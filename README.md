# SolAgent Vault

> Autonomous Wallet Infrastructure for AI Agents on Solana

**Hackathon Submission** | Devnet Target

## The Problem

AI agents need to transact onchain, but there's no secure way to let autonomous agents control money. Existing solutions either:
- Give agents full control (dangerous - one compromised agent = lost funds)
- Require manual approval for every transaction (defeats autonomy)

## The Solution

**SolAgent Vault** - a multi-layer wallet infrastructure where:

1. **Vault Core** - HD wallet engine with enforced security rules (spending limits, program whitelist, rate limiting)
2. **Agent Brain** - LLM-powered decision loop that reads market data and constructs intents
3. **Orchestrator** - Coordinates multiple agents with different strategies
4. **Dashboard** - Real-time observability into agent reasoning and transactions

```
┌─────────────────────────────────────────────────────────────┐
│                      ORCHESTRATOR                           │
│         Spawns agents · Assigns strategies                  │
└────────────────────────┬────────────────────────────────────┘
                         │ spawns N agents
          ┌──────────────┼──────────────┐
          ▼              ▼              ▼
   ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
   │  AGENT #1   │ │  AGENT #2   │ │  AGENT #3   │
   │ (Momentum)  │ │ (Conserve)  │ │ (Rebalance) │
   └──────┬──────┘ └──────┬──────┘ └──────┬──────┘
          │               │               │
          └───────────────┼───────────────┘
                          │ signed intents
                          ▼
          ┌───────────────────────────────┐
          │         VAULT CORE            │
          │  ┌─────────────────────────┐ │
          │  │    Rule Engine           │ │
          │  │  • Spending limits      │ │
          │  │  • Program whitelist    │ │
          │  │  • Rate limiter         │ │
          │  └────────────┬────────────┘ │
          └───────────────┼───────────────┘
                          ▼
          ┌───────────────────────────────┐
          │         SOLANA DEVNET         │
          └───────────────────────────────┘
```

## Quick Start

### Prerequisites

- Node.js 18+
- pnpm 8+

### Setup

```bash
# Clone and install
cd solagent-vault
pnpm install

# Generate a devnet mnemonic (for testing only!)
pnpm generate-seed

# Configure environment
# Edit .env with your API keys:
# OPENAI_API_KEY=sk-...
# Or ANTHROPIC_API_KEY=sk-ant-...
```

### Run Everything

```bash
# Terminal 1: Start the orchestrator (runs agents)
pnpm orchestrator

# Terminal 2: Start dashboard
pnpm dashboard
```

### Demo Scenarios

The orchestrator starts 3 agents automatically:

1. **agent-momentum-01** - Aggressive trader (high risk tolerance)
2. **agent-conservative-02** - Conservative holder (low risk)
3. **agent-rebalancer-03** - Portfolio rebalancer (medium risk)

Watch them reason, make decisions, and execute (or get blocked by) transactions in real-time.

## Key Features

### HD Wallet Derivation

One master seed → unlimited isolated agent wallets:

```typescript
const keypair = deriveAgentKeypair('agent-01'); // Deterministic
const keypair2 = deriveAgentKeypair('agent-02'); // Different keypair
```

Compromise one agent = compromise zero others.

### Rule Engine

Security enforced at vault layer, not agent layer:

```typescript
vault.registerPolicy({
  agentId: 'agent-01',
  maxLamportsPerTx: 500_000_000,    // 0.5 SOL max per tx
  allowedPrograms: ['JUP6LkbZ...'], // Only Jupiter swaps
  maxTxPerMinute: 2,                // Rate limit
  paused: false,
});
```

The agent **cannot bypass these rules** - they're enforced before any signing.

### LLM Reasoning Visible

Every decision includes a reasoning chain:

```json
{
  "reasoning": "SOL dropped 2.1% in the last hour. Portfolio risk is medium. Converting 0.1 SOL to USDC for stability.",
  "reasoningSteps": [
    {"step": "Observing", "detail": "SOL price: $98.50, 1h change: -2.1%"},
    {"step": "Analyzing", "detail": "Volatility exceeds threshold"},
    {"step": "Deciding", "detail": "Swap 0.1 SOL to USDC"}
  ],
  "action": "SWAP",
  "confidence": 0.75
}
```

This is logged and visible in the dashboard - judges see the agent "thinking."

### Demo Moment: Blocked Transactions

Watch the rule engine catch violations:

```
⚠ SECURITY: Transaction blocked for agent-momentum-01
   Reason: Exceeds spending limit: 600000000 > 500000000
   This demonstrates the rule engine is working correctly!
```

This proves your security model actually works.

## Architecture

```
solagent-vault/
├── packages/
│   ├── vault-core/           # HD wallet + rule engine
│   ├── agent-brain/          # LLM decision loop
│   ├── orchestrator/        # Multi-agent coordinator
│   ├── dashboard/            # Terminal UI for demos
│   └── shared/               # Constants & utilities
├── SKILLS.md                 # Machine-readable API manifest
└── docs/
    └── deep-dive.md          # Architecture explainer
```

## SKILLS.md Integration

Any AI agent can consume this vault via `SKILLS.md`:

```bash
curl -X POST http://localhost:3001/vault/execute \
  -H "Content-Type: application/json" \
  -d '{
    "agent_id": "my-agent",
    "action": "SWAP",
    "input_mint": "So11111111111111111111111111111111111111112",
    "output_mint": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1",
    "amount_lamports": 100000000,
    "reasoning": "..."
  }'
```

## Environment Variables

```bash
# Required
VAULT_MASTER_SEED="your 24-word mnemonic"

# Optional
OPENAI_API_KEY="sk-..."       # For GPT-4o decisions
ANTHROPIC_API_KEY="sk-ant-..." # For Claude decisions
SOLANA_RPC_URL="https://api.devnet.solana.com"
DASHBOARD_PORT=3000
VAULT_API_PORT=3001
```

## What's Not Production-Ready

- No HSM/TEE for master seed storage
- No multi-sig on vault
- Rules are off-chain (not enforced on-chain)
- Devnet only (mainnet disabled)

See `docs/deep-dive.md` for productionization roadmap.

## Built With

- [@solana/web3.js](https://solana.com/docs) - Solana SDK
- [bip39](https://github.com/bitcoinjs/bip39) - HD wallet derivation
- [OpenAI](https://platform.openai.com) / [Anthropic](https://www.anthropic.com) - LLM providers
- [chalk](https://github.com/chalk/chalk) - Terminal styling

## License

MIT
