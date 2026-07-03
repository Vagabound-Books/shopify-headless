import { defineMiddleware } from "astro:middleware";

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
