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
