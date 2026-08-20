import { AsyncLocalStorage } from 'node:async_hooks';
import { buildUUID, getCookieValue, SHOPIFY_S, SHOPIFY_Y, TRACKING_CONSENT } from './cookies';
import type { ShopifyTrackingContext } from './trackingContext';

export const trackingStorage = new AsyncLocalStorage<ShopifyTrackingContext>();

export function createTrackingContext(request: Request): ShopifyTrackingContext {
  const cookieHeader = request.headers.get('cookie') || '';
  const uniqueToken = getCookieValue(cookieHeader, SHOPIFY_Y) || undefined;
  const visitToken = getCookieValue(cookieHeader, SHOPIFY_S) || undefined;
  const consent = getCookieValue(cookieHeader, TRACKING_CONSENT) || undefined;

  return {
    request,
    uniqueToken,
    visitToken,
    consent,
    setCookies: [],
    serverTiming: '',
  };
}

export function getTrackingHeaders(): Record<string, string> {
  const ctx = trackingStorage.getStore();
  if (!ctx) return {};

  const headers: Record<string, string> = {};

  if (!ctx.uniqueToken && !ctx.generatedUniqueToken) {
    ctx.generatedUniqueToken = buildUUID();
  }
  if (!ctx.visitToken && !ctx.generatedVisitToken) {
    ctx.generatedVisitToken = buildUUID();
  }

  if (ctx.uniqueToken) headers['X-Shopify-Unique-Token'] = ctx.uniqueToken;
  else if (ctx.generatedUniqueToken) headers['X-Shopify-Unique-Token'] = ctx.generatedUniqueToken;

  if (ctx.visitToken) headers['X-Shopify-Visit-Token'] = ctx.visitToken;
  else if (ctx.generatedVisitToken) headers['X-Shopify-Visit-Token'] = ctx.generatedVisitToken;

  return headers;
}

function cookieName(setCookieValue: string): string {
  const match = setCookieValue.match(/^([^=]+)=/);
  return match ? match[1].trim() : setCookieValue;
}

function dedupeCookies(cookies: string[]): string[] {
  const seen = new Map<string, string>();
  for (const c of cookies) {
    seen.set(cookieName(c), c);
  }
  return Array.from(seen.values());
}

export function collectTrackingResponseHeaders(response: Response): void {
  const ctx = trackingStorage.getStore();
  if (!ctx) return;

  try {
    const setCookie = response.headers.getSetCookie();
    if (setCookie.length > 0) {
      ctx.setCookies.push(...setCookie);
      ctx.setCookies = dedupeCookies(ctx.setCookies);
    }
  } catch {
    const setCookie = response.headers.get('set-cookie');
    if (setCookie) {
      ctx.setCookies.push(setCookie);
      ctx.setCookies = dedupeCookies(ctx.setCookies);
    }
  }

  const serverTiming = response.headers.get('server-timing');
  if (serverTiming) {
    ctx.serverTiming = serverTiming;
  }
}
