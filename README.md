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

## 🧠 Deep Dive: Security Architecture & Threat Model

The SolAgent Vault is not just a hot wallet script; it is a **secure execution environment** designed for autonomous agents. We enforce spending limits at the wallet layer, not the agent layer, ensuring that even a compromised LLM cannot drain the treasury.

### 1. The Trust Boundary (Agent vs. Vault)
The architecture enforces a strict one-way flow of intent across a defined trust boundary:
- **Untrusted Zone (Agent Brain):** The LLM (llama-3.3-70b) reads on-chain data and evaluates pricing momentum. It emits a *strictly typed JSON intent* (e.g., `{"action": "SWAP", "amount": 10}`). The agent has **no access** to the private key.
- **Trusted Zone (Vault API & Core):** The Vault authenticates the intent via Bearer Tokens, cross-references the requested `amountLamports` against the hardcoded Security Policy Engine, and securely constructs the Solana transaction.

### 2. Threat Modeling: Compromised Agents & Spending Limits
*What happens if the LLM hallucinates, or if the Groq API key is compromised and a malicious actor prompts the agent to drain the wallet?*
- **The LLM cannot formulate arbitrary transactions.** It can only pick from a Zod schema (`SWAP`, `TRANSFER`, `HOLD`).
- **Spending Limits at the Wallet Layer:** Even if the LLM tries to send 1000 SOL, the `vault-core` Rule Engine will intercept the payload and hard-reject it because it exceeds the `maxLamportsPerTx` policy constraint. 
- **Simulate-before-Sign:** The Vault performs a `simulateTransaction` check on Devnet RPC. If the transaction would fail or exceed slippage, the Vault drops the payload *before* signing, saving gas.

### 3. Safe Key Management (Enterprise MPC Enclaves)
A fundamental requirement for agentic wallets is that the AI **never** holds the private key.
- In `local` mode, `KeyManager` derives HD wallets dynamically on the fly per agent.
- In `production` mode, setting `USE_TURNKEY=true` dynamically swaps the standard keys for the `TurnkeyKeyManager`. The Vault constructs *unsigned* Solana transactions and broadcasts them to Turnkey's secure Multi-Party Computation (MPC) hardware enclaves. The private keys physically never touch the node server environment.

### 4. Multi-Agent Coordination at Scale
The bounty requires handling multiple agents. The SolAgent Orchestrator asynchronously queries `N` unique Agent Profiles (e.g., BLADE, WARD, SAGE) from a Supabase PostgreSQL instance. 
Each agent receives a dynamically derived wallet (via an HD derivation path based on its `agentId`). This means a single Master Seed spawns an infinite number of perfectly isolated agent wallets, proving the architecture scales from 1 agent to 10,000 agents without overhead.

---

## API Reference & Skill Integration

Are you an AI Agent looking to integrate with this Vault? Read the [SKILLS.md](./SKILLS.md) file at the root of the repository.

### Manual API Endpoints

```
GET  http://localhost:3001/vault/health        — Health check
GET  http://localhost:3001/vault/balance/:id   — Agent SOL balance
GET  http://localhost:3001/vault/wallet/:id    — Agent public key
GET  http://localhost:3001/vault/events        — SSE stream (Dashboard)
POST http://localhost:3001/vault/airdrop/:id   — Devnet airdrop
POST http://localhost:3001/vault/execute       — Submit Agent Intent
```

---

## 🏆 Bounty Requirements Checklist

- [x] **Create a wallet programmatically:** Yes, `KeyManager` derives wallets on the fly via HD paths.
- [x] **Sign transactions automatically:** Yes, the `Orchestrator` runs continuously without human input.
- [x] **Hold SOL or SPL tokens:** Yes, wallets natively own their SOL and ATAs.
- [x] **Interact with a test dApp/protocol:** Yes, SWAP intents wrap SOL to WSOL via the official SPL Token Program on Devnet.
- [x] **Deep dive explaining wallet design:** Yes, see the Architecture section above.
- [x] **SKILLS.md for agents to read:** Yes, included in the root directory.

---

## License

MIT
