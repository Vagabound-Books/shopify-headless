/**
 * Server-side Shopify Admin API helpers.
 *
 * These are intentionally separate from the Storefront API client because
 * Admin API calls require the private admin access token and should only run
 * on the server.
 */

const SHOPIFY_ADMIN_ACCESS_TOKEN = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;
const SHOPIFY_STORE_DOMAIN = process.env.SHOPIFY_STORE_DOMAIN;
const SHOPIFY_API_VERSION = process.env.SHOPIFY_API_VERSION || '2024-07';

const CUSTOMER_BY_IDENTIFIER_QUERY = `
  query CustomerByIdentifier($identifier: CustomerIdentifierInput!) {
    customer: customerByIdentifier(identifier: $identifier) {
      id
    }
  }
`;

function getAdminEndpoint(): string | undefined {
  if (!SHOPIFY_STORE_DOMAIN) return undefined;
  return `https://${SHOPIFY_STORE_DOMAIN}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`;
}

export interface CustomerIdentifierInput {
  emailAddress?: string;
  phoneNumber?: string;
  customId?: {
    namespace: string;
    key: string;
    value: string;
  };
}

export async function getCustomerIdByIdentifier(
  identifier: CustomerIdentifierInput,
): Promise<string | undefined> {
  if (!SHOPIFY_ADMIN_ACCESS_TOKEN) {
    console.warn('[Shopify Admin] SHOPIFY_ADMIN_ACCESS_TOKEN is not set.');
    return undefined;
  }

  const endpoint = getAdminEndpoint();
  if (!endpoint) {
    console.warn('[Shopify Admin] SHOPIFY_STORE_DOMAIN is not set.');
    return undefined;
  }

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': SHOPIFY_ADMIN_ACCESS_TOKEN,
      },
      body: JSON.stringify({
        query: CUSTOMER_BY_IDENTIFIER_QUERY,
        variables: { identifier },
      }),
    });

    if (!response.ok) {
      console.error(`[Shopify Admin] HTTP ${response.status}`);
      return undefined;
    }

    const json = (await response.json()) as {
      data?: { customer?: { id?: string } };
      errors?: Array<{ message: string }>;
    };

    if (json.errors?.length) {
      console.error('[Shopify Admin] GraphQL errors:', json.errors.map((e) => e.message).join('; '));
      return undefined;
    }

    return json.data?.customer?.id;
  } catch (err) {
    console.error('[Shopify Admin] Failed to fetch customer by identifier:', err);
    return undefined;
  }
}

export async function getCustomerIdByEmail(email: string): Promise<string | undefined> {
  return getCustomerIdByIdentifier({ emailAddress: email });
}
