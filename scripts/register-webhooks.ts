import 'dotenv/config';

/**
 * Register Shopify webhooks that keep the collection cache fresh.
 *
 * Creates products/* and collections/* webhook subscriptions pointing at
 * `${PUBLIC_SITE_URL}/api/webhooks/shopify`. Idempotent: existing
 * subscriptions with the same topic + URL are skipped.
 *
 * Requires the Admin API token to have read_webhooks + write_webhooks scopes
 * (Shopify Admin → Develop apps → [app] → Configuration → Admin API access).
 *
 * Usage: npm run register-webhooks
 */

const SHOPIFY_STORE_DOMAIN = process.env.SHOPIFY_STORE_DOMAIN || '';
const SHOPIFY_ADMIN_API_ACCESS_TOKEN = process.env.SHOPIFY_ADMIN_API_ACCESS_TOKEN || '';
const SHOPIFY_API_VERSION = process.env.SHOPIFY_API_VERSION || '2024-07';
const PUBLIC_SITE_URL = (process.env.PUBLIC_SITE_URL || 'https://vagaboundbooks.com').replace(/\/$/, '');

const endpoint = `https://${SHOPIFY_STORE_DOMAIN}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`;
const callbackUrl = `${PUBLIC_SITE_URL}/api/webhooks/shopify/`; // trailing slash required (trailingSlash: 'always')

const TOPICS = [
  'PRODUCTS_CREATE',
  'PRODUCTS_UPDATE',
  'PRODUCTS_DELETE',
  'COLLECTIONS_CREATE',
  'COLLECTIONS_UPDATE',
  'COLLECTIONS_DELETE',
] as const;

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

const LIST_WEBHOOKS = `
  query ListWebhooks {
    webhookSubscriptions(first: 100) {
      edges {
        node {
          id
          topic
          callbackUrl
        }
      }
    }
  }
`;

const CREATE_WEBHOOK = `
  mutation CreateWebhook($topic: WebhookSubscriptionTopic!, $webhookSubscription: WebhookSubscriptionInput!) {
    webhookSubscriptionCreate(topic: $topic, webhookSubscription: $webhookSubscription) {
      webhookSubscription {
        id
        topic
        callbackUrl
      }
      userErrors {
        field
        message
      }
    }
  }
`;

const SCOPE_HINT =
  'Hint: the Admin API token needs read_webhooks + write_webhooks scopes. ' +
  'Add them in Shopify Admin → Develop apps → [your app] → Configuration → Admin API access, ' +
  'then reinstall the app/token and re-run.';

async function main() {
  if (!SHOPIFY_STORE_DOMAIN || !SHOPIFY_ADMIN_API_ACCESS_TOKEN) {
    console.error('Missing SHOPIFY_STORE_DOMAIN or SHOPIFY_ADMIN_API_ACCESS_TOKEN in .env');
    process.exit(1);
  }

  console.log(`Registering webhooks for ${callbackUrl}\n`);

  let existing: { id: string; topic: string; callbackUrl: string }[] = [];
  try {
    const data = await adminFetch({ query: LIST_WEBHOOKS });
    existing = (data?.webhookSubscriptions?.edges || []).map((e: any) => e.node);
  } catch (err: any) {
    console.error(`Failed to list webhook subscriptions: ${err.message}\n${SCOPE_HINT}`);
    process.exit(1);
  }

  let created = 0;
  let skipped = 0;
  let failed = 0;

  for (const topic of TOPICS) {
    const match = existing.find((w) => w.topic === topic);
    if (match) {
      if (match.callbackUrl === callbackUrl) {
        console.log(`  skip   ${topic} (already registered)`);
        skipped++;
      } else {
        console.warn(`  NOTE   ${topic} exists with a different URL: ${match.callbackUrl}`);
        console.warn(`         Leaving it untouched — update manually if it should point here.`);
        skipped++;
      }
      continue;
    }

    try {
      const data = await adminFetch({
        query: CREATE_WEBHOOK,
        variables: { topic, webhookSubscription: { callbackUrl, format: 'JSON' } },
      });
      const result = data?.webhookSubscriptionCreate;
      if (result?.userErrors?.length) {
        console.error(`  FAIL   ${topic}: ${result.userErrors.map((e: any) => e.message).join(', ')}`);
        failed++;
      } else {
        console.log(`  create ${topic} -> ${result.webhookSubscription.callbackUrl}`);
        created++;
      }
    } catch (err: any) {
      console.error(`  FAIL   ${topic}: ${err.message}`);
      failed++;
    }
  }

  console.log(`\nDone: ${created} created, ${skipped} skipped, ${failed} failed.`);
  if (failed > 0) {
    console.error(SCOPE_HINT);
    process.exit(1);
  }
}

main();
