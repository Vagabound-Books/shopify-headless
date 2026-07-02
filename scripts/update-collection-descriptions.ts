# Update Shopify Collection Descriptions
# Run with: npx tsx scripts/update-collection-descriptions.ts
#
# Requires: SHOPIFY_ADMIN_API_ACCESS_TOKEN with `write_products` scope
# (Current token only has read scope; update in Shopify Partner dashboard.)

import 'dotenv/config';

const SHOPIFY_STORE_DOMAIN = process.env.SHOPIFY_STORE_DOMAIN || '';
const ADMIN_TOKEN = process.env.SHOPIFY_ADMIN_API_ACCESS_TOKEN || '';
const API_VERSION = process.env.SHOPIFY_API_VERSION || '2024-07';
const endpoint = `https://${SHOPIFY_STORE_DOMAIN}/admin/api/${API_VERSION}/graphql.json`;

const COLLECTION_DESCRIPTIONS: Record<string, string> = {
  inventory: `<p>Everything we have, shelved and waiting. This is the full stock of Vagabound—every title that has passed through our hands, been cleaned, sleeved, and described with the same care we give a first edition. You will find doorstops beside chapbooks, dog-eared paperbacks beside clothbound volumes that could stop a bullet. There is no hierarchy here, only the democracy of the shelf. Browse long enough and something will find you. That is the promise of a proper inventory: the right book at the right moment, whether you knew you were looking for it or not.</p>`,

  'big-books': `<p>The heavy ones. The ones that bend shelves and bruise sternums. These are the novels you commit to, the histories that swallow weekends whole, the collections of letters so thick they could serve as doorstops in a drafty house. We respect a book that announces its own weight before you open it. Each of these has earned its heft through ambition, research, or sheer narrative stubbornness. Not for the faint of wrist or the short of attention. For the reader who believes that some stories simply need more room to breathe, more pages to wander, more time to settle into your bones.</p>`,

  'olde-books': `<p>From the last century and beyond. These are the volumes that have already lived full lives before reaching you—foxed pages, cracked hinges, the occasional inscription from a stranger who loved the book enough to mark it. We do not hide their age; we advertise it. Each copy carries the accumulated patina of previous readers, previous rooms, previous decades. For the collector who understands that a book's value is not diminished by time but deepened by it. For the reader who wants to hold something that has outlasted trends, fads, and most of the people who first owned it.</p>`,

  paperbacks: `<p>Books of the trade. The portable, the bendable, the ones you can stuff in a coat pocket and read on a bus, in a park, while waiting for coffee. Do not mistake their lightness for shallowness—these are the same words, the same sentences, the same devastating endings, just bound in paper instead of cloth. We love a paperback for its democratic price and its willingness to travel. For the reader who marks pages with coffee rings, who folds corners without guilt, who believes a book's highest purpose is to be read until it falls apart in your hands.</p>`,

  hardcovers: `<p>Might also be weapons. These are the serious bindings, the cloth and board constructions designed to survive decades of shelving, lending, and rereading. A hardcover makes a statement: this book is staying. The pages are sewn, the spine is reinforced, the jacket—if it survives—becomes a kind of protective armor. We rescue these when we can because they represent the book as object, as artifact, as something worth building to last. For the reader who shelves alphabetically, who dusts, who understands that some books are not merely read but kept.</p>`,
};

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
      'X-Shopify-Access-Token': ADMIN_TOKEN,
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

async function updateCollectionDescriptions() {
  console.log('Fetching collections...\n');

  const collectionsData = await adminFetch({
    query: `query { collections(first: 50) { edges { node { id handle title } } } }`,
  });

  const collections = (collectionsData as any)?.collections?.edges?.map((e: any) => e.node) || [];

  for (const collection of collections) {
    const newDescription = COLLECTION_DESCRIPTIONS[collection.handle];
    if (!newDescription) {
      console.log(`  Skipping ${collection.handle} (no description defined)`);
      continue;
    }

    console.log(`Updating ${collection.handle} (${collection.title})...`);

    const result = await adminFetch({
      query: `mutation collectionUpdate($input: CollectionInput!) {
        collectionUpdate(input: $input) {
          collection { id descriptionHtml }
          userErrors { field message }
        }
      }`,
      variables: {
        input: {
          id: collection.id,
          descriptionHtml: newDescription,
        },
      },
    });

    const updateResult = (result as any)?.collectionUpdate;
    if (updateResult?.userErrors?.length) {
      console.error(`  ERROR:`, updateResult.userErrors.map((e: any) => e.message).join('; '));
    } else {
      console.log(`  OK`);
    }
  }

  console.log('\nDone.');
}

updateCollectionDescriptions().catch((err) => {
  console.error('Failed:', err);
  process.exit(1);
});
