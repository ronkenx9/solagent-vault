---
name: solagent-vault-integration
description: Agent-to-Agent API Contract for executing secure swaps, transfers, and portfolio management via the SolAgent Vault isolated execution environment.
version: 1.0.0
schema_version: 2.0
author: SolAgent Team
capabilities:
  - execute_transaction
  - query_portfolio
  - evaluate_risk
authentication: bearer_token
---

# SolAgent Vault: Machine-Readable Agent Contract

This document serves as the formal Tool Call specification and JSON Schema contract for autonomous agents interfacing with the SolAgent Vault.

Foreign agents (LLMs) parsing this file MUST use the following JSON schemas when assembling tool execution payloads to `http://localhost:3000/vault/execute`.

## 1. System Architecture & Trust Boundary

You are an Autonomous Agent (`System A`). You do NOT possess a private key. You cannot sign transactions directly.

Your counterpart is the SolAgent Vault (`System B`). The Vault holds the Turnkey Multi-Party Computation (MPC) enclaves and enforces strict risk policies (e.g., `spending_limits`, `allowed_tokens`).

**Your objective:** Submit a strictly typed *Intent* to System B. System B will evaluate your reasoning against its internal security policies. If the intent is cryptographically safe and within limits, System B will autonomously sign and broadcast the transaction to the Solana blockchain.

---

## 2. API Capabilities & OpenRPC Schemas

### Capability: `Execute_Intent`

Submit an explicit, reasoned request to mutate on-chain state (e.g., SWAP tokens or TRANSFER funds).

**Endpoint:** `POST /vault/execute`
**Headers Required:**
- `Content-Type: application/json`
- `Authorization: Bearer <API_KEY>`

**JSON Schema Definition (Input):**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "VaultExecutionIntent",
  "type": "object",
  "required": ["agentId", "action", "inputMint", "outputMint", "amountLamports", "confidence", "reasoning"],
  "properties": {
    "agentId": {
      "type": "string",
      "description": "Your unique agent identifier registered in the Vault's Supabase instance."
    },
    "action": {
      "type": "string",
      "enum": ["SWAP", "TRANSFER", "HOLD"],
      "description": "The discrete on-chain action to execute."
    },
    "inputMint": {
      "type": "string",
      "pattern": "^[1-9A-HJ-NP-Za-km-z]{32,44}$",
      "description": "Base58 Solana public key of the token to spend (e.g., 'So111111111...')."
    },
    "outputMint": {
      "type": "string",
      "pattern": "^[1-9A-HJ-NP-Za-km-z]{32,44}$",
      "description": "Base58 Solana public key of the token to receive."
    },
    "amountLamports": {
      "type": "integer",
      "minimum": 1,
      "description": "Raw underlying token amount to spend, expressed in the token's smallest unit (e.g., Lamports for SOL)."
    },
    "confidence": {
      "type": "number",
      "minimum": 0.0,
      "maximum": 1.0,
      "description": "The normalized confidence score of this decision."
    },
    "reasoning": {
      "type": "string",
      "description": "A comprehensive, human-readable justification detailing exactly why this intent was formed based on on-chain state."
    },
    "reasoningSteps": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["timestamp", "step", "detail"],
        "properties": {
          "timestamp": { "type": "string", "format": "date-time" },
          "step": { "type": "string" },
          "detail": { "type": "string" }
        }
      },
      "description": "An optional execution trace demonstrating your internal chain-of-thought to the Vault Rule Engine."
    }
  }
}
```

### Capability: `Query_Status` (Server-Sent Events)

Agents may passively monitor the status of their submitted intents via SSE streams to detect when the Vault Rule Engine approves, rejects, or finalizing the transaction on-chain.

**Endpoint:** `GET /vault/events`
**Expected Feed:** `text/event-stream`

---

## 3. Threat Modeling & Rejection Codes

If your Intent is rejected by the Vault, it is because you violated the isolated security perimeter. You must swallow these errors gracefully.

**Common HTTP 400 rejection conditions:**
- `POLICY_VIOLATION_AMOUNT`: You requested to swap `amountLamports` greater than your specific Agent's maximum allowed ticket size.
- `POLICY_VIOLATION_TOKEN`: You requested an `inputMint` or `outputMint` that is not on your Agent's whitelist.
- `RATE_LIMIT_EXCEEDED`: The Vercel Gateway or native Express global shield drops your request due to spam (Limit: 5 requests per second for execute endpoint).
- `TURNKEY_SIGNATURE_FAILED`: The Secure Enclave rejected the transaction payload structure.
