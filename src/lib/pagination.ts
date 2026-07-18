import { shopifyFetchServer } from './shopify';
import { GET_COLLECTION_CURSORS, GET_COLLECTION_BY_HANDLE } from './queries';

export const PAGE_SIZE = 24;

export interface CollectionPage {
  collection: any;
  products: any[];
  page: number;
  totalPages: number;
  totalCount: number;
  rangeStart: number;
  rangeEnd: number;
}

interface PageOptions {
  handle: string;
  page: number;
  buyerIP?: string;
}

/**
 * Numbered pagination over a Shopify collection.
 *
 * The Storefront API is cursor-based and exposes no product count, so we first
 * fetch a lightweight "cursor map" (cursors only, 250 per request, looping past
 * that if needed). That yields the total count and the `after` cursor for any
 * page boundary — letting us jump straight to any numbered page while only ever
 * fetching PAGE_SIZE full products.
 *
 * Out-of-range or invalid page numbers are clamped into range.
 * Returns null if the collection is missing or a fetch fails (caller 404s).
 */
export async function getCollectionPage({ handle, page, buyerIP = '' }: PageOptions): Promise<CollectionPage | null> {
  // 1. Cursor map (+ collection meta).
  const cursors: string[] = [];
  let collection: any = null;
  let after: string | null = null;

  try {
    do {
      const data: any = await shopifyFetchServer({
        query: GET_COLLECTION_CURSORS,
        variables: { handle, after },
        buyerIP,
      });
      if (!data?.collection) return null;
      collection = data.collection;
      const connection = data.collection.products;
      for (const edge of connection?.edges || []) cursors.push(edge.cursor);
      after = connection?.pageInfo?.hasNextPage ? connection.pageInfo.endCursor : null;
    } while (after);
  } catch (err) {
    console.error('[Shopify] Failed to fetch collection cursors:', err);
    return null;
  }

  // 2. Page math + clamping.
  const totalCount = cursors.length;
  const totalPages = totalCount === 0 ? 0 : Math.ceil(totalCount / PAGE_SIZE);
  let clamped = Number.isFinite(page) ? Math.floor(page) : 1;
  if (clamped < 1) clamped = 1;
  if (totalPages > 0 && clamped > totalPages) clamped = totalPages;

  // 3. Fetch just this page's products.
  const pageAfter = clamped > 1 ? cursors[(clamped - 1) * PAGE_SIZE - 1] : null;
  const data = await shopifyFetchServer({
    query: GET_COLLECTION_BY_HANDLE,
    variables: { handle, first: PAGE_SIZE, after: pageAfter },
    buyerIP,
  }).catch((err) => {
    console.error('[Shopify] Failed to fetch collection page:', err);
    return null;
  });

  if (!data?.collection) return null;

  return {
    collection,
    products: (data.collection.products?.edges || []).map((e: any) => e.node),
    page: clamped,
    totalPages,
    totalCount,
    rangeStart: totalCount === 0 ? 0 : (clamped - 1) * PAGE_SIZE + 1,
    rangeEnd: Math.min(clamped * PAGE_SIZE, totalCount),
  };
}
