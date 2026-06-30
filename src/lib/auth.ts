import type { AstroCookies } from "astro";
import { shopifyFetchServer } from "./shopify";
import { GET_CUSTOMER } from "./queries";

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
