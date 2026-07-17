import { createHash, randomBytes } from "crypto";
import type { AstroCookies } from "astro";
import {
  CUSTOMER_ACCOUNTS_CUSTOMER_QUERY,
  CUSTOMER_ADDRESS_CREATE,
  CUSTOMER_ADDRESS_UPDATE,
  CUSTOMER_ADDRESS_DELETE,
  CUSTOMER_DEFAULT_ADDRESS_UPDATE,
  CUSTOMER_WISHLIST_QUERY,
} from "./queries";

// Use process.env for server-side secrets so they are read at runtime
// rather than inlined at build time by Vite.
const CLIENT_ID = process.env.CUSTOMER_ACCOUNTS_CLIENT_ID || "";
const CLIENT_SECRET = process.env.CUSTOMER_ACCOUNTS_CLIENT_SECRET || "";
const SHOP_ID = process.env.SHOPIFY_SHOP_ID || "";
const SHOP_DOMAIN = process.env.SHOPIFY_STORE_DOMAIN || "";
const API_VERSION = process.env.SHOPIFY_API_VERSION || "2026-07";
const SITE_URL = process.env.PUBLIC_SITE_URL || "";
const REDIRECT_URI =
  process.env.CUSTOMER_ACCOUNTS_REDIRECT_URI ||
  (SITE_URL ? `${SITE_URL}/account/callback` : "/account/callback");

// Cookie names
const CA_ACCESS_TOKEN = "ca_access_token";
const CA_REFRESH_TOKEN = "ca_refresh_token";
const CA_ID_TOKEN = "ca_id_token";
const CA_STATE = "ca_state";
const CA_NONCE = "ca_nonce";
const CA_CODE_VERIFIER = "ca_code_verifier";

// ── Discovery cache ──────────────────────────────────────────────
let discoveryCache: {
  auth: {
    authorization_endpoint: string;
    token_endpoint: string;
    end_session_endpoint?: string;
  } | null;
  api: {
    graphql_api: string;
    mcp_api?: string;
  } | null;
} | null = null;

async function discoverAuthEndpoints() {
  if (discoveryCache?.auth) return discoveryCache.auth;
  if (!SHOP_DOMAIN) {
    throw new Error(
      "Customer Accounts API discovery requires SHOPIFY_STORE_DOMAIN."
    );
  }

  const res = await fetch(
    `https://${SHOP_DOMAIN}/.well-known/openid-configuration`
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Auth discovery failed: ${res.status} ${text}`);
  }

  const data = await res.json();
  discoveryCache = { ...discoveryCache, auth: data };
  return data as {
    authorization_endpoint: string;
    token_endpoint: string;
    end_session_endpoint?: string;
  };
}

async function discoverApiEndpoints() {
  if (discoveryCache?.api) return discoveryCache.api;
  if (!SHOP_DOMAIN) {
    throw new Error(
      "Customer Accounts API discovery requires SHOPIFY_STORE_DOMAIN."
    );
  }

  const res = await fetch(
    `https://${SHOP_DOMAIN}/.well-known/customer-account-api`
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API discovery failed: ${res.status} ${text}`);
  }

  const data = await res.json();
  discoveryCache = { ...discoveryCache, api: data };
  return data as { graphql_api: string; mcp_api?: string };
}

function base64URLEncode(buffer: Buffer): string {
  return buffer
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

export async function buildLogoutUrl(idToken: string): Promise<string> {
  assertConfigured();
  const { end_session_endpoint } = await discoverAuthEndpoints();
  if (!end_session_endpoint) {
    throw new Error("No end_session_endpoint discovered");
  }
  const url = new URL(end_session_endpoint);
  url.searchParams.set("id_token_hint", idToken);
  url.searchParams.set("post_logout_redirect_uri", SITE_URL || "/");
  return url.toString();
}

function generateCodeVerifier(): string {
  return base64URLEncode(randomBytes(32));
}

function generateCodeChallenge(verifier: string): string {
  return base64URLEncode(createHash("sha256").update(verifier).digest());
}

function generateState(): string {
  return base64URLEncode(randomBytes(16));
}

function generateNonce(): string {
  return base64URLEncode(randomBytes(16));
}

function setCookie(cookies: AstroCookies, name: string, value: string) {
  cookies.set(name, value, {
    path: "/",
    httpOnly: true,
    secure: import.meta.env.PROD,
    sameSite: "lax",
    maxAge: 600, // 10 minutes – only needed during OAuth handshake
  });
}

function deleteCookie(cookies: AstroCookies, name: string) {
  // Astro's cookies.delete() only sends path/domain, not secure/sameSite.
  // Browsers won't delete a Secure cookie unless the deletion header also
  // has Secure. Overwrite with an empty value and maxAge: 0 instead.
  cookies.set(name, "", {
    path: "/",
    httpOnly: true,
    secure: import.meta.env.PROD,
    sameSite: "lax",
    maxAge: 0,
  });
}

export function isCustomerAccountsEnabled(): boolean {
  return Boolean(CLIENT_ID && CLIENT_SECRET && SHOP_ID && SHOP_DOMAIN);
}

function assertConfigured() {
  if (!CLIENT_ID || !CLIENT_SECRET || !SHOP_ID || !SHOP_DOMAIN) {
    throw new Error(
      "Customer Accounts API is not fully configured. " +
        "Ensure CUSTOMER_ACCOUNTS_CLIENT_ID, CUSTOMER_ACCOUNTS_CLIENT_SECRET, " +
        "SHOPIFY_SHOP_ID, and SHOPIFY_STORE_DOMAIN are set."
    );
  }
}

export async function buildAuthorizeUrl(cookies: AstroCookies): Promise<string> {
  assertConfigured();
  const { authorization_endpoint } = await discoverAuthEndpoints();

  const state = generateState();
  const nonce = generateNonce();
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);

  setCookie(cookies, CA_STATE, state);
  setCookie(cookies, CA_NONCE, nonce);
  setCookie(cookies, CA_CODE_VERIFIER, codeVerifier);

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: "code",
    redirect_uri: REDIRECT_URI,
    scope: "openid email customer-account-api:full",
    state,
    nonce,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });

  return `${authorization_endpoint}?${params.toString()}`;
}

export async function exchangeCodeForTokens(
  code: string,
  state: string,
  cookies: AstroCookies
) {
  assertConfigured();
  const { token_endpoint } = await discoverAuthEndpoints();

  const storedState = cookies.get(CA_STATE)?.value;
  const codeVerifier = cookies.get(CA_CODE_VERIFIER)?.value;

  console.log('[CA Exchange] state param:', state?.slice(0, 10));
  console.log('[CA Exchange] state cookie exists:', !!storedState);
  console.log('[CA Exchange] state match:', storedState === state);

  // Clear handshake cookies
  deleteCookie(cookies, CA_STATE);
  deleteCookie(cookies, CA_NONCE);
  deleteCookie(cookies, CA_CODE_VERIFIER);

  if (!storedState || storedState !== state) {
    throw new Error(`Invalid state parameter: cookie=${!!storedState}, match=${storedState === state}`);
  }
  if (!codeVerifier) {
    throw new Error("Missing code verifier");
  }

  // Confidential client: send credentials via Basic Auth header
  const credentials = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64");

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: CLIENT_ID,
    code,
    redirect_uri: REDIRECT_URI,
    code_verifier: codeVerifier,
  });

  const res = await fetch(token_endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Authorization": `Basic ${credentials}`,
    },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token exchange failed: ${res.status} ${text}`);
  }

  const data = await res.json();
  setCustomerAccountsTokens(cookies, data.access_token, data.refresh_token, data.id_token);
  return data;
}

export function setCustomerAccountsTokens(
  cookies: AstroCookies,
  accessToken: string,
  refreshToken?: string,
  idToken?: string
) {
  cookies.set(CA_ACCESS_TOKEN, accessToken, {
    path: "/",
    httpOnly: true,
    secure: import.meta.env.PROD,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 14, // 14 days
  });
  if (refreshToken) {
    cookies.set(CA_REFRESH_TOKEN, refreshToken, {
      path: "/",
      httpOnly: true,
      secure: import.meta.env.PROD,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 14,
    });
  }
  if (idToken) {
    cookies.set(CA_ID_TOKEN, idToken, {
      path: "/",
      httpOnly: true,
      secure: import.meta.env.PROD,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 14,
    });
  }
}

export function getCustomerAccountsTokens(cookies: AstroCookies) {
  return {
    accessToken: cookies.get(CA_ACCESS_TOKEN)?.value,
    refreshToken: cookies.get(CA_REFRESH_TOKEN)?.value,
    idToken: cookies.get(CA_ID_TOKEN)?.value,
  };
}

export function deleteCustomerAccountsTokens(cookies: AstroCookies) {
  deleteCookie(cookies, CA_ACCESS_TOKEN);
  deleteCookie(cookies, CA_REFRESH_TOKEN);
  deleteCookie(cookies, CA_ID_TOKEN);
}

export async function refreshAccessToken(cookies: AstroCookies): Promise<string | null> {
  assertConfigured();
  const { token_endpoint } = await discoverAuthEndpoints();

  const { refreshToken } = getCustomerAccountsTokens(cookies);
  if (!refreshToken) return null;

  // Confidential client: send credentials via Basic Auth header
  const credentials = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64");

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: CLIENT_ID,
    refresh_token: refreshToken,
  });

  const res = await fetch(token_endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Authorization": `Basic ${credentials}`,
    },
    body: body.toString(),
  });

  if (!res.ok) {
    deleteCustomerAccountsTokens(cookies);
    return null;
  }

  const data = await res.json();
  setCustomerAccountsTokens(cookies, data.access_token, data.refresh_token);
  return data.access_token as string;
}

export async function customerAccountsFetch<T = any>(
  query: string,
  variables: Record<string, any> = {},
  accessToken: string
): Promise<T> {
  assertConfigured();
  const { graphql_api } = await discoverApiEndpoints();

  const res = await fetch(graphql_api, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "Vagabound-Storefront/1.0",
      Authorization: accessToken,
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Customer Accounts API error: ${res.status} ${text}`);
  }

  const json = await res.json();
  if (json.errors) {
    throw new Error(json.errors.map((e: any) => e.message).join("\n"));
  }

  return json.data as T;
}

export async function createCustomerAddress(
  cookies: AstroCookies,
  address: Record<string, any>
) {
  const { accessToken } = getCustomerAccountsTokens(cookies);
  if (!accessToken) throw new Error("Not authenticated");
  const data = await customerAccountsFetch(
    CUSTOMER_ADDRESS_CREATE,
    { address },
    accessToken
  );
  return data.customerAddressCreate;
}

export async function updateCustomerAddress(
  cookies: AstroCookies,
  addressId: string,
  address: Record<string, any>
) {
  const { accessToken } = getCustomerAccountsTokens(cookies);
  if (!accessToken) throw new Error("Not authenticated");
  const data = await customerAccountsFetch(
    CUSTOMER_ADDRESS_UPDATE,
    { addressId, address },
    accessToken
  );
  return data.customerAddressUpdate;
}

export async function deleteCustomerAddress(
  cookies: AstroCookies,
  addressId: string
) {
  const { accessToken } = getCustomerAccountsTokens(cookies);
  if (!accessToken) throw new Error("Not authenticated");
  const data = await customerAccountsFetch(
    CUSTOMER_ADDRESS_DELETE,
    { addressId },
    accessToken
  );
  return data.customerAddressDelete;
}

export async function setCustomerDefaultAddress(
  cookies: AstroCookies,
  addressId: string
) {
  const { accessToken } = getCustomerAccountsTokens(cookies);
  if (!accessToken) throw new Error("Not authenticated");
  const data = await customerAccountsFetch(
    CUSTOMER_DEFAULT_ADDRESS_UPDATE,
    { addressId },
    accessToken
  );
  return data.customerDefaultAddressUpdate;
}

function normalizeCustomer(caCustomer: any) {
  if (!caCustomer) return null;
  return {
    id: caCustomer.id,
    firstName: caCustomer.firstName,
    lastName: caCustomer.lastName,
    email: caCustomer.emailAddress?.emailAddress,
    phone: caCustomer.phoneNumber?.phoneNumber,
    acceptsMarketing:
      caCustomer.emailAddress?.marketingState === "SUBSCRIBED" ||
      caCustomer.phoneNumber?.marketingState === "SUBSCRIBED",
    createdAt: null,
    updatedAt: null,
    defaultAddress: caCustomer.defaultAddress,
    addresses: caCustomer.addresses,
    orders: {
      edges: (caCustomer.orders?.edges || []).map((e: any) => ({
        node: {
          ...e.node,
          orderNumber: e.node.name,
        },
      })),
    },
  };
}

/**
 * Fetch the authenticated customer's cloud wishlist (the `custom.wishlist`
 * JSON metafield) via the Customer Account API.
 */
export async function getCustomerWishlist(accessToken: string) {
  const data = await customerAccountsFetch(
    CUSTOMER_WISHLIST_QUERY,
    {},
    accessToken
  );
  const metafield = data?.customer?.metafields?.[0];
  if (!metafield?.value) return [];
  try {
    const parsed = JSON.parse(metafield.value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function getCustomerAccountsCustomer(cookies: AstroCookies) {
  let accessToken: string | null | undefined = getCustomerAccountsTokens(cookies).accessToken;
  if (!accessToken) return null;

  try {
    const data = await customerAccountsFetch(
      CUSTOMER_ACCOUNTS_CUSTOMER_QUERY,
      {},
      accessToken
    );
    return normalizeCustomer(data.customer);
  } catch (err: any) {
    const msg = err.message || "";
    if (
      msg.toLowerCase().includes("expired") ||
      msg.toLowerCase().includes("unauthorized") ||
      msg.includes("401")
    ) {
      accessToken = await refreshAccessToken(cookies);
      if (!accessToken) return null;
      const data = await customerAccountsFetch(
        CUSTOMER_ACCOUNTS_CUSTOMER_QUERY,
        {},
        accessToken
      );
      return normalizeCustomer(data.customer);
    }
    console.error("[Customer Accounts] Failed to fetch customer:", err);
    return null;
  }
}
