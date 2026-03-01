# SKILLS.md — SolAgent Vault

> This file describes the capabilities and interfaces available to AI agents interacting with this system.

## Capabilities

### 🔐 vault-service
Handles secure key management and transaction execution for autonomous agents.

**Functions available:**
- `getWalletAddress(agentId)` — Returns the agent's derived public key (read-only, safe to expose)
- `getBalance(agentId)` → `{ sol: number, tokens: Record<string, number> }` — Fetches live on-chain balance
- `execute(intent)` — Submits a transaction intent; the vault enforces policy before signing
- `requestAirdrop(agentId, amount)` — Requests devnet SOL from the faucet
- `pauseAgent(agentId)` / `resumeAgent(agentId)` — Emergency controls

**Transaction Intent Schema:**
```typescript
{
  agentId: string;         // e.g. "agent-momentum-01"
  action: 'SWAP' | 'TRANSFER' | 'STAKE';
  destinationProgram: string;   // must be in allowedPrograms policy
  lamports: number;             // must not exceed maxLamportsPerTx policy
  reasoning: string;            // human-readable reason (logged)
  inputMint?: string;           // for SWAP
  outputMint?: string;          // for SWAP
}
```

**Policy Enforcement (automatic, cannot be bypassed):**
- `maxLamportsPerTx` — Hard cap on spend per transaction
- `allowedPrograms` — Whitelist of program IDs that can be called
- `maxTxPerMinute` — Rate limiter to prevent runaway spending

---

### 🛡️ Human-in-the-Loop Governance
The Vault exposes endpoints for human overseers to manage agent risk dynamically.

**Governance Endpoints:**
- `POST /vault/policy` — Updates an agent's policy (e.g. increase/decrease spending cap)
- `POST /vault/pause/:agentId` — Instantly halts all transaction signing for an agent
- `POST /vault/resume/:agentId` — Restores transaction capabilities

**Dashboard Interaction:**
- **Level Up**: Increases `maxLamportsPerTx` via the policy API.
- **Level Down**: Decreases `maxLamportsPerTx` via the policy API.

---

### 🧠 agent-brain
The LLM-driven decision loop for an autonomous trading agent.

**Inputs it receives each tick:**
```json
{
  "wallet": {
    "address": "<pubkey>",
    "solBalance": 2.5,
    "portfolioValueUsd": "350.00",
    "tokens": {}
  },
  "market": {
    "solPriceUsd": 140,
    "solChange1h": -0.8,
    "solChange24h": -2.1,
    "priceSignal": "BEARISH",
    "bestSwapRoute": { "inAmount": "10000000", "outAmount": "1392450", ... }
  },
  "tradingHints": {
    "canTrade": true,
    "suggestedActionSol": 0.25,
    "momentumFavorable": false
  }
}
```

**Output decision schema:**
```typescript
{
  action: 'SWAP' | 'HOLD' | 'TRANSFER';
  reasoning: string;        // must explain the decision
  confidence: number;       // 0.0 to 1.0
  amountLamports?: number;  // lamports to swap (if action=SWAP)
  inputMint?: string;
  outputMint?: string;
}
```

**Agent Strategies:**
| Strategy | Confidence Threshold | Max Swap | Persona |
|---|---|---|---|
| MOMENTUM_TRADER | 0.6 | 20% of balance | Aggressive, acts on momentum |
| CONSERVATIVE_HOLDER | 0.8 | 5% of balance | Cautious, needs strong signal |
| REBALANCER | 0.7 | 10% of balance | Balanced, portfolio-focused |

---

### 📡 vault-api Events (SSE)
Connect to `GET /vault/events` to receive real-time events:

| Event Type | Payload |
|---|---|
| `tick` | `{ balance, timestamp }` |
| `reasoning` | `{ decision, context, timestamp }` |
| `decision` | `{ action, reason, timestamp }` |
| `tx_executed` | `{ intent, signature, timestamp }` |
| `tx_blocked` | `{ intent, reason, timestamp }` |
| `error` | `{ error, timestamp }` |

---

## Security Model

- **Private keys never leave the vault-core process** — agents receive only signed transactions
- **HD wallet derivation** — each agent gets a unique sub-wallet from a single master seed
- **Policy engine** — operates as a trust boundary; the LLM cannot bypass spending limits
- **Devnet isolation** — all testing runs on Solana devnet; no mainnet funds at risk
