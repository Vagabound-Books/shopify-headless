import { useState } from 'preact/hooks';
import { addCartItem, isCartUpdating } from '../lib/cart';

interface Props {
  variantId: string;
  quantity?: number;
}

export default function AddToCart({ variantId, quantity = 1 }: Props) {
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
