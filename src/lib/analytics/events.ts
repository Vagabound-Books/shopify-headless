import {
  AnalyticsEventName,
  type ShopifyAnalyticsProduct,
  type ShopifyPageViewPayload,
  type ShopifyAddToCartPayload,
  getClientBrowserParameters,
  sendShopifyAnalytics,
} from './monorail';
import { analyticsProcessingAllowed } from './privacy';
import { getTrackingValues } from './cookies';

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
}

export async function trackCartViewed(): Promise<void> {
  const base = getBasePayload();
  if (!base.hasUserConsent) return;

  const payload = withBrowserParams({
    ...base,
    pageType: 'cart',
  });

  await sendShopifyAnalytics(
    { eventName: AnalyticsEventName.PAGE_VIEW, payload },
    window.__VB_ANALYTICS__?.checkoutDomain,
  );
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
}
