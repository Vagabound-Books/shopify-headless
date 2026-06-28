import { useState, useEffect } from 'preact/hooks';
import { getShelf, removeFromShelf, type ShelfItem } from '../lib/shelf';
import { formatMoney } from '../lib/money';

function formatMoneyLocal(amount?: string, currencyCode?: string): string {
  if (!amount || !currencyCode) return '';
  const value = parseFloat(amount);
  if (isNaN(value)) return '';
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: currencyCode,
  }).format(value);
}

export default function ShelfPage() {
  const [items, setItems] = useState<ShelfItem[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setItems(getShelf());

    function handleChange() {
      setItems(getShelf());
    }

    window.addEventListener('shelf:changed', handleChange);
    return () => window.removeEventListener('shelf:changed', handleChange);
  }, []);

  if (!mounted) {
    return <p style="color: var(--ink-soft);">Loading your shelf…</p>;
  }

  if (items.length === 0) {
    return (
      <p style="color: var(--ink-soft);">
        Your shelf is empty. Start adding books you love!
      </p>
    );
  }

  function handleRemove(handle: string, variantId: string) {
    removeFromShelf(handle, variantId);
    setItems(getShelf());
  }

  return (
    <div class="vb-shelf">
      {items.map((item) => (
        <div class="vb-card" style="position: relative;">
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
                  {formatMoneyLocal(item.price, item.currencyCode)}
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
            style="position: absolute; top: 8px; right: 8px; z-index: 2; background: var(--paper); border: 1px solid var(--rule-soft); border-radius: var(--radius-sm); padding: 6px 10px; font-size: 12px; cursor: pointer; font-family: var(--font-body); color: var(--ink-soft);"
          >
            Remove
          </button>
        </div>
      ))}
    </div>
  );
}
