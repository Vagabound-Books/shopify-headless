import { defineMiddleware } from "astro:middleware";

const SHOPIFY_ORIGIN = "https://vagabound-books.myshopify.com";
const PROXY_PATHS = ["/cart/c/", "/checkouts/", "/orders/"];

function isShopifyProxyPath(pathname: string): boolean {
  return PROXY_PATHS.some((prefix) => pathname.startsWith(prefix));
}

async function proxyToShopify(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const targetUrl = new URL(url.pathname + url.search, SHOPIFY_ORIGIN);

  // Clone headers but remove host-specific ones
  const headers = new Headers(request.headers);
  headers.delete("host");
  headers.set("host", "vagabound-books.myshopify.com");

  const proxyRequest = new Request(targetUrl.toString(), {
    method: request.method,
    headers,
    body: request.body,
    redirect: "manual",
  });

  try {
    const response = await fetch(proxyRequest);
    // Rewrite any Location headers that point to myshopify.com or checkout subdomain
    const newHeaders = new Headers(response.headers);
    const location = newHeaders.get("location");
    if (location) {
      // Keep the redirect as-is; browser will follow
      // If Shopify redirects to the custom domain, that's expected behavior
    }
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders,
    });
  } catch (err) {
    console.error("[Middleware] Proxy error:", err);
    return new Response("Checkout temporarily unavailable", { status: 502 });
  }
}

const allowedOrigins = (import.meta.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

const isProd = import.meta.env.PROD;

function isAllowed(origin: string | null): boolean {
  if (!origin) return false;
  // In dev, allow any origin for local testing
  if (!isProd && allowedOrigins.length === 0) return true;
  // In prod, require explicit configuration
  if (allowedOrigins.length === 0) return false;
  return allowedOrigins.some(
    (allowed) =>
      origin === allowed ||
      (allowed.startsWith("http://") && origin === allowed) ||
      (allowed.startsWith("https://") && origin === allowed)
  );
}

export const onRequest = defineMiddleware(async (context, next) => {
  const { request, url } = context;

  // Proxy Shopify checkout paths directly to Shopify
  if (isShopifyProxyPath(url.pathname)) {
    return proxyToShopify(request);
  }

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

  const response = await next();

  // Security headers
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");

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
