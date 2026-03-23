/**
 * Uniswap Trading API proxy.
 * Forwards requests to the Uniswap Trading API, injecting the API key.
 * Used by the credential proxy for /uniswap/* routes.
 */

import { request as httpsRequest } from 'https';
import { IncomingMessage } from 'http';
import { logger } from './logger.js';

const UNISWAP_BASE_URL = 'https://trade-api.gateway.uniswap.org/v1';

/** Allowed Uniswap API paths (whitelist to prevent abuse). */
const ALLOWED_PATHS = new Set([
  '/quote',
  '/swap',
  '/order',
  '/check_approval',
  '/swaps',
  '/orders',
  '/batch-swap',
]);

export interface UniswapProxyConfig {
  apiKey: string;
}

let config: UniswapProxyConfig | null = null;

export function initUniswapProxy(apiKey: string): boolean {
  if (!apiKey) {
    logger.warn('[uniswap-proxy] UNISWAP_API_KEY not set — Uniswap proxy disabled');
    return false;
  }
  config = { apiKey };
  logger.info('[uniswap-proxy] initialized');
  return true;
}

/**
 * Handle a Uniswap proxy request.
 * @param uniswapPath - The path after /uniswap (e.g., "/quote")
 * @param method - HTTP method
 * @param body - Request body (Buffer)
 * @param queryString - Optional query string (e.g., "txHash=0x...")
 * @returns Response { statusCode, headers, body }
 */
export function proxyUniswapRequest(
  uniswapPath: string,
  method: string,
  body: Buffer,
  queryString?: string,
): Promise<{ statusCode: number; headers: Record<string, string>; body: Buffer }> {
  return new Promise((resolve, reject) => {
    if (!config) {
      resolve({
        statusCode: 503,
        headers: { 'content-type': 'application/json' },
        body: Buffer.from(JSON.stringify({ error: 'Uniswap proxy not configured' })),
      });
      return;
    }

    // Validate path is in allowlist
    const basePath = uniswapPath.split('?')[0];
    if (!ALLOWED_PATHS.has(basePath)) {
      resolve({
        statusCode: 404,
        headers: { 'content-type': 'application/json' },
        body: Buffer.from(JSON.stringify({ error: `Unknown Uniswap endpoint: ${basePath}` })),
      });
      return;
    }

    const fullPath = `${uniswapPath}${queryString ? `?${queryString}` : ''}`;
    const url = new URL(`${UNISWAP_BASE_URL}${fullPath}`);

    const req = httpsRequest(
      {
        hostname: url.hostname,
        port: 443,
        path: url.pathname + url.search,
        method,
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': config.apiKey,
          'Content-Length': body.length,
        },
      },
      (res: IncomingMessage) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => {
          const responseBody = Buffer.concat(chunks);
          const responseHeaders: Record<string, string> = {};
          for (const [key, value] of Object.entries(res.headers)) {
            if (typeof value === 'string') responseHeaders[key] = value;
          }
          resolve({
            statusCode: res.statusCode || 500,
            headers: responseHeaders,
            body: responseBody,
          });
        });
      },
    );

    req.on('error', (err) => {
      logger.error({ err, path: fullPath }, '[uniswap-proxy] upstream error');
      reject(err);
    });

    req.write(body);
    req.end();
  });
}
