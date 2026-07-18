import { shopifyFetchServer } from './shopify';
import { GET_SIMILAR_PRODUCTS } from './queries';

/** Collection handles that are too broad to signal similarity. */
const SKIP_COLLECTIONS = new Set(['all', 'new-arrivals', 'featured']);

const TARGET_COUNT = 4;

interface SimilarOptions {
  productId: string;
  handle: string;
  buyerIP?: string;
}

function isAvailable(product: any): boolean {
  // Prefer the product-level flag; fall back to checking variants.
  if (typeof product?.availableForSale === 'boolean') return product.availableForSale;
  return (product?.variants?.edges || []).some((e: any) => e.node?.availableForSale);
}

/**
 * Fetch up to TARGET_COUNT similar products for a PDP:
 * Shopify's native productRecommendations first, topped up from the
 * product's own collections (excluding catch-all shelves). Deduped by id,
 * current product and unavailable items excluded.
 *
 * Never throws — returns [] on any failure so the PDP always renders.
 */
export async function getSimilarProducts({ productId, handle, buyerIP = '' }: SimilarOptions): Promise<any[]> {
  const data = await shopifyFetchServer({
    query: GET_SIMILAR_PRODUCTS,
    variables: { productId, handle },
    buyerIP,
  }).catch((err) => {
    console.error('[Shopify] Failed to fetch similar products:', err);
    return null;
  });

  if (!data) return [];

  const recommended: any[] = Array.isArray(data.recommended) ? data.recommended : [];
  const collections = (data.product?.collections?.edges || []).map((e: any) => e.node);

  const seen = new Set<string>([productId]);
  const picked: any[] = [];

  const tryAdd = (product: any) => {
    if (picked.length >= TARGET_COUNT) return;
    if (!product || seen.has(product.id) || !isAvailable(product)) return;
    seen.add(product.id);
    picked.push(product);
  };

  // 1. Native algorithmic recommendations.
  recommended.forEach(tryAdd);

  // 2. Top up from the first collection that signals similarity.
  if (picked.length < TARGET_COUNT) {
    const shelf = collections.find((c: any) => c && !SKIP_COLLECTIONS.has(c.handle));
    const shelfProducts = (shelf?.products?.edges || []).map((e: any) => e.node);
    shelfProducts.forEach(tryAdd);
  }

  return picked;
}
