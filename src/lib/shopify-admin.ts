// Server-side helper for the Shopify Admin GraphQL API.
// Uses SHOPIFY_ADMIN_API_ACCESS_TOKEN and the admin GraphQL endpoint.

const ADMIN_API_VERSION = import.meta.env.SHOPIFY_API_VERSION || "2024-07";
const ADMIN_ACCESS_TOKEN = import.meta.env.SHOPIFY_ADMIN_API_ACCESS_TOKEN || "";
const SHOP_DOMAIN =
  import.meta.env.PUBLIC_SHOPIFY_SHOP ||
  import.meta.env.SHOPIFY_STORE_DOMAIN ||
  "";

function getAdminApiUrl(): string {
  const domain = SHOP_DOMAIN.replace(/^https?:\/\//, "").replace(/\/$/, "");
  return `https://${domain}/admin/api/${ADMIN_API_VERSION}/graphql.json`;
}

export async function shopifyAdminFetch<T = any>(
  query: string,
  variables: Record<string, any> = {}
): Promise<T> {
  if (!ADMIN_ACCESS_TOKEN || !SHOP_DOMAIN) {
    throw new Error("Missing Shopify Admin API credentials.");
  }

  const response = await fetch(getAdminApiUrl(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": ADMIN_ACCESS_TOKEN,
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    const body = await response.text();
    console.error(`[Shopify Admin] HTTP ${response.status}: ${body}`);
    throw new Error(`${response.status} ${body}`);
  }

  const json = await response.json();
  if (json.errors) {
    const messages = json.errors.map((e: any) => e.message).join("\n");
    console.error(`[Shopify Admin] GraphQL errors: ${messages}`);
    throw new Error(messages);
  }

  return json.data as T;
}
