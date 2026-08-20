import { buildUUID, getCookieValue, SHOPIFY_S, SHOPIFY_Y, TRACKING_CONSENT } from './cookies';

export interface ShopifyTrackingContext {
  request: Request;
  uniqueToken?: string;
  visitToken?: string;
  consent?: string;
  generatedUniqueToken?: string;
  generatedVisitToken?: string;
  setCookies: string[];
  serverTiming: string;
}

/**
 * Client-safe stub. The real server implementation lives in trackingContext.server.ts
 * so that node:async_hooks / AsyncLocalStorage is never bundled for the browser.
 */
export function getTrackingHeaders(): Record<string, string> {
  return {};
}

/**
 * Client-safe stub. No-op on the client.
 */
export function collectTrackingResponseHeaders(_response: Response): void {
  // no-op on client
}

export function buildServerTimingHeader(ctx: ShopifyTrackingContext): string | undefined {
  const values: Record<string, string | undefined> = {
    _y: ctx.uniqueToken || ctx.generatedUniqueToken,
    _s: ctx.visitToken || ctx.generatedVisitToken,
    _cmp: ctx.consent,
  };

  const parts = Object.entries(values)
    .filter(([, value]) => Boolean(value))
    .map(([key, value]) => `${key};desc=${value}`);

  return parts.length > 0 ? parts.join(', ') : undefined;
}

// Re-export cookie helpers used by the server file so both modules stay in sync.
export { buildUUID, getCookieValue, SHOPIFY_S, SHOPIFY_Y, TRACKING_CONSENT };
