import { Request, Response, NextFunction } from 'express';
// We use a type-only import here to avoid circular dependency execution issues
import type { Vault } from '@solagent/vault-core';

/**
 * Express middleware to enforce strict Bearer Token authentication.
 * 
 * In a production architecture, the Orchestrator will be the only entity
 * containing the VAULT_API_KEY, meaning only the Orchestrator can trigger
 * actual financial transactions or mutate agent settings.
 */
export const createAuthMiddleware = (vault: Vault) => {
    return async (req: Request, res: Response, next: NextFunction) => {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                error: 'UNAUTHORIZED',
                message: 'Missing or malformed Authorization header. Expected: Bearer <token>'
            });
        }

        const token = authHeader.split(' ')[1];
        const masterKey = process.env.VAULT_API_KEY;

        if (!masterKey) {
            return res.status(500).json({
                error: 'CRITICAL_CONFIG_ERROR',
                message: 'Server missing VAULT_API_KEY. Refusing to process requests until secured.'
            });
        }

        // 1. Master Admin Check (For Dashboard)
        if (token === masterKey) {
            return next();
        }

        // 2. Agent Specific Check
        const agentId = req.body.agentId || req.body.agent_id || req.params.agentId;

        if (agentId) {
            try {
                // @ts-ignore - verifyAgentApiKey is being added to Vault
                const isValid = await vault.verifyAgentApiKey(agentId, token);
                if (isValid) {
                    return next();
                }
            } catch (e) {
                console.error('[Auth] Verification failed:', e);
            }
        }

        return res.status(403).json({
            error: 'FORBIDDEN',
            message: 'Invalid API Key provided.'
        });
    };
};
