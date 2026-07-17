import { useState, useEffect } from 'preact/hooks';
import { getShelf, removeFromShelf, syncShelfToCloud, mergeShelfItems, type ShelfItem } from '../lib/shelf';
import { parseMetafields } from '../lib/metafields';

interface Props {
  cloudItems?: ShelfItem[];
  isAuthenticated?: boolean;
}

interface ProductLike {
  handle: string;
  title: string;
  vendor?: string;
  featuredImage?: { url: string; altText?: string } | null;
  priceRange?: {
    minVariantPrice?: { amount: string; currencyCode: string } | null;
  };
  compareAtPriceRange?: {
    minVariantPrice?: { amount: string; currencyCode: string } | null;
  };
  variants?: {
    edges?: { node: { id: string; price?: { amount: string; currencyCode: string } | null; compareAtPrice?: { amount: string; currencyCode: string } | null } } }[];
  metafields?: any[];
}

function formatMoney(amount?: string, currencyCode?: string): string {
  if (!amount || !currencyCode) return '';
  const value = parseFloat(amount);
  if (isNaN(value)) return '';
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: currencyCode,
  }).format(value);
}

function buildProductsMap(products: ProductLike[]): Record<string, ProductLike> {
  const map: Record<string, ProductLike> = {};
  for (const product of products) {
    if (product?.handle) {
      map[product.handle] = product;
    }
  }
  return map;
}

async function fetchProductsByHandles(handles: string[]): Promise<ProductLike[]> {
  if (handles.length === 0) return [];
  console.log('[ShelfPage] Fetching products for handles:', handles);
  const res = await fetch('/api/shelf/products/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ handles }),
  });
  const data = await res.json();
  if (!res.ok) {
    console.error('[ShelfPage] Product fetch failed:', data);
    throw new Error(data?.error || 'Failed to fetch products');
  }
  console.log('[ShelfPage] Received products:', data.products?.length || 0);
  return data.products || [];
}

export default function ShelfPage({ cloudItems = [], isAuthenticated = false }: Props) {
  const [items, setItems] = useState<ShelfItem[]>([]);
  const [products, setProducts] = useState<Record<string, ProductLike>>({});
  const [mounted, setMounted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
    const local = getShelf();
    const merged = mergeShelfItems(cloudItems, local);
    setItems(merged);

    // If cloud had items local didn't have, write merged back to localStorage
    if (merged.length !== local.length) {
      const event = new Event('shelf:changed');
      window.dispatchEvent(event);
    }

    function handleChange() {
      const currentLocal = getShelf();
      const currentMerged = mergeShelfItems(cloudItems, currentLocal);
      setItems(currentMerged);
    }

    window.addEventListener('shelf:changed', handleChange);
    return () => window.removeEventListener('shelf:changed', handleChange);
  }, [cloudItems]);

  useEffect(() => {
    if (items.length === 0) return;
    const handles = Array.from(new Set(items.map((i) => i.handle)));
    setError(null);
    fetchProductsByHandles(handles)
      .then((fetched) => setProducts(buildProductsMap(fetched)))
      .catch((err) => setError(err.message || 'Failed to load book details'));
  }, [items]);

  function handleRemove(handle: string, variantId: string) {
    removeFromShelf(handle, variantId);
    const merged = mergeShelfItems(cloudItems, getShelf()).filter(
      (item) => !(item.handle === handle && item.variantId === variantId)
    );
    setItems(merged);
    syncShelfToCloud(merged);
  }

  if (!mounted) {
    return (
      <div class="vb-coll" style="grid-template-columns: 1fr;">
        <div class="vb-coll__main">
          <div class="vb-coll__bar">
            <div class="left">Showing <strong>0</strong> books</div>
          </div>
          <p style="color: var(--ink-soft);">Loading your shelf…</p>
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div class="vb-coll" style="grid-template-columns: 1fr;">
        <div class="vb-coll__main">
          <div class="vb-coll__bar">
            <div class="left">Showing <strong>0</strong> books</div>
          </div>
          <div class="vb-coll__empty">
            <h3>Your shelf is empty</h3>
            {!isAuthenticated ? (
              <>
                <p>Your saved books live in this browser only. Create an account and they’ll follow you anywhere.</p>
                <a href="/account/login/" class="vb-btn vb-btn--primary" style="margin-top: 16px; display: inline-block;">
                  Sign in or create an account →
                </a>
              </>
            ) : (
              <p>Start adding books you love and they’ll appear here.</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div class="vb-coll" style="grid-template-columns: 1fr;">
      <div class="vb-coll__main">
        <div class="vb-coll__bar">
          <div class="left">
            Showing <strong>{items.length}</strong> book{items.length === 1 ? '' : 's'}
          </div>
        </div>

        {error && (
          <div style="padding: 16px; margin-bottom: 24px; border: 1px dashed var(--rule-firm); border-radius: var(--radius-sm); color: var(--ink-soft); background: var(--paper-soft);">
            <p style="margin: 0 0 8px;">Couldn’t load full book details: {error}</p>
            <button
              type="button"
              class="vb-btn vb-btn--primary"
              onClick={() => {
                setError(null);
                const handles = Array.from(new Set(items.map((i) => i.handle)));
                fetchProductsByHandles(handles)
                  .then((fetched) => setProducts(buildProductsMap(fetched)))
                  .catch((err) => setError(err.message || 'Failed to load book details'));
              }}
            >
              Retry
            </button>
          </div>
        )}

        <div class="vb-shelf">
          {items.map((item) => (
            <ShelfItemCard
              key={`${item.handle}:${item.variantId}`}
              item={item}
              product={products[item.handle]}
              onRemove={() => handleRemove(item.handle, item.variantId)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

interface ShelfItemCardProps {
  item: ShelfItem;
  product?: ProductLike;
  onRemove: () => void;
}

function ShelfItemCard({ item, product, onRemove }: ShelfItemCardProps) {
  const mf = parseMetafields(product?.metafields);
  const authorsList = Array.isArray(mf.authors) ? mf.authors : (mf.authors ? [mf.authors] : []);

  // Prefer stored shelf data for title/image/authors/genre when product hasn't loaded yet
  const title = product?.title || item.title || '';
  const genre = mf.genre || item.genre || 'Fiction';
  const authors = authorsList.length ? authorsList : (Array.isArray(item.authors) ? item.authors : (item.authors ? [item.authors] : []));
  const coverPalette = mf.cover_palette || 'marginalia';
  const featuredImage = product?.featuredImage;
  const imageUrl = featuredImage?.url || item.image;

  // Find the saved variant for accurate pricing
  const variant = product?.variants?.edges?.find((e) => e.node.id === item.variantId)?.node;
  const price = variant?.price || product?.priceRange?.minVariantPrice || (item.price ? { amount: item.price, currencyCode: item.currencyCode || 'GBP' } : null);
  const compareAtPrice = variant?.compareAtPrice || product?.compareAtPriceRange?.minVariantPrice;
  const hasSale = price && compareAtPrice && parseFloat(compareAtPrice.amount) > parseFloat(price.amount);

  return (
    <div class="vb-card" style="position: relative;">
      <a href={`/products/${item.handle}`} style="text-decoration: none; color: inherit;">
        <div class="vb-card__cover-wrap">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={featuredImage?.altText || title}
              loading="lazy"
              width="300"
              height="420"
              style="aspect-ratio: 5/7.4; object-fit: cover; border-radius: var(--radius-sm);"
            />
          ) : (
            <div class={`vb-cover vb-cover--${coverPalette}`}>
              <div class="vb-cover__head"><span class="lbl">{genre}</span></div>
              <div>
                <div class="vb-cover__title">{title}</div>
                <div class="vb-cover__rule"></div>
                <div class="vb-cover__author">{authors.join(', ') || product?.vendor || ''}</div>
              </div>
            </div>
          )}
          {price && (
            <span class="vb-card__price-badge">
              {formatMoney(price.amount, price.currencyCode)}
            </span>
          )}
          {hasSale && <span class="vb-card__tag">Sale</span>}
        </div>
        <div class="vb-card__body">
          <div class="vb-card__genre">{genre}</div>
          <div class="vb-card__title">{title}</div>
          <div class="vb-card__author">{authors.join(', ') || product?.vendor || ''}</div>
        </div>
      </a>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${title || 'this book'} from your shelf`}
        style="position: absolute; top: 8px; right: 8px; z-index: 2; background: var(--paper); border: 1px solid var(--rule-soft); border-radius: var(--radius-sm); padding: 6px 10px; font-size: 12px; cursor: pointer; font-family: var(--font-body); color: var(--ink-soft);"
      >
        Remove
      </button>
    </div>
  );
}
