import { Request, Response, NextFunction } from 'express';

/**
 * Express middleware to enforce strict Bearer Token authentication.
 * 
 * In a production architecture, the Orchestrator will be the only entity
 * containing the VAULT_API_KEY, meaning only the Orchestrator can trigger
 * actual financial transactions or mutate agent settings.
 */
export const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;

    // Public dashboard endpoints (like GET /vault/agents) skip this middleware.
    // This middleware is applied selectively in modern server architecture.

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
            error: 'UNAUTHORIZED',
            message: 'Missing or malformed Authorization header. Expected: Bearer <token>'
        });
    }

    const token = authHeader.split(' ')[1];
    const expectedKey = process.env.VAULT_API_KEY;

    if (!expectedKey) {
        return res.status(500).json({
            error: 'CRITICAL_CONFIG_ERROR',
            message: 'Server missing VAULT_API_KEY. Refusing to process requests until secured.'
        });
    }

    if (token !== expectedKey) {
        return res.status(403).json({
            error: 'FORBIDDEN',
            message: 'Invalid API Key provided.'
        });
    }

    // Token is valid. Proceed to the handler.
    next();
};
