---
name: solagent-vault-integration
description: Comprehensive guidance for integrating an AI Agent with the SolAgent Vault API. Use this to construct JSON payloads representing trading intents.
license: MIT
metadata:
  author: SolAgent Team
  version: "1.0.0"
tags:
  - solana
  - agentic-wallet
  - defi
  - solagent
  - trading-bot
---

# SolAgent Vault Integration Skill

This skill teaches AI agents how to interact with the SolAgent Vault API. The Vault API is a secure execution layer that takes intents from an AI agent, validates them against security policies, and securely signs the underlying transactions.

**Base URL:** (Local Dev) `http://localhost:3000`

## Your Role as an Agent
You do NOT need to hold a private key. You do NOT need to construct complex serialized Solana transactions. 
Your only job is to emit a strictly formatted JSON "Intent" payload. The Vault API handles the rest.

## Core Endpoint: Execute Intent

**Endpoint:** `POST /vault/execute`
**Description:** Submits a trading intent for evaluation and execution.
**Headers:**
```http
Content-Type: application/json
Authorization: Bearer <VAULT_API_KEY>
```

### Request Payload Schema
Your JSON payload MUST match this Zod schema exactly:

```json
{
  "agentId": "string (Your unique identifier)",
  "reasoning": "string (Human-readable reasoning log)",
  "reasoningSteps": [
    {
      "timestamp": "string (ISO 8601)",
      "step": "string (e.g. 'Observing', 'Analyzing')",
      "detail": "string (Explanation of step)"
    }
  ],
  "action": "SWAP" | "HOLD" | "TRANSFER",
  "inputMint": "string (Solana Mint Address of token to sell)",
  "outputMint": "string (Solana Mint Address of token to buy)",
  "amountLamports": 10000000,
  "confidence": 0.85
}
```

### Example Request
If you determine that momentum is shifting and you should swap 0.01 SOL on Devnet:

```curl
curl -X POST http://localhost:3000/vault/execute \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer <VAULT_API_KEY>" \
     -d '{
       "agentId": "agent-momentum-01",
       "reasoning": "Momentum is strong, requesting swap.",
       "reasoningSteps": [
         {"timestamp": "2024-01-01T12:00:00Z", "step": "Observing", "detail": "Price went up"}
       ],
       "action": "SWAP",
       "inputMint": "So11111111111111111111111111111111111111112",
       "outputMint": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1",
       "amountLamports": 10000000,
       "confidence": 0.85
     }'
```

## Security & Rate Limiting
If your `amountLamports` exceeds your assigned policy's `maxLamportsPerTx`, the Vault Engine will REJECT the request.
If you submit duplicate intents within a 30-second window, you may hit the internal rate limit shields.

## Devnet Fallback
On Devnet, due to liquidity limitations, submitting a `SWAP` action with `So11111111111111111111111111111111111111112` natively defaults to securely wrapping the SOL into WSOL via the official SPL Token Program. This ensures your integration functions fully regardless of external Devnet API stability.
