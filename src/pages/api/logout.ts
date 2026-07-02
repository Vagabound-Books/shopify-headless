import type { APIRoute } from "astro";
import { logout } from "../../lib/auth";

const doLogout = async ({ cookies }: { cookies: any }) => {
  logout(cookies);
  // Redirect to home page, NOT /account/login/, because the login page
  // immediately redirects to Shopify OAuth and the user gets silently
  // re-authenticated (Shopify session is still active in the browser).
  return new Response(null, { status: 302, headers: { Location: "/" } });
};

export const GET: APIRoute = doLogout;
export const POST: APIRoute = doLogout;
