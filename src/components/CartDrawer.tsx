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

export default function CartDrawer() {
  const $open = useStore(isCartDrawerOpen);
  const $cart = useStore(cart);
  const $updating = useStore(isCartUpdating);
  const drawerRef = useRef<HTMLDivElement>(null);

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
    }
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [$open]);

  function close() {
    isCartDrawerOpen.set(false);
  }

  function onBackdropClick(e: Event) {
    if (e.target === drawerRef.current) {
      close();
    }
  }

  async function handleRemove(lineId: string) {
    try {
      await removeCartItems([lineId]);
    } catch (err) {
      console.error('Failed to remove item:', err);
    }
  }

  const lines = $cart?.lines?.edges?.map((e: any) => e.node) || [];

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
            <div style={{ textAlign: 'center', marginTop: '40px' }}>
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
                      href={`/products/${line.merchandise.product.handle}`}
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
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600, fontSize: '16px' }}>
              <span>Subtotal</span>
              <span>{$cart?.cost?.subtotalAmount ? formatMoney($cart.cost.subtotalAmount.amount, $cart.cost.subtotalAmount.currencyCode) : ''}</span>
            </div>
            <a
              href={normalizeCheckoutUrl($cart?.checkoutUrl || "")}
              class="vb-btn vb-btn--stamp vb-btn--block"
              style={{ marginTop: '16px', textAlign: 'center', display: 'block', textDecoration: 'none' }}
            >
              Checkout
            </a>
            <button
              type="button"
              onClick={close}
              style={{ marginTop: '10px', display: 'block', width: '100%', background: 'none', border: 'none', color: 'var(--ink-muted)', cursor: 'pointer', fontSize: '14px' }}
            >
              Continue shopping
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
