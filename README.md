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

## 🧠 Deep Dive: Agentic Wallet Architecture

### 1. The KeyManager Abstraction (Safe Key Management)
A fundamental requirement for agentic wallets is that the AI **never** holds the private key. In SolAgent Vault, all key operations are abstracted behind a `KeyManager` interface. 
- The `agent-brain` (which runs the LLM and processes market context) only knows its `agentId`.
- The `vault-core` binds this `agentId` to a specific Keypair.
- **Enterprise MPC**: Setting `USE_TURNKEY=true` dynamically swaps the standard local keys for the `TurnkeyKeyManager`. The Vault constructs *unsigned* Solana transactions and broadcasts them to Turnkey's secure Multi-Party Computation enclaves. The private keys physically never touch the node server environment.

### 2. Strict LLM Schema Enforcement
Fragile JSON parsing is the enemy of autonomous agents. The `agent-brain` utilizes the **Vercel AI SDK** and **Zod Object Schemas** to enforce that the LLM (llama-3.3-70b-versatile via Groq) strictly outputs valid commands. 
If the LLM hallucinates an action or malforms the payload, the SDK automatically rejects and retries the generation. This guarantees the `Vault` only receives deterministic `SWAP`, `TRANSFER`, or `HOLD` commands.

### 3. Clear Separation of Responsibilities
The architecture enforces a strict one-way flow of intent:
1. **Agent Brain (Untrusted):** Evaluates pricing, reads market moving averages, and emits a JSON trading intent.
2. **Vault API (Transport):** Authenticates the request via Bearer Tokens and passes it to the Core.
3. **Vault Core (Trusted):** Validates the intent against hardcoded policies (e.g. `maxLamportsPerTx`), constructs the specific Solana transaction, simulates it, and signs it via the `KeyManager`.

### 4. Simulate-Before-Sign Security
Before the `KeyManager` ever touches a transaction, the `Signer` executes a `simulateTransaction` call against the Devnet RPC. If the simulated transaction throws an error (e.g. insufficient funds, slippage exceeded, invalid instruction), the payload is dropped explicitly. This prevents the agent from broadcasting reverting transactions and wasting gas.

### 5. Multi-Key Sandbox Isolation (Supabase)
Instead of relying on a single master API key and volatile in-memory maps for policies, the Vault implements a resilient Postgres Database layer via Supabase. Every agent is isolated behind its own unique `api_key`. The `vault-api` actively queries the database via `authMiddleware` on every trade intent, guaranteeing a leaked API key cannot compromise the entire system.

### 6. Endpoint & Orchestrator Safety
- **Network Shielding:** The API endpoints are defended by `express-rate-limit`. The sensitive transaction mutation endpoint `POST /vault/execute` enforces a hard limit of 5 requests per second to prevent RPC flooding.
- **Race Condition Prevention:** The Agent Brain operates on a rigid asynchronous `isProcessing` lock. During times of severe Solana network congestion, the orchestrator stubbornly waits for the previous transaction to finish broadcasting and confirming on the blockchain before the LLM is permitted to generate a new intent.

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
