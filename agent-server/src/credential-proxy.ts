/**
 * Credential proxy for container isolation.
 * Containers connect here instead of directly to the Anthropic API.
 * The proxy injects real credentials so containers never see them.
 *
 * Route dispatching:
 *   /wallet/*    → wallet-manager (sign txs, get address)
 *   /uniswap/*   → Uniswap Trading API proxy (with API key injection)
 *   /rpc         → Base mainnet JSON-RPC proxy
 *   *            → Anthropic API (existing behavior)
 *
 * Two auth modes for Anthropic:
 *   API key:  Proxy injects x-api-key on every request.
 *   OAuth:    Container CLI exchanges its placeholder token for a temp
 *             API key via /api/oauth/claude_cli/create_api_key.
 *             Proxy injects real OAuth token on that exchange request;
 *             subsequent requests carry the temp key which is valid as-is.
 */
import { createServer, Server, IncomingMessage, ServerResponse } from 'http';
import { request as httpsRequest } from 'https';
import { request as httpRequest, RequestOptions } from 'http';

import { readEnvFile } from './env.js';
import { logger } from './logger.js';
import {
  initWalletManager,
  getAgentAddress,
  sendTransaction,
  signTypedData,
} from './wallet-manager.js';
import { initUniswapProxy, proxyUniswapRequest } from './uniswap-proxy.js';

export type AuthMode = 'api-key' | 'oauth';

export interface ProxyConfig {
  authMode: AuthMode;
}

const BASE_RPC_URL = 'https://mainnet.base.org';

/** Extract agent ID from the X-Agent-Id header. */
function getAgentId(req: IncomingMessage): string | null {
  const header = req.headers['x-agent-id'];
  if (typeof header === 'string' && header.length > 0) return header;
  return null;
}

/** Send a JSON response. */
function jsonResponse(res: ServerResponse, statusCode: number, data: unknown) {
  const body = JSON.stringify(data);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

/** Handle /wallet/* routes. */
async function handleWalletRoute(
  req: IncomingMessage,
  res: ServerResponse,
  path: string,
  body: Buffer,
) {
  const agentId = getAgentId(req);
  if (!agentId) {
    jsonResponse(res, 400, { error: 'X-Agent-Id header required for wallet operations' });
    return;
  }

  try {
    if (path === '/wallet/address' && req.method === 'GET') {
      const address = await getAgentAddress(agentId);
      if (!address) {
        jsonResponse(res, 404, { error: 'No wallet found for this agent' });
        return;
      }
      jsonResponse(res, 200, { address });
      return;
    }

    if (path === '/wallet/send' && req.method === 'POST') {
      const tx = JSON.parse(body.toString());
      const result = await sendTransaction(agentId, tx);
      jsonResponse(res, 200, { txHash: result.txHash, status: 'pending' });
      return;
    }

    if (path === '/wallet/sign-typed-data' && req.method === 'POST') {
      const typedData = JSON.parse(body.toString());
      const result = await signTypedData(agentId, typedData);
      jsonResponse(res, 200, { signature: result.signature });
      return;
    }

    jsonResponse(res, 404, { error: `Unknown wallet endpoint: ${path}` });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ err, path, agentId }, '[credential-proxy] wallet route error');
    jsonResponse(res, 500, { error: message });
  }
}

/** Handle /uniswap/* routes. */
async function handleUniswapRoute(
  req: IncomingMessage,
  res: ServerResponse,
  path: string,
  body: Buffer,
) {
  try {
    // Extract the Uniswap path (e.g., /uniswap/quote → /quote)
    const uniswapPath = path.replace(/^\/uniswap/, '');
    const urlObj = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    const queryString = urlObj.search ? urlObj.search.slice(1) : undefined;

    const result = await proxyUniswapRequest(
      uniswapPath,
      req.method || 'POST',
      body,
      queryString,
    );

    res.writeHead(result.statusCode, {
      'Content-Type': result.headers['content-type'] || 'application/json',
      'Content-Length': result.body.length,
    });
    res.end(result.body);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ err, path }, '[credential-proxy] uniswap route error');
    jsonResponse(res, 502, { error: message });
  }
}

/** Handle /rpc route — proxy to Base mainnet RPC. */
async function handleRpcRoute(
  _req: IncomingMessage,
  res: ServerResponse,
  body: Buffer,
) {
  const url = new URL(BASE_RPC_URL);

  const upstream = httpsRequest(
    {
      hostname: url.hostname,
      port: 443,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': body.length,
      },
    },
    (upRes) => {
      const chunks: Buffer[] = [];
      upRes.on('data', (c: Buffer) => chunks.push(c));
      upRes.on('end', () => {
        const responseBody = Buffer.concat(chunks);
        res.writeHead(upRes.statusCode || 500, {
          'Content-Type': 'application/json',
          'Content-Length': responseBody.length,
        });
        res.end(responseBody);
      });
    },
  );

  upstream.on('error', (err) => {
    logger.error({ err }, '[credential-proxy] RPC upstream error');
    jsonResponse(res, 502, { error: 'RPC request failed' });
  });

  upstream.write(body);
  upstream.end();
}

export function startCredentialProxy(
  port: number,
  host = '127.0.0.1',
): Promise<Server> {
  const secrets = readEnvFile([
    'ANTHROPIC_API_KEY',
    'CLAUDE_CODE_OAUTH_TOKEN',
    'ANTHROPIC_AUTH_TOKEN',
    'ANTHROPIC_BASE_URL',
    'UNISWAP_API_KEY',
  ]);

  const authMode: AuthMode = secrets.ANTHROPIC_API_KEY ? 'api-key' : 'oauth';
  const oauthToken =
    secrets.CLAUDE_CODE_OAUTH_TOKEN || secrets.ANTHROPIC_AUTH_TOKEN;

  const upstreamUrl = new URL(
    secrets.ANTHROPIC_BASE_URL || 'https://api.anthropic.com',
  );
  const isHttps = upstreamUrl.protocol === 'https:';
  const makeRequest = isHttps ? httpsRequest : httpRequest;

  // Initialize wallet manager and Uniswap proxy (non-fatal if they fail)
  initWalletManager();
  if (secrets.UNISWAP_API_KEY) {
    initUniswapProxy(secrets.UNISWAP_API_KEY);
  }

  return new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on('data', (c) => chunks.push(c));
      req.on('end', () => {
        const body = Buffer.concat(chunks);
        const urlPath = (req.url || '/').split('?')[0];

        // --- Route dispatching ---

        // /wallet/* → wallet manager
        if (urlPath.startsWith('/wallet/')) {
          handleWalletRoute(req, res, urlPath, body);
          return;
        }

        // /uniswap/* → Uniswap Trading API proxy
        if (urlPath.startsWith('/uniswap/')) {
          handleUniswapRoute(req, res, urlPath, body);
          return;
        }

        // /rpc → Base mainnet JSON-RPC
        if (urlPath === '/rpc') {
          handleRpcRoute(req, res, body);
          return;
        }

        // --- Default: Anthropic API proxy (existing behavior) ---
        const headers: Record<string, string | number | string[] | undefined> =
          {
            ...(req.headers as Record<string, string>),
            host: upstreamUrl.host,
            'content-length': body.length,
          };

        // Strip hop-by-hop headers that must not be forwarded by proxies
        delete headers['connection'];
        delete headers['keep-alive'];
        delete headers['transfer-encoding'];
        // Strip internal routing headers before forwarding to Anthropic
        delete headers['x-agent-id'];

        if (authMode === 'api-key') {
          // API key mode: inject x-api-key on every request
          delete headers['x-api-key'];
          headers['x-api-key'] = secrets.ANTHROPIC_API_KEY;
        } else {
          // OAuth mode: replace placeholder Bearer token with the real one
          // only when the container actually sends an Authorization header
          // (exchange request + auth probes). Post-exchange requests use
          // x-api-key only, so they pass through without token injection.
          if (headers['authorization']) {
            delete headers['authorization'];
            if (oauthToken) {
              headers['authorization'] = `Bearer ${oauthToken}`;
            }
          }
        }

        const upstream = makeRequest(
          {
            hostname: upstreamUrl.hostname,
            port: upstreamUrl.port || (isHttps ? 443 : 80),
            path: req.url,
            method: req.method,
            headers,
          } as RequestOptions,
          (upRes) => {
            res.writeHead(upRes.statusCode!, upRes.headers);
            upRes.pipe(res);
          },
        );

        upstream.on('error', (err) => {
          logger.error(
            { err, url: req.url },
            'Credential proxy upstream error',
          );
          if (!res.headersSent) {
            res.writeHead(502);
            res.end('Bad Gateway');
          }
        });

        upstream.write(body);
        upstream.end();
      });
    });

    server.listen(port, host, () => {
      logger.info({ port, host, authMode }, 'Credential proxy started');
      resolve(server);
    });

    server.on('error', reject);
  });
}

/** Detect which auth mode the host is configured for. */
export function detectAuthMode(): AuthMode {
  const secrets = readEnvFile(['ANTHROPIC_API_KEY']);
  return secrets.ANTHROPIC_API_KEY ? 'api-key' : 'oauth';
}
