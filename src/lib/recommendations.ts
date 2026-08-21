import { shopifyFetchServer } from './shopify';
import { GET_SIMILAR_PRODUCTS, SEARCH_PRODUCTS } from './queries';

/** Tags that are too generic to signal similarity. */
const SKIP_TAGS = new Set(['book', 'books', 'in-stock', 'featured', 'new-arrival', 'new-arrivals', 'all']);

/** Collection handles that are too broad to signal similarity. */
const SKIP_COLLECTIONS = new Set(['all', 'new-arrivals', 'featured']);

const TARGET_COUNT = 4;
const MAX_SEARCH_TAGS = 3;
const SEARCH_LIMIT = 50;
const POOL_MULTIPLIER = 3;

interface SimilarOptions {
  productId: string;
  handle: string;
  buyerIP?: string;
}

interface MetafieldMap {
  genre?: string;
  authors?: string;
  publisher?: string;
  publication_year?: string;
}

interface SourceContext {
  id: string;
  meta: MetafieldMap;
  usefulTags: string[];
  collectionHandles: string[];
  recommendedIds: Set<string>;
}

function parseMetafields(metafields: any[]): MetafieldMap {
  const result: MetafieldMap = {};
  for (const m of metafields || []) {
    if (m?.key && m?.value) {
      result[m.key as keyof MetafieldMap] = m.value;
    }
  }
  return result;
}

function isAvailable(product: any): boolean {
  if (typeof product?.availableForSale === 'boolean') return product.availableForSale;
  return (product?.variants?.edges || []).some((e: any) => e.node?.availableForSale);
}

function normalize(value: any): string {
  return String(value || '').toLowerCase().trim();
}

function parseYear(value?: string): number | null {
  if (!value) return null;
  const match = String(value).match(/\d{4}/);
  return match ? parseInt(match[0], 10) : null;
}

function usefulTags(tags: string[] | undefined): string[] {
  return (tags || [])
    .map((t) => String(t).trim())
    .filter((t) => t && !SKIP_TAGS.has(t.toLowerCase()));
}

function getCollectionHandles(product: any): string[] {
  return (product?.collections?.edges || [])
    .map((e: any) => e.node?.handle)
    .filter(Boolean);
}

function sharedCount(a: string[], b: string[]): number {
  const setB = new Set(b);
  return a.filter((x) => setB.has(x)).length;
}

function quoteTag(tag: string): string {
  const escaped = tag.replace(/\\/g, '\\').replace(/"/g, '\\"');
  return `tag:"${escaped}"`;
}

function scoreCandidate(candidate: any, source: SourceContext): number {
  const candidateMeta = parseMetafields(candidate.metafields);
  const candidateTags = usefulTags(candidate.tags);
  const candidateCollections = getCollectionHandles(candidate);

  let score = 0;

  // Same author(s) — strongest signal for books.
  if (source.meta.authors && candidateMeta.authors) {
    const sourceAuthors = source.meta.authors
      .split(',')
      .map(normalize)
      .filter(Boolean);
    const candidateAuthors = candidateMeta.authors
      .split(',')
      .map(normalize)
      .filter(Boolean);
    if (sourceAuthors.some((a) => candidateAuthors.includes(a))) {
      score += 100;
    }
  }

  // Same genre.
  if (source.meta.genre && candidateMeta.genre) {
    if (normalize(source.meta.genre) === normalize(candidateMeta.genre)) {
      score += 40;
    }
  }

  // Shared useful tags (mix of genres, subjects, etc.).
  const sharedTags = sharedCount(source.usefulTags, candidateTags);
  score += sharedTags * 30;

  // Same publisher.
  if (source.meta.publisher && candidateMeta.publisher) {
    if (normalize(source.meta.publisher) === normalize(candidateMeta.publisher)) {
      score += 25;
    }
  }

  // Shopify algorithmic recommendation.
  if (source.recommendedIds.has(candidate.id)) {
    score += 20;
  }

  // Published within the same decade.
  const sourceYear = parseYear(source.meta.publication_year);
  const candidateYear = parseYear(candidateMeta.publication_year);
  if (sourceYear && candidateYear && Math.abs(sourceYear - candidateYear) <= 10) {
    score += 15;
  }

  // Shared collections.
  const sharedCollections = sharedCount(source.collectionHandles, candidateCollections);
  score += sharedCollections * 5;

  return score;
}

/**
 * Fetch up to TARGET_COUNT similar products for a PDP.
 *
 * Strategy:
 * 1. Shopify's native productRecommendations.
 * 2. Products from the same specific collections.
 * 3. Storefront search for products sharing the current book's most useful tags.
 *
 * Candidates are scored using book metadata (author, genre, publisher, year),
 * tag overlap, collections, and Shopify's recommendations. The top TARGET_COUNT
 * available, deduplicated products are returned.
 *
 * Never throws — returns [] on any failure so the PDP always renders.
 */
export async function getSimilarProducts({
  productId,
  handle,
  buyerIP = '',
}: SimilarOptions): Promise<any[]> {
  const data = await shopifyFetchServer({
    query: GET_SIMILAR_PRODUCTS,
    variables: { productId, handle },
    buyerIP,
  }).catch((err) => {
    console.error('[Shopify] Failed to fetch similar products:', err);
    return null;
  });

  if (!data?.product) return [];

  const sourceProduct = data.product;
  const source: SourceContext = {
    id: productId,
    meta: parseMetafields(sourceProduct.metafields),
    usefulTags: usefulTags(sourceProduct.tags),
    collectionHandles: getCollectionHandles(sourceProduct),
    recommendedIds: new Set((data.recommended || []).map((p: any) => p.id)),
  };

  const seen = new Set<string>([productId]);
  const candidates: any[] = [];
  const minPool = TARGET_COUNT * POOL_MULTIPLIER;

  const addCandidate = (product: any) => {
    if (!product || seen.has(product.id) || !isAvailable(product)) return;
    seen.add(product.id);
    candidates.push(product);
  };

  // 1. Native algorithmic recommendations.
  (data.recommended || []).forEach(addCandidate);

  // 2. Top up from specific collections.
  if (candidates.length < minPool) {
    const shelves = (sourceProduct.collections?.edges || [])
      .map((e: any) => e.node)
      .filter((c: any) => c && !SKIP_COLLECTIONS.has(c.handle));

    for (const shelf of shelves) {
      if (candidates.length >= minPool) break;
      (shelf.products?.edges || []).forEach((e: any) => addCandidate(e.node));
    }
  }

  // 3. Search by useful tags for a wider, scalable candidate pool.
  if (source.usefulTags.length > 0 && candidates.length < minPool) {
    const searchTags = source.usefulTags.slice(0, MAX_SEARCH_TAGS);
    const query = searchTags.map(quoteTag).join(' OR ');

    const searchData = await shopifyFetchServer({
      query: SEARCH_PRODUCTS,
      variables: { query, first: SEARCH_LIMIT, after: null },
      buyerIP,
    }).catch((err) => {
      console.error('[Shopify] Tag search failed:', err);
      return null;
    });

    if (searchData?.search?.edges) {
      searchData.search.edges.forEach((e: any) => addCandidate(e.node));
    }
  }

  if (candidates.length === 0) return [];

  // Score, sort, and return the most relevant available products.
  const scored = candidates
    .map((product) => ({ product, score: scoreCandidate(product, source) }))
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, TARGET_COUNT).map((s) => s.product);
}
