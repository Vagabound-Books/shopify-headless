import type { APIRoute } from "astro";
import { shopifyFetchServer } from "../../lib/shopify";
import { CUSTOMER_ACCESS_TOKEN_DELETE } from "../../lib/queries";
import { getCustomerToken, logout } from "../../lib/auth";

export const POST: APIRoute = async ({ cookies }) => {
  const token = getCustomerToken(cookies);
  if (token) {
    try {
      await shopifyFetchServer({
        query: CUSTOMER_ACCESS_TOKEN_DELETE,
        variables: { customerAccessToken: token },
      });
    } catch (err) {
      console.error("[Logout] Failed to revoke classic token:", err);
    }
  }
  logout(cookies);
  return new Response(null, { status: 302, headers: { Location: "/account/login" } });
};
