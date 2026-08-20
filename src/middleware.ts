import { defineMiddleware } from "astro:middleware";
import {
  createTrackingContext,
  trackingStorage,
} from "./lib/analytics/trackingContext.server";
import { buildServerTimingHeader } from "./lib/analytics/trackingContext";

const allowedOrigins = (import.meta.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((o: string) => o.trim())
  .filter(Boolean);

const isProd = import.meta.env.PROD;

const contentSecurityPolicy = isProd
  ? [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.shopify.com",
      "style-src 'self' 'unsafe-inline' https://cdn.shopify.com https://use.typekit.net https://fonts.googleapis.com",
      "img-src 'self' data: https: https://cdn.shopify.com",
      "font-src 'self' data: https://cdn.shopify.com https://use.typekit.net https://*.typekit.net https://fonts.gstatic.com",
      "connect-src 'self' https://cdn.shopify.com https://monorail-edge.shopifysvc.com https://vagaboundbooks.myshopify.com https://vagaboundbooks.com",
      "frame-src 'self' https://checkout.vagaboundbooks.com https://vagaboundbooks.myshopify.com",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self' https://checkout.vagaboundbooks.com",
      "upgrade-insecure-requests",
    ].join("; ")
  : [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.shopify.com",
      "style-src 'self' 'unsafe-inline' https://cdn.shopify.com https://use.typekit.net https://fonts.googleapis.com",
      "img-src 'self' data: https: https://cdn.shopify.com",
      "font-src 'self' data: https://cdn.shopify.com https://use.typekit.net https://*.typekit.net https://fonts.gstatic.com",
      "connect-src *",
      "frame-src 'self' https://checkout.vagaboundbooks.com https://vagaboundbooks.myshopify.com",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self' https://checkout.vagaboundbooks.com",
    ].join("; ");


function cookieName(setCookieValue: string): string {
  const match = setCookieValue.match(/^([^=]+)=/);
  return match ? match[1].trim() : setCookieValue;
}

function mergeCookies(existing: string[], incoming: string[]): string[] {
  const map = new Map<string, string>();
  for (const c of existing) map.set(cookieName(c), c);
  for (const c of incoming) map.set(cookieName(c), c);
  return Array.from(map.values());
}

function isAllowed(origin: string | null): boolean {
  if (!origin) return false;
  // In dev, allow any origin for local testing
  if (!isProd && allowedOrigins.length === 0) return true;
  // In prod, require explicit configuration
  if (allowedOrigins.length === 0) return false;
  return allowedOrigins.some(
    (allowed: string) =>
      origin === allowed ||
      (allowed.startsWith("http://") && origin === allowed) ||
      (allowed.startsWith("https://") && origin === allowed)
  );
}

export const onRequest = defineMiddleware(async (context, next) => {
  const request = context.request;
  const origin = request.headers.get("origin");

  if (request.method === "OPTIONS") {
    if (isAllowed(origin)) {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": origin || "*",
          "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With",
          "Access-Control-Allow-Credentials": "true",
          "Access-Control-Max-Age": "86400",
        },
      });
    }
    return new Response(null, { status: 204 });
  }

  const trackingContext = createTrackingContext(request);

  const response = await trackingStorage.run(trackingContext, async () => next());

  // Forward Shopify tracking cookies and server-timing headers collected during rendering
  const existingCookies = response.headers.getSetCookie ? response.headers.getSetCookie() : [];
  const mergedCookies = mergeCookies(existingCookies, trackingContext.setCookies);
  response.headers.delete("Set-Cookie");
  for (const cookie of mergedCookies) {
    response.headers.append("Set-Cookie", cookie);
  }

  const serverTiming = buildServerTimingHeader(trackingContext);
  if (serverTiming) {
    response.headers.append("Server-Timing", serverTiming);
  }

  // Security headers
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  response.headers.set("Content-Security-Policy", contentSecurityPolicy);

  if (isAllowed(origin)) {
    response.headers.set("Access-Control-Allow-Origin", origin || "*");
    response.headers.set("Access-Control-Allow-Credentials", "true");
    response.headers.set(
      "Access-Control-Allow-Methods",
      "GET, POST, PUT, DELETE, OPTIONS"
    );
    response.headers.set(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization, X-Requested-With"
    );
  }

  return response;
});
