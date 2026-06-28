import 'dotenv/config';

const SHOPIFY_STORE_DOMAIN = process.env.SHOPIFY_STORE_DOMAIN || '';
const SHOPIFY_ADMIN_API_ACCESS_TOKEN = process.env.SHOPIFY_ADMIN_API_ACCESS_TOKEN || '';
const SHOPIFY_API_VERSION = process.env.SHOPIFY_API_VERSION || '2024-07';

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

const GET_PRODUCTS_WITH_METAFIELDS = `
  query GetProducts($first: Int!, $after: String) {
    products(first: $first, after: $after) {
      pageInfo { hasNextPage endCursor }
      edges {
        node {
          id
          handle
          metafields(first: 20, namespace: "app-ibp-book") {
            edges {
              node {
                id
                namespace
                key
                value
                type
              }
            }
          }
        }
      }
    }
  }
`;

const CREATE_METAFIELD_DEFINITION = `
  mutation CreateMetafieldDefinition($definition: MetafieldDefinitionInput!) {
    metafieldDefinitionCreate(definition: $definition) {
      createdDefinition { id name namespace key }
      userErrors { field message }
    }
  }
`;

const SET_METAFIELD = `
  mutation MetafieldsSet($metafields: [MetafieldsSetInput!]!) {
    metafieldsSet(metafields: $metafields) {
      metafields { id namespace key value }
      userErrors { field message }
    }
  }
`;

// Define the metafields we want to migrate
const METAFIELD_MAP = [
  { key: 'cover_palette', type: 'single_line_text_field' },
  { key: 'genre', type: 'single_line_text_field' },
  { key: 'authors', type: 'list.single_line_text_field' },
  { key: 'publisher', type: 'single_line_text_field' },
  { key: 'year', type: 'single_line_text_field' },
  { key: 'binding', type: 'single_line_text_field' },
  { key: 'pages', type: 'single_line_text_field' },
  { key: 'provenance', type: 'multi_line_text_field' },
];

async function ensureMetafieldDefinitions() {
  console.log('Ensuring metafield definitions exist in custom namespace...');

  for (const mf of METAFIELD_MAP) {
    const result = await adminFetch({
      query: CREATE_METAFIELD_DEFINITION,
      variables: {
        definition: {
          name: mf.key.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()),
          namespace: 'custom',
          key: mf.key,
          type: mf.type,
          ownerType: 'PRODUCT',
          access: {
            storefront: 'PUBLIC_READ',
          },
        },
      },
    });

    const errors = result?.metafieldDefinitionCreate?.userErrors;
    if (errors?.length) {
      // If the error is that it already exists, that's fine
      const alreadyExists = errors.some((e: any) =>
        e.message.includes('already exists') || e.message.includes('taken')
      );
      if (alreadyExists) {
        console.log(`  Definition ${mf.key} already exists`);
      } else {
        console.error(`  Error creating ${mf.key}:`, errors);
      }
    } else {
      console.log(`  Created definition ${mf.key}`);
    }
  }
}

async function migrateMetafields() {
  console.log('Starting metafield migration...\n');

  await ensureMetafieldDefinitions();
  console.log('');

  let hasNextPage = true;
  let after: string | null = null;
  let totalMigrated = 0;
  let totalProducts = 0;

  while (hasNextPage) {
    const data = await adminFetch({
      query: GET_PRODUCTS_WITH_METAFIELDS,
      variables: { first: 50, after },
    });

    const products = data?.products?.edges || [];
    hasNextPage = data?.products?.pageInfo?.hasNextPage;
    after = data?.products?.pageInfo?.endCursor;

    for (const edge of products) {
      const product = edge.node;
      const oldMetafields = product.metafields?.edges?.map((e: any) => e.node) || [];

      if (oldMetafields.length === 0) continue;

      totalProducts++;
      const metafieldsToSet = [];

      for (const oldMf of oldMetafields) {
        const mapped = METAFIELD_MAP.find((m) => m.key === oldMf.key);
        if (!mapped) continue;

        metafieldsToSet.push({
          ownerId: product.id,
          namespace: 'custom',
          key: oldMf.key,
          type: mapped.type,
          value: oldMf.value,
        });
      }

      if (metafieldsToSet.length > 0) {
        const result = await adminFetch({
          query: SET_METAFIELD,
          variables: { metafields: metafieldsToSet },
        });

        const errors = result?.metafieldsSet?.userErrors;
        if (errors?.length) {
          console.error(`  Error migrating ${product.handle}:`, errors);
        } else {
          console.log(`  Migrated ${metafieldsToSet.length} metafields for ${product.handle}`);
          totalMigrated += metafieldsToSet.length;
        }
      }
    }

    console.log(`  Processed batch, ${hasNextPage ? 'loading more...' : 'done.'}`);
  }

  console.log(`\nMigration complete!`);
  console.log(`  Products processed: ${totalProducts}`);
  console.log(`  Metafields migrated: ${totalMigrated}`);
}

migrateMetafields().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
