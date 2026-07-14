import { useState, useEffect } from 'preact/hooks';
import { getShelf, removeFromShelf, syncShelfToCloud, mergeShelfItems, type ShelfItem } from '../lib/shelf';
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

interface Props {
  cloudItems?: ShelfItem[];
  isAuthenticated?: boolean;
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

  if (!mounted) {
    return <p style="color: var(--ink-soft);">Loading your shelf…</p>;
  }

  if (items.length === 0) {
    if (!isAuthenticated) {
      return (
        <div style="display: flex; flex-direction: column; gap: 16px; max-width: 48ch;">
          <p style="color: var(--ink-soft); margin: 0;">
            Your shelf is empty — and it lives in this browser only. Create an account and your saved books will follow you to any device.
          </p>
          <a href="/account/login/" class="vb-btn vb-btn--primary" style="align-self: flex-start;">
            Sign in or create an account →
          </a>
        </div>
      );
    }
    return (
      <p style="color: var(--ink-soft);">
        Your shelf is empty. Start adding books you love!
      </p>
    );
  }

  function handleRemove(handle: string, variantId: string) {
    removeFromShelf(handle, variantId);
    const updated = getShelf();
    const merged = mergeShelfItems(cloudItems, updated);
    setItems(merged);
    syncShelfToCloud(merged);
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
