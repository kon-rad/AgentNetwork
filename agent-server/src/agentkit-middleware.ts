/**
 * AgentKit middleware for Express.
 *
 * Protects endpoints from unverified agents while allowing owner requests
 * (from the Next.js app via shared secret) to bypass verification entirely.
 *
 * Request classification:
 *   1. Owner request (has valid x-shared-secret) → bypass, proceed
 *   2. AgentKit-verified (has x-agentkit-proof)  → verify, apply free-trial
 *   3. Unverified (neither header)               → reject 401
 *
 * Uses Worldcoin's AgentBook on World Chain to resolve agent wallet addresses
 * to anonymous human identifiers, then applies free-trial usage limits
 * tracked in Supabase.
 */

import type { Request, Response, NextFunction } from 'express';
import {
  createAgentBookVerifier,
  createAgentkitHooks,
  parseAgentkitHeader,
  validateAgentkitMessage,
  verifyAgentkitSignature,
} from '@worldcoin/agentkit';
import type { AgentKitStorage, AgentkitMode } from '@worldcoin/agentkit';

import { logger } from './logger.js';

export interface AgentkitMiddlewareOptions {
  /** Shared secret for owner bypass (same as WEBAPP_SHARED_SECRET) */
  sharedSecret: string;
  /** AgentKit storage backend (Supabase implementation) */
  storage: AgentKitStorage;
  /** Free-trial mode configuration */
  mode: AgentkitMode;
}

/**
 * Create AgentKit Express middleware.
 *
 * Returns middleware that:
 * - Passes through owner requests (valid x-shared-secret)
 * - Verifies AgentKit proofs for external agent requests
 * - Applies free-trial usage limits
 * - Rejects unverified requests
 */
export function createAgentkitMiddleware(options: AgentkitMiddlewareOptions) {
  const { sharedSecret, storage, mode } = options;

  const agentBook = createAgentBookVerifier({ network: 'world' } as any);

  const hooks = createAgentkitHooks({
    agentBook,
    storage,
    mode,
    onEvent: (event) => {
      logger.info({ event }, '[agentkit] hook event');
    },
  });

  return async (req: Request, res: Response, next: NextFunction) => {
    // Path 1: Owner bypass — requests from Next.js app with shared secret
    const secret = req.headers['x-shared-secret'];
    if (sharedSecret && secret === sharedSecret) {
      return next();
    }

    // Path 2: AgentKit-verified agent
    const proofHeader = req.headers['x-agentkit-proof'];
    if (typeof proofHeader === 'string' && proofHeader.length > 0) {
      try {
        // Parse the proof header into a structured payload
        const payload = parseAgentkitHeader(proofHeader);

        // Validate the message (checks nonce, timestamps, resource URI)
        const resourceUri = `${req.protocol}://${req.get('host')}${req.path}`;
        const validation = await validateAgentkitMessage(payload, resourceUri, {
          checkNonce: storage.hasUsedNonce
            ? (nonce: string) => storage.hasUsedNonce!(nonce)
            : undefined,
        });

        if (!validation.valid) {
          logger.warn({ error: validation.error, path: req.path }, '[agentkit] validation failed');
          res.status(401).json({
            error: 'invalid_proof',
            message: validation.error || 'AgentKit proof validation failed',
          });
          return;
        }

        // Verify the cryptographic signature
        const verification = await verifyAgentkitSignature(payload);
        if (!verification.valid) {
          logger.warn({ error: verification.error, path: req.path }, '[agentkit] signature verification failed');
          res.status(401).json({
            error: 'invalid_signature',
            message: verification.error || 'AgentKit signature verification failed',
          });
          return;
        }

        // Record the nonce to prevent replay
        if (storage.recordNonce) {
          await storage.recordNonce(payload.nonce);
        }

        // Look up the human ID via AgentBook
        const humanId = await agentBook.lookupHuman(payload.address, payload.chainId);
        if (!humanId) {
          logger.info({ address: payload.address, path: req.path }, '[agentkit] agent not registered in AgentBook');
          res.status(401).json({
            error: 'not_registered',
            message: 'Agent wallet is not registered in AgentBook. Register at https://docs.world.org/agents',
          });
          return;
        }

        // Apply free-trial usage limits
        if (mode.type === 'free-trial') {
          const limit = mode.uses ?? 3;
          const allowed = await storage.tryIncrementUsage(req.path, humanId, limit);
          if (!allowed) {
            logger.info({ humanId, path: req.path }, '[agentkit] free-trial exhausted');
            res.status(402).json({
              error: 'payment_required',
              message: `Free trial exhausted (${limit} uses). Payment required.`,
            });
            return;
          }
        }

        // Attach verified identity to request for downstream handlers
        (req as any).agentkitHumanId = humanId;
        (req as any).agentkitAddress = payload.address;

        logger.info({ humanId, address: payload.address, path: req.path }, '[agentkit] agent verified');
        return next();
      } catch (err) {
        logger.error({ err, path: req.path }, '[agentkit] proof processing error');
        res.status(401).json({
          error: 'proof_error',
          message: 'Failed to process AgentKit proof',
        });
        return;
      }
    }

    // Path 3: No credentials at all
    res.status(401).json({
      error: 'unauthorized',
      message: 'Request must include x-shared-secret (owner) or x-agentkit-proof (agent) header',
      docs: 'https://docs.world.org/agents',
    });
  };
}
