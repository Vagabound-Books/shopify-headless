import type { APIRoute } from "astro";
import {
  deleteCustomerAccountsTokens,
  getCustomerAccountsTokens,
  buildLogoutUrl,
} from "../../lib/customer-accounts";

const doLogout = async ({ cookies }: { cookies: any }) => {
  const { idToken } = getCustomerAccountsTokens(cookies);

  // 1. Clear local cookies (access_token, refresh_token, id_token)
  deleteCustomerAccountsTokens(cookies);

  // 2. Build Shopify logout URL to clear the browser session too
  let redirectTo = "/";
  if (idToken) {
    try {
      redirectTo = await buildLogoutUrl(idToken);
    } catch {
      // Fall back to home page if discovery fails
    }
  }

  // Astro does not automatically serialize queued cookies into a manually
  // created Response. We must explicitly append the Set-Cookie headers.
  const headers = new Headers({ Location: redirectTo });
  for (const [name, value] of cookies.headers()) {
    headers.append(name, value);
  }

  return new Response(null, { status: 302, headers });
};

export const GET: APIRoute = doLogout;
export const POST: APIRoute = doLogout;
