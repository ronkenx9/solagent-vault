# SKILLS.md — SolAgent Vault

> Machine-readable capability manifest for AI agent integration

## Identity

```yaml
name: solagent-vault
version: 1.0.0
network: solana-devnet
maintainer: solagent-team
description: Autonomous wallet infrastructure for AI agents on Solana
```

## What This Agent Tool Does

SolAgent Vault is an autonomous wallet service for AI agents. It manages HD-derived keypairs, enforces spending rules, and executes transactions on Solana devnet. Agents interact via REST API or TypeScript SDK.

## Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Agent     │────▶│  Vault API  │────▶│  Solana    │
│   (LLM)     │     │  (Rules)    │     │  Devnet    │
└─────────────┘     └─────────────┘     └─────────────┘
```

## Capabilities

### create_wallet

- **Input:** `{ agent_id: string }`
- **Output:** `{ public_key: string, derivation_path: string }`
- **Notes:** Keypair is derived deterministically. No private key ever returned.

### get_balance

- **Input:** `{ agent_id: string }`
- **Output:** `{ sol: number, tokens: { [mint: string]: number } }`
- **Notes:** Returns current wallet balance in SOL and tokens.

### execute_swap

- **Input:**
  ```json
  {
    "agent_id": "string",
    "input_mint": "string",
    "output_mint": "string",
    "amount_lamports": number,
    "reasoning": "string"
  }
  ```
- **Output:**
  ```json
  {
    "success": boolean,
    "signature": "string | null",
    "rule_block_reason": "string | null"
  }
  ```
- **Notes:** Reasoning field is logged for observability. Required.

### execute_transfer

- **Input:**
  ```json
  {
    "agent_id": "string",
    "destination": "string (base58)",
    "amount_lamports": number,
    "reasoning": "string"
  }
  ```
- **Output:** Same as execute_swap
- **Notes:** Direct SOL transfer to any address

### set_policy

- **Input:**
  ```json
  {
    "agent_id": "string",
    "max_lamports_per_tx": number,
    "allowed_programs": "string[]",
    "max_tx_per_minute": number
  }
  ```
- **Output:** `{ registered: boolean }`
- **Notes:** Policy is enforced at vault layer, not overridable by agent

### pause_agent

- **Input:** `{ agent_id: string }`
- **Output:** `{ paused: boolean }`
- **Notes:** Emergency kill switch - immediately blocks all transactions

### resume_agent

- **Input:** `{ agent_id: string }`
- **Output:** `{ resumed: boolean }`
- **Notes:** Resume a paused agent

### get_policy

- **Input:** `{ agent_id: string }`
- **Output:**
  ```json
  {
    "agent_id": "string",
    "max_lamports_per_tx": number,
    "allowed_programs": "string[]",
    "max_tx_per_minute": number,
    "paused": boolean
  }
  ```

## REST API

### Base URL

```
http://localhost:3001/vault
```

### Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/execute` | Execute a transaction intent |
| GET | `/balance/:agentId` | Get agent wallet balance |
| POST | `/policy` | Register or update agent policy |
| POST | `/pause/:agentId` | Emergency pause an agent |
| POST | `/resume/:agentId` | Resume a paused agent |
| GET | `/policy/:agentId` | Get current policy for agent |
| GET | `/wallet/:agentId` | Get wallet address for agent |
| GET | `/events` | SSE stream of all vault events |

### Example Request

```bash
curl -X POST http://localhost:3001/vault/execute \
  -H "Content-Type: application/json" \
  -d '{
    "agent_id": "agent-trader-01",
    "action": "SWAP",
    "input_mint": "So11111111111111111111111111111111111111112",
    "output_mint": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1",
    "amount_lamports": 100000000,
    "reasoning": "SOL price dropped 2.1% in the last hour. Portfolio risk is medium. Converting 0.1 SOL to USDC for stability."
  }'
```

### Example Response

```json
{
  "success": true,
  "signature": "4xG9F1VQvR7u8...",
  "reason": "Transaction executed successfully",
  "ruleCheck": {
    "approved": true,
    "reason": "All rules passed"
  }
}
```

## Security Model

- **Private keys never leave the vault process**
- Master seed loaded from `VAULT_MASTER_SEED` env variable only
- All transactions validated against AgentPolicy before signing
- Rate limiting enforced at vault layer, not agent layer
- Emergency pause freezes signing for named agent immediately
- **Devnet only** - mainnet disabled at compile time

## Constraints

| Constraint | Value |
|------------|-------|
| Network | Devnet only |
| Max agents per vault | 10 (demo limit) |
| Reasoning required | Yes - logged for audit |
| Max tx per minute | Configurable per agent |

## Integration Example

### TypeScript SDK

```typescript
import { Vault } from '@solagent/vault-core';

const vault = new Vault({
  rpcUrl: 'https://api.devnet.solana.com',
});

// Register agent policy
vault.registerPolicy({
  agentId: 'agent-trader-01',
  maxLamportsPerTx: 500_000_000,  // 0.5 SOL
  allowedPrograms: ['JUP6LkbZbjS1jKKwapdHNy74zaZWiGdp52teN2pLr'],
  maxTxPerMinute: 2,
  paused: false,
});

// Execute swap
const result = await vault.execute({
  agentId: 'agent-trader-01',
  action: 'SWAP',
  destinationProgram: 'JUP6LkbZbjS1jKKwapdHNy74zaZWiGdp52teN2pLr',
  inputMint: 'So11111111111111111111111111111111111111112',
  outputMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1',
  amountLamports: 100_000_000,
  reasoning: 'SOL price analysis indicates downward trend...',
});

console.log(result);
```

### Event Subscription

```typescript
vault.on('event', (event) => {
  console.log(`[${event.type}] ${event.agentId}:`, event.data);
});
```

## Error Codes

| Code | Description |
|------|-------------|
| `NO_POLICY` | Agent has no registered policy |
| `PAUSED` | Agent wallet is paused |
| `SPENDING_LIMIT` | Amount exceeds max per transaction |
| `PROGRAM_NOT_WHITELISTED` | Target program not allowed |
| `RATE_LIMIT` | Too many transactions per minute |
| `INSUFFICIENT_BALANCE` | Not enough SOL for transaction |

## Production Readiness

This is a **hackathon demonstration** - not production-ready:

- No HSM or TEE for master seed storage
- No multi-sig on the vault itself
- No persistent storage (restarts lose rate limit state)
- LLM trust is partial - reasoning is logged but not verified
- No on-chain program for rule enforcement (rules are off-chain)

See `docs/deep-dive.md` for productionization roadmap.
