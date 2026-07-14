export interface ShelfItem {
  handle: string;
  variantId: string;
  title?: string;
  image?: string;
  price?: string;
  currencyCode?: string;
  genre?: string;
  authors?: string[];
  addedAt: string;
}

const STORAGE_KEY = 'vagabound-shelf';

function getShelfItems(): ShelfItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveShelfItems(items: ShelfItem[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  window.dispatchEvent(new Event('shelf:changed'));
}

export function getShelf(): ShelfItem[] {
  return getShelfItems();
}

export function addToShelf(item: Omit<ShelfItem, 'addedAt'>): void {
  const items = getShelfItems();
  const exists = items.some(
    (i) => i.handle === item.handle && i.variantId === item.variantId
  );
  if (!exists) {
    items.push({ ...item, addedAt: new Date().toISOString() });
    saveShelfItems(items);
  }
}

export function removeFromShelf(handle: string, variantId: string): void {
  const items = getShelfItems().filter(
    (item) => !(item.handle === handle && item.variantId === variantId)
  );
  saveShelfItems(items);
}

export function isInShelf(handle: string, variantId: string): boolean {
  return getShelfItems().some(
    (item) => item.handle === handle && item.variantId === variantId
  );
}

export function toggleShelf(item: Omit<ShelfItem, 'addedAt'>): boolean {
  if (isInShelf(item.handle, item.variantId)) {
    removeFromShelf(item.handle, item.variantId);
    return false;
  } else {
    addToShelf(item);
    return true;
  }
}

/**
 * Merge cloud and local shelf items. Local items take precedence when the
 * same handle+variantId exists in both. Union of both sets otherwise.
 */
export function mergeShelfItems(cloud: ShelfItem[], local: ShelfItem[]): ShelfItem[] {
  const map = new Map<string, ShelfItem>();

  for (const item of cloud) {
    const key = `${item.handle}:${item.variantId}`;
    map.set(key, item);
  }

  for (const item of local) {
    const key = `${item.handle}:${item.variantId}`;
    map.set(key, item);
  }

  return Array.from(map.values());
}

/**
 * Write the current local shelf to the customer's cloud metafield.
 * Silently fails if the user is not authenticated or the API errors.
 */
export async function syncShelfToCloud(items: ShelfItem[]): Promise<boolean> {
  try {
    const res = await fetch('/api/wishlist/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
