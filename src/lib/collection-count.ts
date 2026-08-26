import { shopifyFetchServer } from './shopify';
import { GET_COLLECTION_PRODUCT_COUNT } from './queries';
import { TtlCache } from './ttl-cache';

const CACHE_TTL_MS = (() => {
  const raw = Number(import.meta.env.COLLECTION_CACHE_TTL_SECONDS);
  return Number.isFinite(raw) && raw > 0 ? raw * 1000 : 300_000; // default 5 min
})();

const countCache = new TtlCache<number>(CACHE_TTL_MS);

async function fetchCount(handle: string, buyerIP: string): Promise<number> {
  let count = 0;
  let after: string | null = null;

  do {
    const data: any = await shopifyFetchServer({
      query: GET_COLLECTION_PRODUCT_COUNT,
      variables: { handle, after },
      buyerIP,
    });
    const connection = data?.collection?.products;
    count += connection?.edges?.length || 0;
    after = connection?.pageInfo?.hasNextPage ? connection.pageInfo.endCursor : null;
  } while (after);

  return count;
}

export async function getCollectionProductCount(handle: string, buyerIP: string): Promise<number> {
  return countCache.getOrLoad(`count:${handle}`, () => fetchCount(handle, buyerIP));
}

/** Drop every cached collection count (called by the Shopify webhook). */
export function invalidateCollectionCountCache(): void {
  countCache.clear();
}
