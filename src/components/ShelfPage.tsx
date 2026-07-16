import { useState, useEffect } from 'preact/hooks';
import { getShelf, removeFromShelf, syncShelfToCloud, mergeShelfItems, type ShelfItem } from '../lib/shelf';

interface Props {
  cloudItems?: ShelfItem[];
  isAuthenticated?: boolean;
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

export default function ShelfPage({ cloudItems = [], isAuthenticated = false }: Props) {
  const [items, setItems] = useState<ShelfItem[]>([]);
  const [mounted, setMounted] = useState(false);

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

  function handleRemove(handle: string, variantId: string) {
    removeFromShelf(handle, variantId);
    const updated = getShelf();
    const merged = mergeShelfItems(cloudItems, updated);
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

        <div class="vb-shelf">
          {items.map((item) => (
            <div class="vb-card" style="position: relative;" key={`${item.handle}:${item.variantId}`}>
              <a href={`/products/${item.handle}`} style="text-decoration: none; color: inherit;">
                <div class="vb-card__cover-wrap">
                  {item.image ? (
                    <img
                      src={item.image}
                      alt={item.title || ''}
                      loading="lazy"
                      width="300"
                      height="420"
                      style="aspect-ratio: 5/7.4; object-fit: cover; border-radius: var(--radius-sm);"
                    />
                  ) : (
                    <div class="vb-cover vb-cover--marginalia">
                      <div class="vb-cover__head"><span class="lbl">{item.genre || 'Fiction'}</span></div>
                      <div>
                        <div class="vb-cover__title">{item.title}</div>
                        <div class="vb-cover__rule"></div>
                        <div class="vb-cover__author">{Array.isArray(item.authors) ? item.authors.join(', ') : item.authors || ''}</div>
                      </div>
                    </div>
                  )}
                  {item.price && (
                    <span class="vb-card__price-badge">
                      {formatMoney(item.price, item.currencyCode)}
                    </span>
                  )}
                </div>
                <div class="vb-card__body">
                  <div class="vb-card__genre">{item.genre || 'Fiction'}</div>
                  <div class="vb-card__title">{item.title}</div>
                  <div class="vb-card__author">{Array.isArray(item.authors) ? item.authors.join(', ') : item.authors || ''}</div>
                </div>
              </a>
              <button
                type="button"
                onClick={() => handleRemove(item.handle, item.variantId)}
                aria-label={`Remove ${item.title || 'this book'} from your shelf`}
                style="position: absolute; top: 8px; right: 8px; z-index: 2; background: var(--paper); border: 1px solid var(--rule-soft); border-radius: var(--radius-sm); padding: 6px 10px; font-size: 12px; cursor: pointer; font-family: var(--font-body); color: var(--ink-soft);"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
