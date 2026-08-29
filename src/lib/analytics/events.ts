import {
  AnalyticsEventName,
  type ShopifyAnalyticsProduct,
  type ShopifyPageViewPayload,
  type ShopifyAddToCartPayload,
  getClientBrowserParameters,
  sendShopifyAnalytics,
} from './monorail';
import { analyticsProcessingAllowed } from './privacy';
import { buildUUID, getTrackingValues } from './cookies';
import {
  sendGa4AddToCart,
  sendGa4BeginCheckout,
  sendGa4RemoveFromCart,
  sendGa4ViewCart,
} from './ga4';

declare global {
  interface Window {
    __VB_ANALYTICS__?: {
      shopId: string;
      currency: string;
      acceptedLanguage: string;
      checkoutDomain: string;
      storefrontDomain: string;
      assetVersionId: string;
      uniqueToken?: string;
      visitToken?: string;
    };
    __VAGABOUND_TIKTOK__?: {
      trackViewContent: typeof trackViewContent;
    };
  }
}

function getBasePayload(): Pick<
  ShopifyPageViewPayload,
  | 'shopId'
  | 'currency'
  | 'acceptedLanguage'
  | 'assetVersionId'
  | 'shopifySalesChannel'
  | 'hasUserConsent'
  | 'analyticsAllowed'
  | 'marketingAllowed'
  | 'saleOfDataAllowed'
> &
  Partial<Pick<ShopifyPageViewPayload, 'customerId'>> {
  const config = window.__VB_ANALYTICS__;
  const allowed = analyticsProcessingAllowed();

  if (!config?.shopId) {
    console.warn('[Vagabound Analytics] shopId is missing; event will not validate.');
  }

  return {
    hasUserConsent: allowed,
    shopId: config?.shopId || '',
    currency: config?.currency || 'USD',
    acceptedLanguage: config?.acceptedLanguage || 'EN',
    assetVersionId: config?.assetVersionId || 'headless/1.0',
    shopifySalesChannel: 'headless',
    analyticsAllowed: allowed,
    marketingAllowed: false,
    saleOfDataAllowed: false,
  };
}

function getCurrency(): string {
  return window.__VB_ANALYTICS__?.currency || 'USD';
}

function withBrowserParams(payload: Record<string, unknown>): ShopifyPageViewPayload {
  const trackingValues = getTrackingValues();
  const config = window.__VB_ANALYTICS__;
  return {
    ...getClientBrowserParameters({
      uniqueToken: trackingValues.uniqueToken || config?.uniqueToken || '',
      visitToken: trackingValues.visitToken || config?.visitToken || '',
      consent: trackingValues.consent,
    }),
    ...payload,
  } as ShopifyPageViewPayload;
}

function sendTikTokClientEvent(event: {
  eventName: string;
  eventId: string;
  eventTime?: number;
  properties?: Record<string, unknown>;
  externalId?: string;
}): void {
  if (!analyticsProcessingAllowed()) return;

  const values = getTrackingValues();
  fetch('/api/tiktok/event', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      ...event,
      externalId: event.externalId || values.uniqueToken,
      url: typeof window !== 'undefined' ? window.location.href : undefined,
      referrer: typeof document !== 'undefined' ? document.referrer : undefined,
    }),
  }).catch((err) => console.error('[TikTok client event] failed:', err));
}

export function trackViewContent(product: ShopifyAnalyticsProduct, currency?: string): void {
  const base = getBasePayload();
  if (!base.hasUserConsent) return;

  sendTikTokClientEvent({
    eventName: 'ViewContent',
    eventId: buildUUID(),
    properties: {
      value: parseFloat(product.price) * (product.quantity || 1),
      currency: currency || base.currency,
      contents: [
        {
          content_id: product.sku || product.variantGid || product.productGid,
          content_type: 'product',
          quantity: product.quantity || 1,
          price: parseFloat(product.price),
        },
      ],
    },
  });
}

export async function trackAddToCart(
  cartId: string,
  products: ShopifyAnalyticsProduct[],
  totalValue?: number,
): Promise<void> {
  const base = getBasePayload();
  if (!base.hasUserConsent) return;

  const payload: ShopifyAddToCartPayload = withBrowserParams({
    ...base,
    cartId,
    products,
    totalValue,
  }) as ShopifyAddToCartPayload;

  await sendShopifyAnalytics(
    { eventName: AnalyticsEventName.ADD_TO_CART, payload },
    window.__VB_ANALYTICS__?.checkoutDomain,
  );

  sendGa4AddToCart(products, getCurrency(), totalValue);

  sendTikTokClientEvent({
    eventName: 'AddToCart',
    eventId: buildUUID(),
    properties: {
      value: totalValue,
      currency: getCurrency(),
      contents: products.map((p) => ({
        content_id: p.sku || p.variantGid || p.productGid,
        content_type: 'product',
        quantity: p.quantity || 1,
        price: parseFloat(p.price),
      })),
    },
  });
}

export async function trackCartViewed(
  products?: ShopifyAnalyticsProduct[],
  totalValue?: number,
): Promise<void> {
  const base = getBasePayload();
  if (!base.hasUserConsent) return;

  const payload = withBrowserParams({
    ...base,
    pageType: 'cart',
    products,
    totalValue,
  });

  await sendShopifyAnalytics(
    { eventName: AnalyticsEventName.PAGE_VIEW, payload },
    window.__VB_ANALYTICS__?.checkoutDomain,
  );

  if (products && products.length > 0) {
    sendGa4ViewCart(products, getCurrency(), totalValue);
  }
}

export async function trackCheckoutStarted(
  cartId: string,
  products?: ShopifyAnalyticsProduct[],
  totalValue?: number,
): Promise<void> {
  const base = getBasePayload();
  if (!base.hasUserConsent) return;

  const payload = withBrowserParams({
    ...base,
    pageType: 'cart',
    cartId,
    products,
    totalValue,
  });

  await sendShopifyAnalytics(
    { eventName: AnalyticsEventName.PAGE_VIEW, payload },
    window.__VB_ANALYTICS__?.checkoutDomain,
  );

  if (products && products.length > 0) {
    sendGa4BeginCheckout(products, getCurrency(), totalValue);
  }

  sendTikTokClientEvent({
    eventName: 'InitiateCheckout',
    eventId: buildUUID(),
    properties: {
      value: totalValue,
      currency: getCurrency(),
      contents:
        products?.map((p) => ({
          content_id: p.sku || p.variantGid || p.productGid,
          content_type: 'product',
          quantity: p.quantity || 1,
          price: parseFloat(p.price),
        })) ?? [],
    },
  });
}

export async function trackProductRemovedFromCart(
  cartId: string,
  products?: ShopifyAnalyticsProduct[],
  totalValue?: number,
): Promise<void> {
  const base = getBasePayload();
  if (!base.hasUserConsent) return;

  const payload = withBrowserParams({
    ...base,
    pageType: 'cart',
    cartId,
    products,
    totalValue,
  });

  await sendShopifyAnalytics(
    { eventName: AnalyticsEventName.PAGE_VIEW, payload },
    window.__VB_ANALYTICS__?.checkoutDomain,
  );

  if (products && products.length > 0) {
    sendGa4RemoveFromCart(products, getCurrency(), totalValue);
  }
}

if (typeof window !== 'undefined') {
  window.__VAGABOUND_TIKTOK__ = { trackViewContent };
}
