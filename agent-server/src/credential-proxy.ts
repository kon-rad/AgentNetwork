/**
 * Credential proxy for container isolation.
 * Containers connect here instead of directly to the Anthropic API.
 * The proxy injects real credentials so containers never see them.
 *
 * Route dispatching:
 *   /wallet/*      → wallet-manager (sign txs, get address)
 *   /uniswap/*     → Uniswap Trading API proxy (with API key injection)
 *   /rpc           → Base mainnet JSON-RPC proxy
 *   /agentkit/sign → sign outbound AgentKit proofs using agent's wallet
 *   *              → Anthropic API (existing behavior)
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
  logTrade,
  updateHoldings,
} from './wallet-manager.js';
import { initUniswapProxy, proxyUniswapRequest } from './uniswap-proxy.js';
import { signAgentkitProof } from './agentkit-signer.js';

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

/** Handle /trade/execute — send a swap transaction and log it. */
async function handleTradeExecute(
  req: IncomingMessage,
  res: ServerResponse,
  body: Buffer,
) {
  const agentId = getAgentId(req);
  if (!agentId) {
    jsonResponse(res, 400, { error: 'X-Agent-Id header required' });
    return;
  }

  try {
    const data = JSON.parse(body.toString());
    const { tx, trade } = data as {
      tx: { to: string; data?: string; value?: string };
      trade: {
        tokenInAddress: string;
        tokenOutAddress: string;
        tokenInSymbol?: string;
        tokenOutSymbol?: string;
        amountIn: string;
        amountOut: string;
        amountInFormatted?: string;
        amountOutFormatted?: string;
        priceImpact?: string;
        gasFee?: string;
      };
    };

    if (!tx || !trade) {
      jsonResponse(res, 400, { error: 'Both tx and trade fields required' });
      return;
    }

    // Send the transaction
    const result = await sendTransaction(agentId, tx);

    // Log the trade (non-blocking)
    logTrade({
      agentId,
      txHash: result.txHash,
      tokenInAddress: trade.tokenInAddress,
      tokenOutAddress: trade.tokenOutAddress,
      tokenInSymbol: trade.tokenInSymbol,
      tokenOutSymbol: trade.tokenOutSymbol,
      amountIn: trade.amountIn,
      amountOut: trade.amountOut,
      amountInFormatted: trade.amountInFormatted,
      amountOutFormatted: trade.amountOutFormatted,
      priceImpact: trade.priceImpact,
      gasFee: trade.gasFee,
      status: 'pending',
    }).catch(() => {});

    jsonResponse(res, 200, { txHash: result.txHash, status: 'pending', tradeLogged: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ err, agentId }, '[credential-proxy] trade execute error');
    jsonResponse(res, 500, { error: message });
  }
}

/** Handle /trade/update-holdings — update token balances after a trade. */
async function handleUpdateHoldings(
  req: IncomingMessage,
  res: ServerResponse,
  body: Buffer,
) {
  const agentId = getAgentId(req);
  if (!agentId) {
    jsonResponse(res, 400, { error: 'X-Agent-Id header required' });
    return;
  }

  try {
    const { holdings } = JSON.parse(body.toString()) as {
      holdings: Array<{
        tokenAddress: string;
        tokenSymbol?: string;
        decimals: number;
        balance: string;
        balanceFormatted?: string;
      }>;
    };

    await updateHoldings(agentId, holdings);
    jsonResponse(res, 200, { success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ err, agentId }, '[credential-proxy] update holdings error');
    jsonResponse(res, 500, { error: message });
  }
}

/** Handle /agentkit/sign — sign an outbound AgentKit proof using the agent's wallet. */
async function handleAgentkitSign(
  req: IncomingMessage,
  res: ServerResponse,
  body: Buffer,
) {
  const agentId = getAgentId(req);
  if (!agentId) {
    jsonResponse(res, 400, { error: 'X-Agent-Id header required for AgentKit signing' });
    return;
  }

  try {
    const { url, method } = JSON.parse(body.toString()) as {
      url: string;
      method?: string;
    };

    if (!url) {
      jsonResponse(res, 400, { error: 'url field required' });
      return;
    }

    const proof = await signAgentkitProof(agentId, url, method || 'GET');
    jsonResponse(res, 200, { proof });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ err, agentId }, '[credential-proxy] agentkit sign error');
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

        // /trade/* → trade execution with logging
        if (urlPath === '/trade/execute' && req.method === 'POST') {
          handleTradeExecute(req, res, body);
          return;
        }
        if (urlPath === '/trade/update-holdings' && req.method === 'POST') {
          handleUpdateHoldings(req, res, body);
          return;
        }

        // /agentkit/sign → sign outbound AgentKit proofs
        if (urlPath === '/agentkit/sign' && req.method === 'POST') {
          handleAgentkitSign(req, res, body);
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
