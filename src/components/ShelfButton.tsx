import { useState, useEffect } from 'preact/hooks';
import { isInShelf, toggleShelf, syncShelfToCloud, getShelf } from '../lib/shelf';

const SHELF_ICON = `<svg id="fi_5519523" enable-background="new 0 0 505.736 505.736" viewBox="0 0 505.736 505.736" xmlns="http://www.w3.org/2000/svg"><g><g><path d="m368.209 152.271h47.445v106.631h-47.445z"></path><path d="m222.003 152.271h47.445v106.631h-47.445z"></path><path d="m203.484 143.011v115.891h-47.439v-145.126h47.439z"></path><path d="m90.094 113.776h47.439v145.126h-47.439z"></path><path d="m51.032 329.138h14.216v62.822h-14.216z"></path><path d="m440.5 329.138h14.21v62.822h-14.21z"></path><path d="m505.736 310.619h-41.772-32.723-356.74-32.729-41.772v-33.198h80.835 65.951 65.958 65.964 80.242 65.957 80.829z"></path></g></g></svg>`;

interface Props {
  handle: string;
  variantId: string;
  title?: string;
  image?: string;
  price?: string;
  currencyCode?: string;
  genre?: string;
  authors?: string[];
}

export default function ShelfButton({ handle, variantId, title, image, price, currencyCode, genre, authors }: Props) {
  const [active, setActive] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setActive(isInShelf(handle, variantId));

    function handleChange() {
      setActive(isInShelf(handle, variantId));
    }

    window.addEventListener('shelf:changed', handleChange);
    return () => window.removeEventListener('shelf:changed', handleChange);
  }, [handle, variantId]);

  if (!mounted) {
    return (
      <button type="button" class="vb-btn vb-btn--primary vb-btn--sm js-wk-save" aria-label="Add to shelf">
        <span class="wk-icon-unsaved" dangerouslySetInnerHTML={{ __html: SHELF_ICON }} />
      </button>
    );
  }

  function handleClick(e: Event) {
    e.preventDefault();
    const nowActive = toggleShelf({ handle, variantId, title, image, price, currencyCode, genre, authors });
    setActive(nowActive);

    // Sync entire shelf to cloud in the background (silently fails if not logged in)
    const items = getShelf();
    syncShelfToCloud(items);
  }

  return (
    <button
      type="button"
      class={`vb-btn vb-btn--primary vb-btn--sm js-wk-save${active ? ' is-active' : ''}`}
      onClick={handleClick}
      aria-label={active ? 'Remove from shelf' : 'Add to shelf'}
    >
      <span class="wk-icon-unsaved" hidden={active} dangerouslySetInnerHTML={{ __html: SHELF_ICON }} />
      <span class="wk-icon-saved" hidden={!active} dangerouslySetInnerHTML={{ __html: SHELF_ICON }} />
    </button>
  );
}
