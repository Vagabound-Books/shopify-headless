import { defineMiddleware } from "astro:middleware";

const allowedOrigins = (import.meta.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

function isAllowed(origin: string | null): boolean {
  if (!origin) return false;
  if (allowedOrigins.length === 0) return true;
  return allowedOrigins.some(
    (allowed) =>
      origin === allowed ||
      (allowed.startsWith("http://") && origin === allowed) ||
      (allowed.startsWith("https://") && origin === allowed)
  );
}

export const onRequest = defineMiddleware(async (context, next) => {
  const origin = context.request.headers.get("origin");

  if (context.request.method === "OPTIONS") {
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
