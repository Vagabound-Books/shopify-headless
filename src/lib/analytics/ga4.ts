import { analyticsProcessingAllowed } from './privacy';
import type { ShopifyAnalyticsProduct } from './monorail';

export const GA4_MEASUREMENT_ID = 'G-7KYXF4DM12';
export const GA4_DEBUG_MODE = import.meta.env.DEV || import.meta.env.PUBLIC_GA4_DEBUG === 'true';

export interface Ga4Item {
  item_id?: string;
  item_name?: string;
  item_brand?: string;
  item_category?: string;
  item_variant?: string;
  price?: number;
  quantity?: number;
  currency?: string;
}

export interface Ga4EventParams {
  [key: string]: unknown;
}

function toGa4Item(product: ShopifyAnalyticsProduct, currency: string): Ga4Item {
  return {
    item_id: product.sku || product.variantGid || product.productGid,
    item_name: product.name,
    item_brand: product.brand,
    item_category: product.category,
    item_variant: product.variantName,
    price: parseFloat(product.price) || 0,
    quantity: product.quantity ?? 1,
    currency,
  };
}

export function toGa4Items(
  products: ShopifyAnalyticsProduct[] | undefined,
  currency: string,
): Ga4Item[] {
  if (!products) return [];
  return products.map((p) => toGa4Item(p, currency));
}

export function ga4Allowed(): boolean {
  if (typeof window === 'undefined') return false;
  return analyticsProcessingAllowed();
}

export function gtag(...args: unknown[]): void {
  if (typeof window === 'undefined') return;
  const win = window as typeof window & { dataLayer: unknown[]; gtag?: (...a: unknown[]) => void };
  win.dataLayer = win.dataLayer || [];
  if (typeof win.gtag === 'function') {
    win.gtag.apply(null, args as Parameters<typeof win.gtag>);
  } else {
    win.dataLayer.push(args);
  }
}

export function initConsentMode(): void {
  if (typeof window === 'undefined') return;
  const win = window as typeof window & { dataLayer: unknown[] };
  win.dataLayer = win.dataLayer || [];
  gtag('consent', 'default', {
    analytics_storage: 'denied',
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    functionality_storage: 'denied',
    personalization_storage: 'denied',
    security_storage: 'granted',
    wait_for_update: 500,
  });
}

export function updateConsentFromPrivacyApi(): void {
  if (typeof window === 'undefined') return;
  const allowed = analyticsProcessingAllowed();
  gtag('consent', 'update', {
    analytics_storage: allowed ? 'granted' : 'denied',
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    functionality_storage: allowed ? 'granted' : 'denied',
    personalization_storage: allowed ? 'granted' : 'denied',
    security_storage: 'granted',
  });
}

function buildEventParams(extra: Ga4EventParams = {}): Ga4EventParams {
  const params: Ga4EventParams = {};
  if (GA4_DEBUG_MODE) {
    params.debug_mode = true;
  }
  return { ...params, ...extra };
}

export function sendGa4Event(eventName: string, params: Ga4EventParams = {}): void {
  if (!ga4Allowed()) return;
  gtag('event', eventName, buildEventParams(params));
}

export function sendGa4PageView(params: Ga4EventParams = {}): void {
  if (!ga4Allowed()) return;
  gtag('event', 'page_view', buildEventParams({
    page_location: window.location.href,
    page_title: document.title,
    send_to: GA4_MEASUREMENT_ID,
    ...params,
  }));
}

export function sendGa4ViewItem(product: ShopifyAnalyticsProduct, currency: string): void {
  sendGa4Event('view_item', {
    currency,
    value: parseFloat(product.price) || 0,
    items: [toGa4Item(product, currency)],
  });
}

export function sendGa4ViewItemList(
  products: ShopifyAnalyticsProduct[],
  currency: string,
  itemListName?: string,
): void {
  const items = toGa4Items(products, currency);
  sendGa4Event('view_item_list', {
    currency,
    items,
    item_list_name: itemListName,
  });
}

export function sendGa4SelectItem(product: ShopifyAnalyticsProduct, currency: string, itemListName?: string): void {
  sendGa4Event('select_item', {
    currency,
    items: [toGa4Item(product, currency)],
    item_list_name: itemListName,
  });
}

export function sendGa4AddToCart(
  products: ShopifyAnalyticsProduct[],
  currency: string,
  value?: number,
): void {
  sendGa4Event('add_to_cart', {
    currency,
    value: value ?? products.reduce((sum, p) => sum + (parseFloat(p.price) || 0) * (p.quantity || 1), 0),
    items: toGa4Items(products, currency),
  });
}

export function sendGa4RemoveFromCart(
  products: ShopifyAnalyticsProduct[],
  currency: string,
  value?: number,
): void {
  sendGa4Event('remove_from_cart', {
    currency,
    value: value ?? products.reduce((sum, p) => sum + (parseFloat(p.price) || 0) * (p.quantity || 1), 0),
    items: toGa4Items(products, currency),
  });
}

export function sendGa4ViewCart(
  products: ShopifyAnalyticsProduct[],
  currency: string,
  value?: number,
): void {
  sendGa4Event('view_cart', {
    currency,
    value: value ?? products.reduce((sum, p) => sum + (parseFloat(p.price) || 0) * (p.quantity || 1), 0),
    items: toGa4Items(products, currency),
  });
}

export function sendGa4BeginCheckout(
  products: ShopifyAnalyticsProduct[],
  currency: string,
  value?: number,
): void {
  sendGa4Event('begin_checkout', {
    currency,
    value: value ?? products.reduce((sum, p) => sum + (parseFloat(p.price) || 0) * (p.quantity || 1), 0),
    items: toGa4Items(products, currency),
  });
}

export function sendGa4Search(searchTerm: string): void {
  sendGa4Event('search', { search_term: searchTerm });
}

export function sendGa4ShelfAdd(product: ShopifyAnalyticsProduct, currency: string): void {
  sendGa4Event('add_to_shelf', {
    currency,
    value: parseFloat(product.price) || 0,
    items: [toGa4Item(product, currency)],
  });
}

export function sendGa4ShelfRemove(product: ShopifyAnalyticsProduct, currency: string): void {
  sendGa4Event('remove_from_shelf', {
    currency,
    value: parseFloat(product.price) || 0,
    items: [toGa4Item(product, currency)],
  });
}

export function sendGa4NewsletterSignup(method: string = 'footer'): void {
  sendGa4Event('newsletter_signup', { method });
}

export function sendGa4ContactSubmit(form: string = 'sell_to_us'): void {
  sendGa4Event('contact_submit', { form });
}
