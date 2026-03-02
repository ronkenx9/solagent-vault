import dotenv from 'dotenv';
import { resolve } from 'path';

// Load environment variables locally
if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
    dotenv.config({ path: resolve(process.cwd(), '../../.env') });
}
import express, { type Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { Vault, LocalKeyManager } from '@solagent/vault-core';
import type { Intent, IntentAction } from '@solagent/vault-core';
import { authMiddleware } from './middleware/auth.js';

const app: Application = express();
app.use(cors());
app.use(express.json());

// Note: Static files for the dashboard are handled by vercel.json routes in production.
if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
    app.use(express.static(resolve(process.cwd(), '../dashboard/public')));
}

console.log('[VaultAPI] Module loading check...');

// --- Vault instance ---
let vault: any;
try {
    const keyManager = new LocalKeyManager();
    vault = new Vault({
        rpcUrl: process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com',
        keyManager,
    });
} catch (err) {
    console.error('[VaultAPI] Failed to initialize Vault:', err);
}

// Replaced pre-registration block with Database seeding
if (process.env.VERCEL) {
    console.log('[VaultAPI] Running in Vercel mode. Database holds agent states.');
}

// --- SSE clients ---
const sseClients: Set<Response> = new Set();

/**
 * Broadcast an event to all connected SSE clients
 */
export function broadcastEvent(event: any) {
    const data = JSON.stringify(event);
    for (const client of sseClients) {
        client.write(`data: ${data}\n\n`);
    }
}

// Forward vault core events
vault.on('event', (event: any) => broadcastEvent(event));

/**
 * POST /vault/broadcast — Accept events from the orchestrator process
 * Bridges cross-process events to SSE clients
 */
app.post('/vault/broadcast', (req: Request, res: Response) => {
    const event = req.body;
    if (event && event.type) {
        console.log(`[Broadcast] ${event.type} for ${event.agentId || 'system'}`);
        broadcastEvent(event);
        return res.json({ ok: true });
    }
    return res.status(400).json({ error: 'Invalid event' });
});

// ==========================================
// Routes matching SKILLS.md specification
// ==========================================

/**
 * POST /vault/execute — Execute a transaction intent
 */
app.post('/vault/execute', authMiddleware, async (req: Request, res: Response) => {
    const { agent_id, action, input_mint, output_mint, amount_lamports, destination, reasoning } = req.body;

    // Validate required fields
    if (!agent_id) {
        return res.status(400).json({ error: 'NO_AGENT_ID', message: 'agent_id is required' });
    }
    if (!action) {
        return res.status(400).json({ error: 'NO_ACTION', message: 'action is required' });
    }
    if (!reasoning) {
        return res.status(400).json({ error: 'NO_REASONING', message: 'reasoning is required — all intents must include a reasoning chain' });
    }

    // Build the intent
    const intent: Intent = {
        agentId: agent_id,
        action: action as IntentAction,
        destinationProgram: destination || getDFlowProgramForAction(action),
        lamports: amount_lamports || 0,
        reasoning,
        inputMint: input_mint,
        outputMint: output_mint,
    };

    try {
        const result = await vault.execute(intent);
        return res.json(result);
    } catch (error) {
        const msg = error instanceof Error ? error.message : 'Unknown error';
        return res.status(500).json({ error: 'EXECUTION_ERROR', message: msg });
    }
});

/**
 * GET /vault/balance/:agentId — Get agent wallet balance
 */
app.get('/vault/balance/:agentId', async (req: Request, res: Response) => {
    const { agentId } = req.params;

    try {
        const balance = await vault.getBalance(agentId);
        return res.json({ agentId, ...balance });
    } catch (error) {
        const msg = error instanceof Error ? error.message : 'Unknown error';
        return res.status(500).json({ error: 'BALANCE_ERROR', message: msg });
    }
});

/**
 * GET /vault/wallet/:agentId — Get wallet address for agent
 */
app.get('/vault/wallet/:agentId', async (req: Request, res: Response) => {
    const { agentId } = req.params;

    try {
        const address = await vault.getWalletAddress(agentId);
        return res.json({ agentId, address });
    } catch (error) {
        const msg = error instanceof Error ? error.message : 'Unknown error';
        return res.status(500).json({ error: 'WALLET_ERROR', message: msg });
    }
});

/**
 * POST /vault/policy — Register or update agent policy
 */
app.post('/vault/policy', authMiddleware, async (req: Request, res: Response) => {
    const { agent_id, max_lamports_per_tx, allowed_programs, max_tx_per_minute } = req.body;

    if (!agent_id) {
        return res.status(400).json({ error: 'NO_AGENT_ID', message: 'agent_id is required' });
    }

    try {
        await vault.registerPolicy({
            agentId: agent_id,
            maxLamportsPerTx: max_lamports_per_tx || 500_000_000,
            allowedPrograms: allowed_programs || ['DFLOWxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'],
            maxTxPerMinute: max_tx_per_minute || 2,
            paused: false,
        });
        return res.json({ registered: true, agentId: agent_id });
    } catch (error) {
        const msg = error instanceof Error ? error.message : 'Unknown error';
        return res.status(500).json({ error: 'POLICY_ERROR', message: msg });
    }
});

/**
 * GET /vault/policy/:agentId — Get current policy for agent
 */
app.get('/vault/policy/:agentId', async (req: Request, res: Response) => {
    const { agentId } = req.params;
    const policy = await vault.getPolicy(agentId);

    if (!policy) {
        return res.status(404).json({ error: 'NO_POLICY', message: 'No policy registered for agent' });
    }

    return res.json(policy);
});

/**
 * GET /vault/agents — Get all registered agents
 */
app.get('/vault/agents', async (_req: Request, res: Response) => {
    try {
        const policies = await vault.getAllPolicies();
        return res.json({ agents: policies });
    } catch (error) {
        const msg = error instanceof Error ? error.message : 'Unknown error';
        return res.status(500).json({ error: 'AGENTS_ERROR', message: msg });
    }
});

/**
 * POST /vault/pause/:agentId — Emergency pause an agent
 */
app.post('/vault/pause/:agentId', authMiddleware, async (req: Request, res: Response) => {
    const { agentId } = req.params;
    const result = await vault.pauseAgent(agentId);

    if (!result) {
        return res.status(404).json({ error: 'NO_POLICY', message: 'No policy registered for agent' });
    }

    return res.json({ paused: true, agentId });
});

/**
 * POST /vault/resume/:agentId — Resume a paused agent
 */
app.post('/vault/resume/:agentId', authMiddleware, async (req: Request, res: Response) => {
    const { agentId } = req.params;
    const result = await vault.resumeAgent(agentId);

    if (!result) {
        return res.status(404).json({ error: 'NO_POLICY', message: 'No policy registered for agent' });
    }

    return res.json({ resumed: true, agentId });
});

/**
 * POST /vault/airdrop/:agentId — Request devnet airdrop (testing only)
 */
app.post('/vault/airdrop/:agentId', authMiddleware, async (req: Request, res: Response) => {
    const { agentId } = req.params;
    const amount = req.body.amount || 2;

    try {
        const signature = await vault.requestAirdrop(agentId, amount);
        return res.json({ success: true, signature, amount, agentId });
    } catch (error) {
        const msg = error instanceof Error ? error.message : 'Unknown error';
        return res.status(500).json({ error: 'AIRDROP_ERROR', message: msg });
    }
});

/**
 * GET /vault/events — SSE stream of all vault events
 */
app.get('/vault/events', (req: Request, res: Response) => {
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
    });

    // Send initial connection event
    res.write(`data: ${JSON.stringify({ type: 'connected', timestamp: Date.now() })}\n\n`);

    sseClients.add(res);

    req.on('close', () => {
        sseClients.delete(res);
    });
});

/**
 * GET /vault/health — Health check
 */
app.get('/vault/health', (_req: Request, res: Response) => {
    return res.json({
        status: vault ? 'ok' : 'error',
        vault_initialized: !!vault,
        network: 'devnet',
        timestamp: Date.now(),
        sseClients: sseClients.size,
    });
});

// --- Helper ---
function getDFlowProgramForAction(action: string): string {
    // DFlow is the default execution venue
    return 'DFLOWxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';
}

// --- Start server ---
const PORT = parseInt(process.env.VAULT_API_PORT || '3001', 10);

if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
    app.listen(PORT, () => {
        console.log(`\n🔐 SolAgent Vault API running on http://localhost:${PORT}`);
        console.log(`   Network: devnet`);
        console.log(`   Endpoints:`);
        console.log(`     POST /vault/execute       — Execute transaction intent`);
        console.log(`     GET  /vault/balance/:id   — Get agent balance`);
        console.log(`     GET  /vault/wallet/:id    — Get agent wallet address`);
        console.log(`     POST /vault/policy        — Register agent policy`);
        console.log(`     GET  /vault/policy/:id    — Get agent policy`);
        console.log(`     POST /vault/pause/:id     — Emergency pause`);
        console.log(`     POST /vault/resume/:id    — Resume agent`);
        console.log(`     POST /vault/airdrop/:id   — Devnet airdrop`);
        console.log(`     GET  /vault/events        — SSE event stream`);
        console.log(`     GET  /vault/health        — Health check\n`);
    });
}

export default app;
export { vault };
// Forced reload to ingest new env vars
