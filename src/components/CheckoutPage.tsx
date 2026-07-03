import { useEffect, useState } from 'preact/hooks';
import { useStore } from '@nanostores/preact';
import { cart, initCart, getOrCreateCart } from '../lib/cart';

export default function CheckoutPage() {
  const $cart = useStore(cart);
  const [status, setStatus] = useState<'loading' | 'redirecting' | 'empty' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    async function proceedToCheckout() {
      try {
        // Initialize cart from localStorage / refresh from Shopify
        await initCart();

        const currentCart = cart.get();
        const cartId = currentCart?.id;
        const totalQuantity = currentCart?.totalQuantity || 0;

        // No cart or empty cart
        if (!cartId || totalQuantity === 0) {
          setStatus('empty');
          // Redirect to cart after a short delay so the user sees the message
          setTimeout(() => {
            window.location.href = '/cart';
          }, 1500);
          return;
        }

        // Fetch fresh cart data to ensure checkoutUrl is valid
        const freshCart = await getOrCreateCart();

        if (!freshCart || !freshCart.id || (freshCart.totalQuantity || 0) === 0) {
          setStatus('empty');
          setTimeout(() => {
            window.location.href = '/cart';
          }, 1500);
          return;
        }

        const checkoutUrl = freshCart.checkoutUrl;

        if (!checkoutUrl) {
          setStatus('error');
          setErrorMessage('Unable to retrieve checkout link. Please try again.');
          return;
        }

        setStatus('redirecting');

        // Update local cart state with fresh data
        cart.set({
          id: freshCart.id,
          cost: freshCart.cost,
          checkoutUrl: freshCart.checkoutUrl,
          totalQuantity: freshCart.totalQuantity,
          lines: freshCart.lines,
        });

        // Redirect to Shopify checkout
        window.location.href = checkoutUrl;
      } catch (err) {
        console.error('[Checkout] Error proceeding to checkout:', err);
        setStatus('error');
        setErrorMessage('Something went wrong preparing your checkout. Please try again.');
      }
    }

    proceedToCheckout();
  }, []);

  if (status === 'empty') {
    return (
      <div style="text-align: center; padding: 48px 0;">
        <p style="color: var(--ink-soft); font-size: var(--type-lg);">Your basket is empty.</p>
        <p style="color: var(--ink-muted); margin-top: 8px;">Redirecting to cart…</p>
        <a href="/cart" class="vb-btn vb-btn--primary" style="margin-top: 24px; display: inline-block;">
          Go to cart
        </a>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div style="text-align: center; padding: 48px 0;">
        <p style="color: var(--ink-soft); font-size: var(--type-lg);">{errorMessage}</p>
        <div style="margin-top: 24px; display: flex; gap: 12px; justify-content: center; flex-wrap: wrap;">
          <a href="/cart" class="vb-btn vb-btn--primary">
            Return to cart
          </a>
          <a href="/" class="vb-btn vb-btn--ghost">
            Continue shopping
          </a>
        </div>
      </div>
    );
  }

  if (status === 'redirecting') {
    return (
      <div style="text-align: center; padding: 48px 0;">
        <p style="color: var(--ink-soft); font-size: var(--type-lg);">Redirecting to secure checkout…</p>
        <p style="color: var(--ink-muted); margin-top: 8px;">Please wait while we prepare your order.</p>
      </div>
    );
  }

  // Default loading state
  return (
    <div style="text-align: center; padding: 48px 0;">
      <p style="color: var(--ink-soft); font-size: var(--type-lg);">Preparing checkout…</p>
      <p style="color: var(--ink-muted); margin-top: 8px;">Validating your basket with our store.</p>
    </div>
  );
}
