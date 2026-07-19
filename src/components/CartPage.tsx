import { useEffect, useState } from 'preact/hooks';
import { useStore } from '@nanostores/preact';
import { cart, removeCartItems, isCartUpdating, initCart } from '../lib/cart';
import { formatMoney } from '../lib/money';

interface CartLine {
  id: string;
  quantity: number;
  merchandise: {
    id: string;
    title: string;
    product: {
      title: string;
      handle: string;
    };
    image?: {
      url: string;
      altText?: string;
      width?: number;
      height?: number;
    };
  };
  cost: {
    subtotalAmount: { amount: string; currencyCode: string };
  };
}

export default function CartPage() {
  const $cart = useStore(cart);
  const $updating = useStore(isCartUpdating);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    initCart().finally(() => setInitialized(true));
  }, []);

  async function handleRemove(lineId: string) {
    try {
      await removeCartItems([lineId]);
    } catch (err) {
      console.error('Failed to remove item:', err);
    }
  }

  if (!initialized) {
    return <p style="color: var(--ink-soft);">Loading cart…</p>;
  }

  const lines = $cart?.lines?.edges?.map((e: any) => e.node as CartLine) || [];

  const freeShippingThreshold = Number(import.meta.env.PUBLIC_FREE_SHIPPING_THRESHOLD);
  const totalQuantity = $cart?.totalQuantity ?? lines.reduce((sum, line) => sum + line.quantity, 0);
  const showFreeShippingNudge = Number.isFinite(freeShippingThreshold) && freeShippingThreshold > 0;
  const booksAway = freeShippingThreshold - totalQuantity;

  if (lines.length === 0) {
    return (
      <div>
        <p style="color: var(--ink-soft);">Your basket is empty.</p>
        <a href="/" class="vb-btn vb-btn--primary" style="margin-top: 24px; display: inline-block;">Continue shopping</a>
      </div>
    );
  }

  return (
    <div>
      {showFreeShippingNudge && (
        <div style="background: var(--paper-soft); border: 1px solid var(--rule-soft); border-radius: var(--radius-sm); padding: 12px 16px; margin-bottom: 24px; font-size: var(--type-sm); color: var(--ink-soft);">
          {booksAway > 0 ? (
            <span>
              <strong style={{ color: 'var(--ink)' }}>{booksAway} more book{booksAway === 1 ? '' : 's'}</strong>
              {' '}and your shipping is on us.
            </span>
          ) : (
            <span>
              <strong style={{ color: 'var(--mossy)' }}>Free shipping</strong> — on the house.
            </span>
          )}
        </div>
      )}
      <div class="vb-cart-lines">
        {lines.map((line: CartLine) => (
          <div class="vb-cart-line" style="display: flex; gap: 16px; padding: 16px 0; border-bottom: 1px solid var(--rule-soft);">
            {line.merchandise.image && (
              <img
                src={line.merchandise.image.url}
                alt={line.merchandise.image.altText || line.merchandise.product.title}
                width="80"
                height="112"
                style="aspect-ratio: 5/7; object-fit: cover; border-radius: var(--radius-sm);"
              />
            )}
            <div style="flex: 1;">
              <a href={`/products/${line.merchandise.product.handle}`} style="font-weight: 600; color: inherit; text-decoration: none;">
                {line.merchandise.product.title}
              </a>
              <div style="font-size: var(--type-xs); color: var(--ink-muted); margin-top: 4px;">
                {line.merchandise.title}
              </div>
              <div style="margin-top: 8px;">
                Qty: {line.quantity}
              </div>
              <div style="margin-top: 4px; font-size: var(--type-sm);">
                {formatMoney(line.cost.subtotalAmount.amount, line.cost.subtotalAmount.currencyCode)}
              </div>
            </div>
            <button
              type="button"
              onClick={() => handleRemove(line.id)}
              disabled={$updating}
              style="background: none; border: none; color: var(--ink-muted); cursor: pointer; font-size: 13px; align-self: flex-start;"
            >
              Remove
            </button>
          </div>
        ))}
      </div>

      <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid var(--rule-firm);">
        <div style="display: flex; justify-content: space-between; font-size: var(--type-lg); font-weight: 600;">
          <span>Subtotal</span>
          <span>{$cart?.cost?.subtotalAmount ? formatMoney($cart.cost.subtotalAmount.amount, $cart.cost.subtotalAmount.currencyCode) : ''}</span>
        </div>
        {$cart?.cost?.totalAmount && (
          <div style="display: flex; justify-content: space-between; margin-top: 8px; color: var(--ink-muted);">
            <span>Total</span>
            <span>{formatMoney($cart.cost.totalAmount.amount, $cart.cost.totalAmount.currencyCode)}</span>
          </div>
        )}
      </div>

      <div style="margin-top: 32px;">
        <a href="/checkout" class="vb-btn vb-btn--stamp vb-btn--block" style="text-align: center; display: block; text-decoration: none;">
          Checkout
        </a>
        <a href="/" class="vb-btn vb-btn--ghost" style="margin-top: 12px; display: block; text-align: center;">
          Continue shopping
        </a>
      </div>
    </div>
  );
}
