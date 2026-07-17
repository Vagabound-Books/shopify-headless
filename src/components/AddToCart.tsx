import { useState } from 'preact/hooks';
import { addCartItem, isCartUpdating } from '../lib/cart';

const BAG_ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="none" width="20" height="20" aria-hidden="true"><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.6" d="M3.392 6.875h13.216v8.016c0 .567-.224 1.112-.624 1.513-.4.402-.941.627-1.506.627H5.522a2.13 2.13 0 0 1-1.506-.627 2.15 2.15 0 0 1-.624-1.513zM8.818 2.969h2.333c.618 0 1.211.247 1.649.686a2.35 2.35 0 0 1 .683 1.658v1.562H6.486V5.313c0-.622.246-1.218.683-1.658a2.33 2.33 0 0 1 1.65-.686" /></svg>`;

interface Props {
  variantId: string;
  quantity?: number;
  availableForSale?: boolean;
  iconOnly?: boolean;
}

export default function AddToCart({ variantId, quantity = 1, availableForSale = true, iconOnly = false }: Props) {
  const [loading, setLoading] = useState(false);

  async function handleClick(e: Event) {
    e.preventDefault();
    setLoading(true);
    isCartUpdating.set(true);
    try {
      await addCartItem({ id: variantId, quantity });
    } catch (err) {
      console.error('Add to cart failed:', err);
      alert('Could not add to cart. Please try again.');
    } finally {
      setLoading(false);
      isCartUpdating.set(false);
    }
  }

  if (iconOnly) {
    return (
      <button
        type="button"
        class="vb-btn vb-btn--primary vb-btn--sm"
        onClick={handleClick}
        disabled={loading || !availableForSale}
        aria-label={!availableForSale ? 'Out of stock' : loading ? 'Adding to cart…' : 'Add to cart'}
      >
        <span dangerouslySetInnerHTML={{ __html: BAG_ICON }} style="display: inline-flex;" />
      </button>
    );
  }

  if (!availableForSale) {
    return (
      <button
        type="button"
        class="vb-btn vb-btn--primary"
        disabled
      >
        Out of stock
      </button>
    );
  }

  return (
    <button
      type="button"
      class="vb-btn vb-btn--primary"
      onClick={handleClick}
      disabled={loading}
    >
      {loading ? 'Adding…' : 'Add to cart'}
    </button>
  );
}
