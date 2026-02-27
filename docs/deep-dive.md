# Deep Dive: SolAgent Vault Architecture

> Written for judges who want to understand the hard problems

---

## 1. The Trust Problem

Autonomous wallets for AI agents are fundamentally different from user wallets:

### User Wallets
- User initiates every transaction
- User reviews and approves (or rejects)
- Social accountability prevents reckless behavior
- Single point of failure: the user

### Agent Wallets
- Agent makes autonomous decisions
- No human review before execution
- LLM can hallucinate or misinterpret
- Single point of failure: the agent's reasoning

**The danger:** An agent with full wallet access can drain the entire balance in seconds if it malfunctions or is compromised.

**Our solution:** Separate the decision engine from the signing engine. Rules live in a layer the agent cannot control.

---

## 2. Architecture Decisions

### Why Rules Live in the Vault, Not the Agent

```
┌─────────────────────────────────────────────────────────────┐
│                      AGENT BRAIN                             │
│   Makes decisions based on market analysis                  │
│   Can recommend ANY action                                  │
│   (untrusted)                                               │
└──────────────────────────┬──────────────────────────────────┘
                           │ intent
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                       VAULT CORE                             │
│   Validates intent against policy                           │
│   Enforces spending limits, rate limits                     │
│   Signs ONLY if rules pass                                  │
│   (trusted - master seed lives here)                        │
└─────────────────────────────────────────────────────────────┘
```

If the LLM recommends a transaction that violates the policy, the vault rejects it **before** signing. The agent cannot override this because:

1. The agent never has access to the master seed
2. The rule engine is a separate process from the agent
3. Rules are checked synchronously before any signing occurs

### Why HD Derivation?

Traditional approach: Generate and store N keypairs
```
agent-01:  [private key stored]
agent-02:  [private key stored]
agent-03:  [private key stored]
```

Our approach: Derive on-the-fly
```
VAULT_MASTER_SEED → derivePath("m/44'/501'/agent-01-index'/0'") → agent-01 keypair
                 → derivePath("m/44'/501'/agent-02-index'/0'") → agent-02 keypair
```

**Benefits:**
- One secret to protect (the master seed)
- Compromise one agent wallet = compromise that agent only
- Back up one seed = back up all agent wallets
- Easy to rotate (change seed = rotate all)

---

## 3. HD Derivation Design

We use BIP44 with Solana's coin type (501):

```typescript
function deriveAgentKeypair(agentId: string): Keypair {
  const index = hashAgentId(agentId);  // Stable hash → uint32
  const path = `m/44'/501'/${index}'/0'`;  // BIP44 Solana path

  const seed = bip39.mnemonicToSeedSync(MASTER_SEED);
  const { key } = derivePath(path, seed.toString('hex'));

  return Keypair.fromSeed(key);
}
```

**Path structure:**
- `m` = master
- `44'` = BIP44 purpose
- `501'` = Solana coin type
- `${index}'` = agent-specific index (derived from hash)
- `0'` = change (external addresses)

**Index derivation:** We use a stable hash (djb2-like) to convert any string agentId into a uint32 index. This allows flexible agent naming while maintaining deterministic derivation.

---

## 4. Threat Modeling

### What happens if the LLM hallucinates a transaction?

Scenario: LLM recommends transferring 1000 SOL to a random address.

**Our defense:**
1. LLM outputs intent with `amountLamports: 1_000_000_000_000`
2. Vault checks rule: `maxLamportsPerTx = 500_000_000`
3. **Rule engine blocks** → transaction never signed
4. Event emitted: `{ type: 'tx_blocked', reason: 'Exceeds spending limit' }`

### What happens if the agent tries to call an unauthorized program?

Scenario: Agent tries to call an unknown DeFi protocol.

**Our defense:**
1. Agent intent: `{ destinationProgram: 'MaliciousProgram123...' }`
2. Vault checks rule: `allowedPrograms = ['JUP6L...']`
3. **Rule engine blocks** → transaction never signed

### What happens if rate limiting is bypassed?

Scenario: Agent tries to execute 10 transactions per minute (limit is 2).

**Our defense:**
1. Each transaction is timestamped in the rate limiter
2. Count resets after 60 seconds
3. Attempt 3 in 60 seconds: **blocked**

### What happens if the vault itself is compromised?

This is the hardest problem. Current mitigations:
- Master seed in environment variable (not in code)
- No key export API (agents only get public keys)
- Emergency pause per-agent (contain blast radius)

**Future:** Integrate HSM or MPC (see Productionization Roadmap)

---

## 5. The SKILLS.md Protocol

We designed `SKILLS.md` as a machine-readable contract. Any AI agent can:

1. Read the capabilities
2. Understand input/output schemas
3. Call the REST API directly

This means **any judge with an AI agent can integrate your vault** by simply pasting the SKILLS.md into their system.

Example integration:

```typescript
// Any external agent can call our vault
const result = await fetch('http://localhost:3001/vault/execute', {
  method: 'POST',
  body: JSON.stringify({
    agent_id: 'external-agent',
    action: 'SWAP',
    amount_lamports: 50_000_000,
    reasoning: '...',
  }),
});
```

---

## 6. What Judges Should Watch For

### The Demo Moments

1. **Reasoning visible** - Watch the agent's reasoning chain appear on screen
2. **Decision logged** - See the action (SWAP/HOLD) and confidence
3. **Transaction confirmed** - See the signature on Solana Explorer
4. **Rule blocked** - Watch a transaction get rejected (this proves security works!)

### The Architecture Validation

- Is the rule engine truly separate from the agent?
- Can the agent bypass spending limits?
- Is the master seed truly isolated?

---

## 7. What's NOT Production-Ready

### Current Limitations

| Limitation | Impact | Mitigation |
|------------|--------|------------|
| No HSM | Master seed in env var | Use AWS KMS / Azure Key Vault |
| No TEE | Rule engine could be tampered | Intel SGX / ARM TrustZone |
| Off-chain rules | Rules not enforceable on-chain | Deploy as Solana program |
| No multi-sig | Vault has single point of failure | Add multi-sig (Gnosis Safe) |
| In-memory state | Restart loses rate limit state | Redis / database |

### Productionization Roadmap

```
Phase 1 (Post-Hackathon)
├── Move master seed to environment variable
├── Add persistent storage (Redis)
└── Dockerize for easy deployment

Phase 2 (3 months)
├── Integrate HSM (AWS KMS / HashiCorp Vault)
├── Add multi-sig for vault operations
└── Implement request signing (HMAC)

Phase 3 (6 months)
├── Deploy rule engine as Solana program (on-chain enforcement)
├── Add TEE for rule execution (Intel SGX)
└── Implement per-agent ephemeral session keys
```

---

## 8. Competitive Analysis

| Feature | Our Solution | Typical Hackathon Entry |
|---------|--------------|------------------------|
| Multi-agent | Yes (orchestrator) | No (single agent) |
| Rule enforcement | Vault layer (unbypassable) | In-agent (bypassable) |
| HD derivation | Yes (unlimited wallets) | Single keypair |
| Reasoning visibility | Full chain logged | None / hidden |
| SKILLS.md | Yes (machine-readable) | No |
| Emergency pause | Per-agent | No |
| Rate limiting | Yes | No |

---

## 9. Why This Wins

Most submissions will be:
- A single agent with a hardcoded keypair
- Executing scripted swaps
- No security beyond "don't hack us"

**We show:**
- A system (not a demo)
- 3+ agents with different strategies
- Live reasoning visible to judges
- Security rules that actually block transactions
- A machine-readable API (SKILLS.md)

The architecture shows we understand the hard problems. The demo proves it works.

---

## 10. Technical Notes

### Dependencies

- `@solana/web3.js` - RPC communication, transaction building
- `bip39` - Mnemonic handling
- `ed25519-hd-key` - HD key derivation
- `openai` / `anthropic` - LLM providers (user choice)

### Network

- Devnet only (compile-time guard: `NETWORK = 'devnet'`)
- Jupiter V6 API for swap quotes
- CoinGecko for price data

### Security Considerations

- Master seed never logged or exported
- Private keys never leave vault process
- All transactions validated before signing
- Reasoning chain required for audit trail

---

*Written for the Solana AI Agent Hackathon 2025*
