import { createHash, randomBytes } from "crypto";
import type { AstroCookies } from "astro";
import { CUSTOMER_ACCOUNTS_CUSTOMER_QUERY } from "./queries";

const CLIENT_ID = import.meta.env.CUSTOMER_ACCOUNTS_CLIENT_ID || "";
const CLIENT_SECRET = import.meta.env.CUSTOMER_ACCOUNTS_CLIENT_SECRET || "";
const SHOP_ID = import.meta.env.SHOPIFY_SHOP_ID || "";
const API_VERSION = import.meta.env.SHOPIFY_API_VERSION || "2024-07";
const SITE_URL = import.meta.env.PUBLIC_SITE_URL || "";
const REDIRECT_URI =
  import.meta.env.CUSTOMER_ACCOUNTS_REDIRECT_URI ||
  (SITE_URL ? `${SITE_URL}/account/callback` : "/account/callback");

// Cookie names
const CA_ACCESS_TOKEN = "ca_access_token";
const CA_REFRESH_TOKEN = "ca_refresh_token";
const CA_STATE = "ca_state";
const CA_NONCE = "ca_nonce";
const CA_CODE_VERIFIER = "ca_code_verifier";

function base64URLEncode(buffer: Buffer): string {
  return buffer
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
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

export function isCustomerAccountsEnabled(): boolean {
  return Boolean(CLIENT_ID && CLIENT_SECRET && SHOP_ID);
}

export function buildAuthorizeUrl(cookies: AstroCookies): string {
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
    scope: "openid email profile customer-account-api:full",
    state,
    nonce,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });

  return `https://shopify.com/${SHOP_ID}/account/oauth/authorize?${params.toString()}`;
}

export async function exchangeCodeForTokens(
  code: string,
  state: string,
  cookies: AstroCookies
) {
  const storedState = cookies.get(CA_STATE)?.value;
  const codeVerifier = cookies.get(CA_CODE_VERIFIER)?.value;

  // Clear handshake cookies
  cookies.delete(CA_STATE, { path: "/" });
  cookies.delete(CA_NONCE, { path: "/" });
  cookies.delete(CA_CODE_VERIFIER, { path: "/" });

  if (!storedState || storedState !== state) {
    throw new Error("Invalid state parameter");
  }
  if (!codeVerifier) {
    throw new Error("Missing code verifier");
  }

  const tokenUrl = `https://shopify.com/${SHOP_ID}/account/oauth/token`;

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    code,
    redirect_uri: REDIRECT_URI,
    code_verifier: codeVerifier,
  });

  const res = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token exchange failed: ${res.status} ${text}`);
  }

  const data = await res.json();
  setCustomerAccountsTokens(cookies, data.access_token, data.refresh_token);
  return data;
}

export function setCustomerAccountsTokens(
  cookies: AstroCookies,
  accessToken: string,
  refreshToken?: string
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
}

export function getCustomerAccountsTokens(cookies: AstroCookies) {
  return {
    accessToken: cookies.get(CA_ACCESS_TOKEN)?.value,
    refreshToken: cookies.get(CA_REFRESH_TOKEN)?.value,
  };
}

export function deleteCustomerAccountsTokens(cookies: AstroCookies) {
  cookies.delete(CA_ACCESS_TOKEN, { path: "/" });
  cookies.delete(CA_REFRESH_TOKEN, { path: "/" });
}

export async function refreshAccessToken(cookies: AstroCookies): Promise<string | null> {
  const { refreshToken } = getCustomerAccountsTokens(cookies);
  if (!refreshToken) return null;

  const tokenUrl = `https://shopify.com/${SHOP_ID}/account/oauth/token`;

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    refresh_token: refreshToken,
  });

  const res = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
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

const CA_API_URL = `https://shopify.com/${SHOP_ID}/account/api/${API_VERSION}/graphql`;

export async function customerAccountsFetch<T = any>(
  query: string,
  variables: Record<string, any> = {},
  accessToken: string
): Promise<T> {
  const res = await fetch(CA_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
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

export async function getCustomerAccountsCustomer(cookies: AstroCookies) {
  let { accessToken } = getCustomerAccountsTokens(cookies);
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
