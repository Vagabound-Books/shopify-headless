import { useEffect } from 'preact/hooks';
import { useStore } from '@nanostores/preact';
import { cart, initCart, isCartDrawerOpen } from '../lib/cart';

export default function CartIcon() {
  const $cart = useStore(cart);

  useEffect(() => {
    initCart();
  }, []);

  function openCart() {
    isCartDrawerOpen.set(true);
  }

  const count = $cart?.totalQuantity || 0;

  return (
      <a href="/cart" class="vb-iconbtn" aria-label="Cart" onClick={(e: MouseEvent) => { e.preventDefault(); openCart(); }}>
      <img src="/assets/icon-cart.svg" alt="" width="22" height="22" />
      {count > 0 && (
        <span class="vb-iconbtn__badge js-cart-count">{count}</span>
      )}
    </a>
  );
}
