import type { AstroCookies } from "astro";
import { shopifyFetchServer } from "./shopify";
import { GET_CUSTOMER } from "./queries";
import {
  isCustomerAccountsEnabled,
  getCustomerAccountsCustomer,
  deleteCustomerAccountsTokens,
} from "./customer-accounts";

const TOKEN_COOKIE = "customer_access_token";
const TOKEN_MAX_AGE = 60 * 60 * 24 * 14; // 14 days

export function getCustomerToken(cookies: AstroCookies): string | undefined {
  return cookies.get(TOKEN_COOKIE)?.value;
}

export function setCustomerToken(cookies: AstroCookies, token: string): void {
  cookies.set(TOKEN_COOKIE, token, {
    path: "/",
    httpOnly: true,
    secure: import.meta.env.PROD,
    sameSite: "lax",
    maxAge: TOKEN_MAX_AGE,
  });
}

export function deleteCustomerToken(cookies: AstroCookies): void {
  cookies.delete(TOKEN_COOKIE, { path: "/" });
}

export async function getCustomer(cookies: AstroCookies) {
  // Try Customer Accounts API first if enabled
  if (isCustomerAccountsEnabled()) {
    const caCustomer = await getCustomerAccountsCustomer(cookies);
    if (caCustomer) return caCustomer;
  }

  // Fall back to classic Storefront API
  const token = getCustomerToken(cookies);
  if (!token) return null;
  try {
    const data = await shopifyFetchServer({
      query: GET_CUSTOMER,
      variables: { customerAccessToken: token },
    });
    return data?.customer ?? null;
  } catch {
    return null;
  }
}

export function logout(cookies: AstroCookies): void {
  deleteCustomerToken(cookies);
  deleteCustomerAccountsTokens(cookies);
}
