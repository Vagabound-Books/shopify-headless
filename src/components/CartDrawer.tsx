import { useEffect, useRef } from 'preact/hooks';
import { useStore } from '@nanostores/preact';
import {
  cart,
  isCartDrawerOpen,
  isCartUpdating,
  removeCartItems,
  initCart,
} from '../lib/cart';
import { formatMoney } from '../lib/money';
import { normalizeCheckoutUrl } from '../lib/shopify';
import { appendTtclid } from '../lib/analytics/tiktok.client';
import { trackCartViewed, trackCheckoutStarted, trackProductRemovedFromCart } from '../lib/analytics/events';
import { sendGa4Event } from '../lib/analytics/ga4';
import type { ShopifyAnalyticsProduct } from '../lib/analytics/monorail';

function linesToProducts(lines: any[]): ShopifyAnalyticsProduct[] {
  return lines.map((line) => ({
    productGid: line.merchandise.product.id || '',
    variantGid: line.merchandise.id,
    name: line.merchandise.product.title,
    variantName: line.merchandise.title,
    brand: line.merchandise.product.vendor,
    category: line.merchandise.product.productType,
    price: line.cost.subtotalAmount.amount,
    quantity: line.quantity,
  }));
}

export default function CartDrawer() {
  const $open = useStore(isCartDrawerOpen);
  const $cart = useStore(cart);
  const $updating = useStore(isCartUpdating);
  const drawerRef = useRef<HTMLDivElement>(null);
  const trackedOpenRef = useRef(false);

  useEffect(() => {
    initCart();
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') isCartDrawerOpen.set(false);
    }
    if ($open) {
      document.addEventListener('keydown', onKey);
      document.body.style.overflow = 'hidden';

      if ($cart?.id && ($cart.lines?.edges?.length || 0) > 0 && !trackedOpenRef.current) {
        trackedOpenRef.current = true;
        const lines = $cart.lines.edges.map((e: any) => e.node);
        const totalValue = $cart.cost?.subtotalAmount?.amount
          ? parseFloat($cart.cost.subtotalAmount.amount)
          : undefined;
        trackCartViewed(linesToProducts(lines), totalValue).catch((err) =>
          console.error('Analytics cart_viewed failed:', err),
        );
      }
    } else {
      trackedOpenRef.current = false;
    }
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [$open, $cart?.id]);

  function close() {
    sendGa4Event('close_cart');
    isCartDrawerOpen.set(false);
  }

  function onBackdropClick(e: Event) {
    if (e.target === drawerRef.current) {
      close();
    }
  }

  async function handleRemove(lineId: string) {
    if (!$cart) return;
    const line = $cart.lines?.edges?.map((e: any) => e.node).find((line: any) => line.id === lineId);
    try {
      await removeCartItems([lineId]);
      if (line) {
        const product = linesToProducts([line]);
        const totalValue = parseFloat(line.cost.subtotalAmount.amount) || undefined;
        trackProductRemovedFromCart($cart.id, product, totalValue).catch((err) =>
          console.error('Analytics remove_from_cart failed:', err),
        );
      }
    } catch (err) {
      console.error('Failed to remove item:', err);
    }
  }

  function handleCheckout() {
    if ($cart?.id) {
      const lines = $cart.lines?.edges?.map((e: any) => e.node) || [];
      const totalValue = $cart.cost?.subtotalAmount?.amount
        ? parseFloat($cart.cost.subtotalAmount.amount)
        : undefined;
      trackCheckoutStarted($cart.id, linesToProducts(lines), totalValue).catch((err) =>
        console.error('Analytics checkout_started failed:', err),
      );
    }
  }

  const lines = $cart?.lines?.edges?.map((e: any) => e.node) || [];

  const freeShippingThreshold = Number(import.meta.env.PUBLIC_FREE_SHIPPING_THRESHOLD);
  const totalQuantity = $cart?.totalQuantity ?? lines.reduce((sum, line) => sum + line.quantity, 0);
  const showFreeShippingNudge = Number.isFinite(freeShippingThreshold) && freeShippingThreshold > 0;
  const booksAway = freeShippingThreshold - totalQuantity;

  return (
    <div
      ref={drawerRef}
      onClick={onBackdropClick}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        background: 'rgba(0,0,0,0.35)',
        opacity: $open ? 1 : 0,
        pointerEvents: $open ? 'auto' : 'none',
        transition: 'opacity 0.2s ease',
      }}
    >
      <div
        style={{
          position: 'absolute',
          right: 0,
          top: 0,
          bottom: 0,
          width: '100%',
          maxWidth: '420px',
          background: 'var(--paper, #fff)',
          transform: $open ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.25s ease',
          display: 'flex',
          flexDirection: 'column',
          textAlign: 'left',
        }}
      >
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--rule-soft, #e7e7e7)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>Your basket</h2>
          <button
            type="button"
            onClick={close}
            aria-label="Close cart"
            style={{ background: 'none', border: 'none', fontSize: '22px', cursor: 'pointer', lineHeight: 1 }}
          >
            ✕
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
          {$updating && (
            <p style={{ color: 'var(--ink-soft)', fontSize: '14px' }}>Updating…</p>
          )}

          {lines.length === 0 ? (
            <div style={{ textAlign: 'left', marginTop: '40px' }}>
              <p style={{ color: 'var(--ink-soft)' }}>Your basket is empty.</p>
              <a href="/" class="vb-btn vb-btn--primary" style={{ marginTop: '16px', display: 'inline-block' }} onClick={close}>
                Continue shopping
              </a>
            </div>
          ) : (
            <div>
              {lines.map((line: any) => (
                <div key={line.id} style={{ display: 'flex', gap: '14px', padding: '14px 0', borderBottom: '1px solid var(--rule-soft, #e7e7e7)' }}>
                  {line.merchandise.image && (
                    <img
                      src={line.merchandise.image.url}
                      alt={line.merchandise.image.altText || line.merchandise.product.title}
                      width="64"
                      height="90"
                      style={{ borderRadius: 'var(--radius-sm, 6px)', objectFit: 'cover', flexShrink: 0 }}
                    />
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <a
                      href={`/books/${line.merchandise.product.handle}`}
                      style={{ fontWeight: 600, color: 'inherit', textDecoration: 'none', display: 'block' }}
                      onClick={close}
                    >
                      {line.merchandise.product.title}
                    </a>
                    <div style={{ fontSize: '13px', color: 'var(--ink-muted)', marginTop: '4px' }}>
                      {line.merchandise.title}
                    </div>
                    <div style={{ fontSize: '13px', marginTop: '6px' }}>
                      Qty: {line.quantity}
                    </div>
                    <div style={{ fontSize: '13px', marginTop: '2px' }}>
                      {formatMoney(line.cost.subtotalAmount.amount, line.cost.subtotalAmount.currencyCode)}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemove(line.id)}
                    disabled={$updating}
                    style={{ background: 'none', border: 'none', color: 'var(--ink-muted)', cursor: 'pointer', fontSize: '12px', alignSelf: 'flex-start', flexShrink: 0 }}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {lines.length > 0 && (
          <div style={{ padding: '20px 24px', borderTop: '1px solid var(--rule-soft, #e7e7e7)' }}>
            {showFreeShippingNudge && (
              <div style={{
                marginBottom: '14px',
                background: 'var(--paper-soft)',
                border: '1px solid var(--rule-soft)',
                borderRadius: 'var(--radius-sm)',
                padding: '12px 16px',
                fontSize: 'var(--type-sm)',
                color: 'var(--ink-soft)',
              }}>
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
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600, fontSize: '16px' }}>
              <span>Subtotal</span>
              <span>{$cart?.cost?.subtotalAmount ? formatMoney($cart.cost.subtotalAmount.amount, $cart.cost.subtotalAmount.currencyCode) : ''}</span>
            </div>
            <a
              href={appendTtclid(normalizeCheckoutUrl($cart?.checkoutUrl || ""))}
              class="vb-btn vb-btn--stamp vb-btn--block"
              style={{ marginTop: '16px', textAlign: 'left', display: 'block', textDecoration: 'none' }}
              onClick={handleCheckout}
            >
              Checkout
            </a>
            <button
              type="button"
              onClick={close}
              style={{ marginTop: '10px', display: 'block', width: '100%', textAlign: 'left', background: 'none', border: 'none', color: 'var(--ink-muted)', cursor: 'pointer', fontSize: '14px' }}
            >
              Continue shopping
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
