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
import { resolveGroupFolderPath } from '../../group-folder.js';
import { logger } from '../../logger.js';
import { createAgentWallet } from '../../wallet-manager.js';
import { Channel, NewMessage } from '../../types.js';
import { ChannelFactory, registerChannel } from '../registry.js';

// Map of agentJid -> active SSE response object (one per open stream)
const sseClients = new Map<string, express.Response>();

// Counter for unique message IDs
let messageCounter = 0;
function nextMessageId(): string {
  return `webapp-${Date.now()}-${++messageCounter}`;
}

interface FileEntry {
  name: string;
  path: string;       // relative to group root
  type: 'file' | 'dir';
  size?: number;      // bytes, only for files
  modified?: string;  // ISO string
}

function listDir(base: string, dir: string, depth: number): FileEntry[] {
  if (depth > 2) return [];
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const results: FileEntry[] = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relPath = path.relative(base, fullPath);
    if (entry.isDirectory()) {
      results.push({ name: entry.name, path: relPath, type: 'dir' });
      results.push(...listDir(base, fullPath, depth + 1));
    } else if (entry.isFile()) {
      let size: number | undefined;
      let modified: string | undefined;
      try {
        const stat = fs.statSync(fullPath);
        size = stat.size;
        modified = stat.mtime.toISOString();
      } catch { /* ignore stat errors */ }
      results.push({ name: entry.name, path: relPath, type: 'file', size, modified });
    }
  }
  return results;
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
  app.post('/register-group', async (req, res) => {
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
      const group = {
        name: agentId,
        folder,
        trigger: `@${agentId}`,
        added_at: new Date().toISOString(),
        requiresTrigger: false, // webapp agents respond to all messages (no group trigger needed)
      };

      // Write CLAUDE.md before registering so the folder exists when registerGroup runs
      const groupDir = path.join(process.cwd(), 'groups', folder);
      fs.mkdirSync(groupDir, { recursive: true });

      if (claudeMdContent) {
        fs.writeFileSync(path.join(groupDir, 'CLAUDE.md'), claudeMdContent, 'utf8');
      }

      // Use onRegisterGroup callback if available — updates in-memory state + DB.
      // Fall back to import for standalone/test usage where the callback isn't wired.
      if (opts.onRegisterGroup) {
        opts.onRegisterGroup(jid, group);
      } else {
        const { setRegisteredGroup } = await import('../../db.js');
        setRegisteredGroup(jid, group);
      }

      // Generate an agent wallet (non-blocking — failures are logged but don't block registration)
      let walletAddress: string | undefined;
      try {
        walletAddress = await createAgentWallet(agentId);
      } catch (walletErr) {
        logger.warn({ err: walletErr, agentId }, '[webapp] wallet generation failed (non-fatal)');
      }

      logger.info({ jid, folder, walletAddress }, '[webapp] group registered');
      res.json({ success: true, groupId: agentId, folder, walletAddress });
    } catch (err) {
      logger.error({ err }, '[webapp] register-group error');
      res.status(500).json({ error: 'failed to register group' });
    }
  });

  // GET /agents/:agentId/files — list files in the agent's group workspace (OBS-05)
  app.get('/agents/:agentId/files', (req, res) => {
    const { agentId } = req.params;
    if (!agentId) {
      res.status(400).json({ error: 'agentId required' });
      return;
    }
    // Resolve the group folder for this agent (matches the folder registered in /register-group)
    // The folder name is the agentId (see register-group handler: folder: agentId)
    const folder = agentId;
    try {
      const groupPath = resolveGroupFolderPath(folder);
      // Recursively list files (2 levels deep max — avoid dumping entire container FS)
      const entries = listDir(groupPath, groupPath, 0);
      res.json({ files: entries });
    } catch (err) {
      // Folder doesn't exist yet (agent never ran) or invalid agentId
      logger.warn({ agentId, err }, '[webapp] files: folder not found');
      res.json({ files: [] });
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
