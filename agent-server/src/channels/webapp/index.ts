// src/channels/webapp/index.ts
// Webapp HTTP channel for NanoClaw fork.
// Provides an Express HTTP server that the Next.js app (on Railway) communicates with
// via HTTPS + shared secret header. This is the core NC-02 deliverable.
//
// Endpoints:
//   POST /message          — receive a message from Next.js and route through NanoClaw
//   GET  /stream/:agentId  — SSE stream; delivers agent turn results back to Next.js
//   POST /register-group   — register an agent group in NanoClaw SQLite (NC-07)

import express from 'express';
import * as fs from 'fs';
import * as path from 'path';

import { WEBAPP_PORT, WEBAPP_SHARED_SECRET } from '../../config.js';
import { setRegisteredGroup } from '../../db.js';
import { logger } from '../../logger.js';
import { Channel, NewMessage } from '../../types.js';
import { ChannelFactory, registerChannel } from '../registry.js';

// Map of agentJid -> active SSE response object (one per open stream)
const sseClients = new Map<string, express.Response>();

// Counter for unique message IDs
let messageCounter = 0;
function nextMessageId(): string {
  return `webapp-${Date.now()}-${++messageCounter}`;
}

const factory: ChannelFactory = (opts): Channel | null => {
  if (!process.env.WEBAPP_PORT) {
    logger.warn('[webapp] WEBAPP_PORT not set — webapp channel disabled');
    return null;
  }

  const app = express();
  app.use(express.json());

  // Shared secret auth middleware (NC-06)
  // Every request must include x-shared-secret matching WEBAPP_SHARED_SECRET.
  app.use((req, res, next) => {
    const secret = req.headers['x-shared-secret'];
    if (!WEBAPP_SHARED_SECRET || secret !== WEBAPP_SHARED_SECRET) {
      res.status(401).json({ error: 'unauthorized' });
      return;
    }
    next();
  });

  // POST /message — receive a message from Next.js and route through NanoClaw (NC-02)
  app.post('/message', (req, res) => {
    const { agentId, message, sessionToken } = req.body as {
      agentId?: string;
      message?: string;
      sessionToken?: string;
    };
    if (!agentId || !message) {
      res.status(400).json({ error: 'agentId and message required' });
      return;
    }
    const jid = `${agentId}@webapp`;
    const incoming: NewMessage = {
      id: nextMessageId(),
      chat_jid: jid,
      sender: sessionToken || 'anonymous',
      sender_name: 'user',
      content: message,
      timestamp: new Date().toISOString(),
      is_from_me: false,
      is_bot_message: false,
    };
    try {
      opts.onMessage(jid, incoming);
      res.json({ queued: true, jid });
    } catch (err) {
      logger.error({ err }, '[webapp] onMessage error');
      res.status(500).json({ error: 'failed to queue message' });
    }
  });

  // GET /stream/:agentId — SSE stream; delivers agent turn results to waiting Next.js client (NC-02)
  app.get('/stream/:agentId', (req, res) => {
    const { agentId } = req.params;
    const jid = `${agentId}@webapp`;

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // disable Nginx/Caddy response buffering

    // Express 5 response needs headers flushed immediately
    res.flushHeaders();

    sseClients.set(jid, res);
    logger.debug({ jid }, '[webapp] SSE client connected');

    // Heartbeat every 15s to keep connection alive through proxies
    const heartbeat = setInterval(() => {
      res.write(': heartbeat\n\n');
    }, 15000);

    req.on('close', () => {
      clearInterval(heartbeat);
      sseClients.delete(jid);
      logger.debug({ jid }, '[webapp] SSE client disconnected');
    });
  });

  // POST /register-group — register a new agent group in NanoClaw SQLite (NC-07)
  app.post('/register-group', (req, res) => {
    const { agentId, folder, claudeMdContent } = req.body as {
      agentId?: string;
      folder?: string;
      claudeMdContent?: string;
    };
    if (!agentId || !folder) {
      res.status(400).json({ error: 'agentId and folder required' });
      return;
    }
    const jid = `${agentId}@webapp`;
    try {
      setRegisteredGroup(jid, {
        name: agentId,
        folder,
        trigger: `@${agentId}`,
        added_at: new Date().toISOString(),
        requiresTrigger: false, // webapp agents respond to all messages (no group trigger needed)
      });

      // Create workspace directory with optional CLAUDE.md
      const groupDir = path.join(process.cwd(), 'groups', folder);
      fs.mkdirSync(groupDir, { recursive: true });

      if (claudeMdContent) {
        fs.writeFileSync(path.join(groupDir, 'CLAUDE.md'), claudeMdContent, 'utf8');
      }

      logger.info({ jid, folder }, '[webapp] group registered');
      res.json({ success: true, groupId: agentId, folder });
    } catch (err) {
      logger.error({ err }, '[webapp] register-group error');
      res.status(500).json({ error: 'failed to register group' });
    }
  });

  app.listen(WEBAPP_PORT, () => {
    logger.info(`[webapp] channel listening on port ${WEBAPP_PORT}`);
  });

  const channel: Channel = {
    name: 'webapp',

    connect: async () => {
      logger.info('[webapp] channel connected');
    },

    // Called by NanoClaw router after each agent turn to deliver the response text.
    // Routes the text to the waiting SSE client for this jid, then signals completion.
    sendMessage: async (jid: string, text: string) => {
      const client = sseClients.get(jid);
      if (client) {
        client.write(`data: ${JSON.stringify({ text, done: false })}\n\n`);
        // Signal that this turn is complete
        client.write(`data: ${JSON.stringify({ done: true })}\n\n`);
        client.end();
        sseClients.delete(jid);
        logger.debug({ jid }, '[webapp] SSE response sent and stream closed');
      } else {
        logger.warn({ jid }, '[webapp] no SSE client for jid — response dropped');
      }
    },

    isConnected: () => true,

    ownsJid: (jid: string) => jid.endsWith('@webapp'),

    disconnect: async () => {
      // Close all open SSE connections gracefully on server shutdown
      for (const [jid, res] of sseClients.entries()) {
        res.write(`data: ${JSON.stringify({ error: 'server shutting down' })}\n\n`);
        res.end();
        logger.debug({ jid }, '[webapp] SSE client closed on shutdown');
      }
      sseClients.clear();
    },
  };

  return channel;
};

registerChannel('webapp', factory);
