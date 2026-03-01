# SolAgent Vault

> **Autonomous AI Agent Wallets on Solana** — A prototype demonstrating multi-agent wallet management, autonomous transaction signing, and LLM-driven trading decisions on Solana devnet.

[![Devnet](https://img.shields.io/badge/network-devnet-blue)](https://explorer.solana.com)
[![Vercel](https://img.shields.io/badge/deployed-vercel-black)](https://solagent-vault.vercel.app)
[![Node](https://img.shields.io/badge/node-%3E%3D18-green)](https://nodejs.org)
[![pnpm](https://img.shields.io/badge/pnpm-%3E%3D8-orange)](https://pnpm.io)

### 🌍 [Live Dashboard: solagent-vault.vercel.app](https://solagent-vault.vercel.app)

---

## Overview

SolAgent Vault demonstrates how AI agents can autonomously manage Solana wallets — creating wallets, signing transactions, holding assets, and interacting with DeFi protocols without human intervention.

Three AI agents (BLADE, WARD, SAGE) run simultaneously with different risk profiles, each funded with their own derived wallet. A Groq LLM (llama-3.3-70b) powers each agent's decision loop, analyzing real-time market data and executing trades when confident.

```
┌─────────────────────────────────────────────────────────────┐
│  Orchestrator                                               │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                 │
│  │  BLADE   │  │   WARD   │  │   SAGE   │  ← AgentBrains  │
│  │ (GROQ)   │  │ (GROQ)   │  │ (GROQ)   │    + LLM        │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘                 │
│       └─────────────┴─────────────┘                        │
│                      ↓ intent                              │
│               ┌──────────────┐                             │
│               │  Vault Core  │ ← Policy Engine + Signer    │
│               └──────┬───────┘                             │
└──────────────────────┼─────────────────────────────────────┘
                        ↓ signed tx
              Solana Devnet RPC
                        ↓ SSE Events
              ┌─────────────────┐
              │   Vault API     │ → Public Dashboard (Vercel)
              └─────────────────┘
```

---

## Quickstart

### Prerequisites
- Node.js ≥ 18
- pnpm ≥ 8
- A Groq API key (free at [console.groq.com](https://console.groq.com))

### 1. Clone and install
```bash
git clone https://github.com/your-username/solagent-vault
cd solagent-vault
pnpm install
```

### 2. Configure environment
```bash
cp .env.example .env
```

Edit `.env`:
```env
# Required: 24-word seed phrase for HD wallet derivation (VAULT_MASTER_SEED or MASTER_SEED)
VAULT_MASTER_SEED="your twenty four word seed phrase here ..."

# Required: Groq LLM API key
OPENAI_API_KEY=gsk_...
OPENAI_BASE_URL=https://api.groq.com/openai/v1
LLM_MODEL=llama-3.3-70b-versatile

# Optional: Custom Solana RPC (defaults to public devnet)
SOLANA_RPC_URL=https://api.devnet.solana.com
```

> **Generate a seed:** `pnpm generate-seed`

### 3. Fund the agent wallets on devnet

Start the orchestrator briefly to see the agent addresses:
```bash
pnpm orchestrator
# Output: [Orchestrator] Agent agent-momentum-01: <ADDRESS>
#         [Orchestrator] Agent agent-conservative-02: <ADDRESS>
#         [Orchestrator] Agent agent-rebalancer-03: <ADDRESS>
```

Send devnet SOL to each address via [faucet.solana.com](https://faucet.solana.com).

### 4. Run

Open two terminals:

**Terminal 1 — Dashboard API:**
```bash
pnpm --filter @solagent/vault-api dev
# → http://localhost:3001
```

**Terminal 2 — Agent Orchestrator:**
```bash
pnpm orchestrator
```

Open [http://localhost:3001](http://localhost:3001) to see the live RPG dashboard.

---

## Architecture

### Packages

| Package | Description |
|---|---|
| `vault-core` | HD wallet derivation, policy engine, signer, on-chain balance |
| `agent-brain` | LLM client, market context, decision loop per agent |
| `orchestrator` | Multi-agent coordinator, SSE event broadcasting |
| `vault-api` | REST API + SSE server, serves the dashboard |
| `dashboard` | RPG-themed web dashboard (static HTML/CSS/JS) |

### Wallet Security
- One **master seed phrase** stored in `.env` (never committed to git)
- Each agent derives a **unique keypair** from the master seed using BIP-44 HD derivation: `m/44'/501'/{agentIndex}'/0'`
- **Private keys never leave vault-core** — agents submit intent objects, not signed transactions
- The policy engine acts as a **trust boundary**: LLM decisions cannot bypass spending caps or program whitelists

### 🛠️ Policy Engine & Governance
Each agent has an on-chain policy registered at startup, which can be dynamically managed from the dashboard:
- **Interactive Control**: Use the **Level Up** and **Level Down** buttons on the dashboard to scale risk.
- **Spending Caps**: Vault Core enforces `maxLamportsPerTx`.
- **Program Whitelisting**: Only approved protocols (e.g. Jupiter) are signable.
- **Emergency Stop**: Pause any agent instantly via the policy engine.

---

## Agent Profiles

| **SAGE** | Alchemist | Portfolio Rebalancer | 0.5 SOL | 45% |

---

## 🏆 Proof of Autonomy

This prototype has successfully demonstrated fully autonomous decision-making and on-chain signing.

**Verified Autonomous Transaction (Devnet):**
- **Agent**: SAGE (agent-rebalancer-03)
- **Signal**: BEARISH (-2.26% 24h drop detected)
- **Decision**: SWAP intent (Confidence: 0.52)
- **Policy**: ✅ Approved ("All rules passed")
- **Protocol**: SOL → WSOL wrap (via SPL Token Program fallback)
- **Signature**: `23rtXq2GEsYWiXTozxfiFRBH6w67HLQqbXsxAhT3qMP9e3gWxdhB8UwwFnQGSJDfJBVmXejFYyVGM1UA7hYiDWmg`
- **Explorer**: [View on Solana Explorer](https://explorer.solana.com/tx/23rtXq2GEsYWiXTozxfiFRBH6w67HLQqbXsxAhT3qMP9e3gWxdhB8UwwFnQGSJDfJBVmXejFYyVGM1UA7hYiDWmg?cluster=devnet)

---

## API Reference

See [SKILLS.md](./SKILLS.md) for full agent-readable API documentation.

### Key Endpoints

```
GET  http://localhost:3001/vault/health        — Health check
GET  http://localhost:3001/vault/balance/:id   — Agent SOL balance
GET  http://localhost:3001/vault/wallet/:id    — Agent public key
GET  http://localhost:3001/vault/events        — SSE stream
POST http://localhost:3001/vault/airdrop/:id   — Devnet airdrop
POST http://localhost:3001/vault/pause/:id     — Emergency pause
```

---

## Deep Dive

### How Agentic Wallets Work

1. **HD Derivation** — The master seed generates deterministic agent wallets. Each agent ID is hashed to a BIP-44 derivation index, producing an isolated keypair.
2. **Policy Registration** — Before starting, each agent's spending policy is registered with the vault (max lamports, allowed programs, tx rate).
3. **LLM Tick Loop** — Every 120 seconds, each agent: fetches its balance, retrieves market data (SOL price, Jupiter swap quote), calls Groq LLM with full context, and receives a `{ action, confidence, reasoning }` decision.
4. **Intent Execution** — If action=SWAP and confidence is above threshold, an intent is submitted to vault-core. The vault validates against policy, then signs and broadcasts the transaction.
5. **Real-time Streaming** — Every event (tick, reasoning, decision, tx_result) is streamed via SSE to the dashboard.

### Security Considerations
- **Key isolation**: agents never handle raw private keys
- **Sandboxed devnet**: no real funds at risk
- **Emergency pause**: any agent can be halted via API without restarting
- **Program whitelisting**: agents cannot interact with arbitrary smart contracts

---

## License

MIT
