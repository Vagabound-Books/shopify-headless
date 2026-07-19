import { shopifyFetchServer } from './shopify';
import { GET_COLLECTION_PRODUCTS_LIGHT, GET_PRODUCTS_BY_IDS } from './queries';
import { getMetafield } from './metafields';
import { TtlCache } from './ttl-cache';

export const PAGE_SIZE = 24;

export const SORT_OPTIONS = [
  { value: 'featured',    label: 'Featured' },
  { value: 'title-asc',   label: 'Title A–Z' },
  { value: 'title-desc',  label: 'Title Z–A' },
  { value: 'author-asc',  label: 'Author A–Z' },
  { value: 'author-desc', label: 'Author Z–A' },
  { value: 'price-asc',   label: 'Price low → high' },
  { value: 'price-desc',  label: 'Price high → low' },
] as const;

export type SortKey = (typeof SORT_OPTIONS)[number]['value'];

const SORT_KEYS = new Set<string>(SORT_OPTIONS.map((o) => o.value));

export function parseSort(raw: string | null): SortKey {
  return raw && SORT_KEYS.has(raw) ? (raw as SortKey) : 'featured';
}

export interface CollectionPage {
  collection: any;
  products: any[];
  page: number;
  totalPages: number;
  totalCount: number;
  rangeStart: number;
  rangeEnd: number;
  sort: SortKey;
}

interface PageOptions {
  handle: string;
  page: number;
  sort?: SortKey;
  buyerIP?: string;
}

/* ---------- sort key extraction ---------- */

/** First author's surname (last name token), library-style. Falls back to vendor. */
function authorKey(product: any): string {
  const authors = getMetafield(product.metafields, 'authors');
  const first = Array.isArray(authors) ? authors[0] : authors;
  const name = (typeof first === 'string' && first.trim()) || product.vendor || '';
  const tokens = name.trim().split(/\s+/);
  return tokens[tokens.length - 1] || '';
}

function priceKey(product: any): number | null {
  const raw = product.priceRange?.minVariantPrice?.amount;
  if (raw == null) return null;
  const n = parseFloat(raw);
  return Number.isFinite(n) ? n : null;
}

/** In-place stable sort; missing keys always sink to the bottom. */
function sortProducts(products: any[], sort: SortKey): any[] {
  if (sort === 'featured') return products;

  const dir = sort.endsWith('-desc') ? -1 : 1;
  const kind = sort.split('-')[0];
  const collator = new Intl.Collator('en', { sensitivity: 'base' });

  const keyOf = (p: any): string | number | null => {
    if (kind === 'title') return p.title || '';
    if (kind === 'author') return authorKey(p) || null;
    return priceKey(p);
  };

  return products.sort((a, b) => {
    const ka = keyOf(a);
    const kb = keyOf(b);
    if (ka == null && kb == null) return collator.compare(a.title || '', b.title || '');
    if (ka == null) return 1;
    if (kb == null) return -1;
    const cmp = typeof ka === 'number' && typeof kb === 'number'
      ? ka - kb
      : collator.compare(String(ka), String(kb));
    return cmp !== 0 ? cmp * dir : collator.compare(a.title || '', b.title || '');
  });
}

/* ---------- light-list cache ---------- */

/** Thrown when the collection genuinely does not exist (never cached). */
class CollectionNotFoundError extends Error {}

interface LightCollection {
  collection: any;
  products: any[];
}

const CACHE_TTL_MS = (() => {
  const raw = Number(import.meta.env.COLLECTION_CACHE_TTL_SECONDS);
  return Number.isFinite(raw) && raw > 0 ? raw * 1000 : 300_000; // default 5 min
})();

const lightCache = new TtlCache<LightCollection>(CACHE_TTL_MS);

/** Drop every cached collection light-list (called by the Shopify webhook). */
export function invalidateCollectionCache(): void {
  lightCache.clear();
}


/** Fetch every product's light record (250 per request, looping). Throws on failure. */
async function fetchLightCollection(handle: string, buyerIP: string): Promise<LightCollection> {
  const products: any[] = [];
  let collection: any = null;
  let after: string | null = null;

  do {
    const data: any = await shopifyFetchServer({
      query: GET_COLLECTION_PRODUCTS_LIGHT,
      variables: { handle, after },
      buyerIP,
    });
    if (!data?.collection) throw new CollectionNotFoundError(handle);
    collection = data.collection;
    const connection = data.collection.products;
    for (const edge of connection?.edges || []) products.push(edge.node);
    after = connection?.pageInfo?.hasNextPage ? connection.pageInfo.endCursor : null;
  } while (after);

  return { collection, products };
}

/* ---------- main ---------- */

/**
 * Numbered, sortable pagination over a Shopify collection.
 *
 * The Storefront API can't sort collections by metafields (authors) and exposes
 * no product count, so we fetch a lightweight list of every product (id, title,
 * price, authors — 250 per request, looping), sort server-side, then fetch only
 * the current page's full products via nodes(). Out-of-range pages are clamped.
 *
 * Returns null if the collection is missing or a fetch fails (caller 404s).
 */
export async function getCollectionPage({ handle, page, sort = 'featured', buyerIP = '' }: PageOptions): Promise<CollectionPage | null> {
  // 1. Light list of every product in the collection (cached per handle).
  let light: LightCollection;
  try {
    light = await lightCache.getOrLoad(handle, () => fetchLightCollection(handle, buyerIP));
  } catch (err) {
    if (!(err instanceof CollectionNotFoundError)) {
      console.error('[Shopify] Failed to fetch collection products:', err);
    }
    return null;
  }
  const { collection } = light;

  // 2. Sort + page math (clamped). Copy first: sortProducts works in place
  //    and the cached array must keep its original (featured) order.
  const sorted = sortProducts([...light.products], sort);
  const totalCount = sorted.length;
  const totalPages = totalCount === 0 ? 0 : Math.ceil(totalCount / PAGE_SIZE);
  let clamped = Number.isFinite(page) ? Math.floor(page) : 1;
  if (clamped < 1) clamped = 1;
  if (totalPages > 0 && clamped > totalPages) clamped = totalPages;

  // 3. Fetch full data for just this page's products.
  const pageItems = sorted.slice((clamped - 1) * PAGE_SIZE, clamped * PAGE_SIZE);
  let products: any[] = [];

  if (pageItems.length > 0) {
    const data = await shopifyFetchServer({
      query: GET_PRODUCTS_BY_IDS,
      variables: { ids: pageItems.map((p) => p.id) },
      buyerIP,
    }).catch((err) => {
      console.error('[Shopify] Failed to fetch collection page products:', err);
      return null;
    });
    if (!data?.nodes) return null;

    // nodes() does not guarantee order — restore the sorted order.
    const byId = new Map<string, any>();
    for (const node of data.nodes) if (node) byId.set(node.id, node);
    products = pageItems.map((p) => byId.get(p.id)).filter(Boolean);
  }

  return {
    collection,
    products,
    page: clamped,
    totalPages,
    totalCount,
    rangeStart: totalCount === 0 ? 0 : (clamped - 1) * PAGE_SIZE + 1,
    rangeEnd: (clamped - 1) * PAGE_SIZE + products.length,
    sort,
  };
}
