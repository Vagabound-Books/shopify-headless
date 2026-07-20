import 'dotenv/config';
import { getAdminToken } from './lib/admin-token';

/**
 * Create the "free shipping on N+ items" automatic discount.
 *
 * Idempotent: if an automatic free-shipping discount with the same title
 * already exists, it is left untouched.
 *
 * Requires the Admin API token to have read_discounts + write_discounts scopes.
 * The Admin token in .env belongs to the Headless sales channel — manage its
 * scopes in Shopify Admin → Sales channels → Headless → Admin API access.
 *
 * Usage: npm run setup:free-shipping
 */

const SHOPIFY_STORE_DOMAIN = process.env.SHOPIFY_STORE_DOMAIN || '';
const SHOPIFY_API_VERSION = process.env.SHOPIFY_API_VERSION || '2024-07';

let SHOPIFY_ADMIN_API_ACCESS_TOKEN = '';

const THRESHOLD = process.env.PUBLIC_FREE_SHIPPING_THRESHOLD || '3';
const MAX_RATE = process.env.FREE_SHIPPING_MAX_RATE || ''; // '' = no cap
const TITLE = `Free shipping — ${THRESHOLD}+ books`;

const endpoint = `https://${SHOPIFY_STORE_DOMAIN}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`;

async function adminFetch<T = any>({
  query,
  variables = {},
}: {
  query: string;
  variables?: Record<string, any>;
}): Promise<T> {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': SHOPIFY_ADMIN_API_ACCESS_TOKEN,
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    throw new Error(`Admin API error: ${response.status} ${response.statusText}`);
  }

  const json = await response.json();
  if (json.errors) {
    throw new Error(`Admin GraphQL errors: ${JSON.stringify(json.errors)}`);
  }
  return json.data as T;
}

const LIST_FREE_SHIPPING = `
  query ListFreeShippingDiscounts {
    discountNodes(first: 50) {
      edges {
        node {
          id
          discount {
            ... on DiscountAutomaticFreeShipping {
              title
            }
          }
        }
      }
    }
  }
`;

const CREATE_FREE_SHIPPING = `
  mutation CreateFreeShippingDiscount($input: DiscountAutomaticFreeShippingInput!) {
    discountAutomaticFreeShippingCreate(freeShippingAutomaticDiscount: $input) {
      automaticDiscountNode {
        id
        automaticDiscount {
          ... on DiscountAutomaticFreeShipping {
            title
            minimumRequirement {
              ... on DiscountMinimumQuantity {
                greaterThanOrEqualToQuantity
              }
            }
          }
        }
      }
      userErrors {
        field
        message
      }
    }
  }
`;

const SCOPE_HINT =
  'Hint: the Admin API token needs read_discounts + write_discounts scopes. ' +
  'Enable them on the app that issued the token: Shopify Admin → Develop apps → ' +
  '[your app] → Configuration → Admin API integration → Edit → check both scopes → ' +
  'Save → Reinstall app → paste the NEW token into SHOPIFY_DISCOUNT_ADMIN_TOKEN, then re-run.';

async function main() {
  if (!SHOPIFY_STORE_DOMAIN) {
    console.error('Missing SHOPIFY_STORE_DOMAIN in .env');
    process.exit(1);
  }

  try {
    SHOPIFY_ADMIN_API_ACCESS_TOKEN = await getAdminToken(SHOPIFY_STORE_DOMAIN);
  } catch (err: any) {
    console.error(err.message);
    process.exit(1);
  }

  console.log(`Discount: "${TITLE}" (minimum ${THRESHOLD} items` +
    (MAX_RATE ? `, rates up to ${MAX_RATE}` : ', all shipping rates') + ')\n');

  let existing: { id: string; title?: string }[] = [];
  try {
    const data = await adminFetch({ query: LIST_FREE_SHIPPING });
    existing = (data?.discountNodes?.edges || [])
      .map((e: any) => e.node)
      .filter((n: any) => n?.discount?.title);
  } catch (err: any) {
    console.error(`Failed to list discounts: ${err.message}\n${SCOPE_HINT}`);
    process.exit(1);
  }

  const found = existing.find((n: any) => n.discount.title === TITLE);
  if (found) {
    console.log(`Already exists: "${TITLE}" (${found.id}) — nothing to do.`);
    return;
  }

  const input: Record<string, any> = {
    title: TITLE,
    startsAt: new Date().toISOString(),
    minimumRequirement: {
      quantity: { greaterThanOrEqualToQuantity: THRESHOLD },
    },
    destination: { all: true },
  };
  if (MAX_RATE) input.maximumShippingPrice = MAX_RATE;

  try {
    const data = await adminFetch({
      query: CREATE_FREE_SHIPPING,
      variables: { input },
    });
    const result = data?.discountAutomaticFreeShippingCreate;
    if (result?.userErrors?.length) {
      console.error(`Failed: ${result.userErrors.map((e: any) => e.message).join(', ')}\n${SCOPE_HINT}`);
      process.exit(1);
    }
    const node = result.automaticDiscountNode;
    const numericId = node.id.split('/').pop();
    const storeSlug = SHOPIFY_STORE_DOMAIN.replace(/\.myshopify\.com$/, '');
    console.log(`Created: "${TITLE}"`);
    console.log(`Manage it: https://admin.shopify.com/store/${storeSlug}/discounts/${numericId}`);
  } catch (err: any) {
    console.error(`Failed to create discount: ${err.message}\n${SCOPE_HINT}`);
    process.exit(1);
  }
}

main();
