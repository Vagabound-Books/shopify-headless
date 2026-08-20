import { parseGid } from './gid';
function parseShopifyId(value: string | undefined | null): number {
  if (!value) return 0;
  const parsed = parseGid(value);
  if (parsed.id) return parseInt(parsed.id, 10) || 0;
  // Fallback for raw numeric IDs (e.g. from env vars).
  return parseInt(value, 10) || 0;
}

import {
  buildUUID,
  getTrackingValues,
  type TrackingValues,
} from './cookies';

export const AnalyticsEventName = {
  PAGE_VIEW: 'PAGE_VIEW',
  ADD_TO_CART: 'ADD_TO_CART',
  PAGE_VIEW_2: 'PAGE_VIEW_2',
  COLLECTION_VIEW: 'COLLECTION_VIEW',
  PRODUCT_VIEW: 'PRODUCT_VIEW',
  SEARCH_VIEW: 'SEARCH_VIEW',
} as const;

export const AnalyticsPageType = {
  article: 'article',
  blog: 'blog',
  cart: 'cart',
  collection: 'collection',
  customersAccount: 'customers/account',
  home: 'index',
  listCollections: 'list-collections',
  notFound: '404',
  page: 'page',
  product: 'product',
  policy: 'policy',
  search: 'search',
} as const;

export const ShopifySalesChannel = {
  hydrogen: 'hydrogen',
  headless: 'headless',
} as const;

export const ShopifyAppId = {
  hydrogen: '6167201',
  headless: '12875497473',
} as const;

export interface ShopifyAnalyticsProduct {
  productGid: string;
  variantGid?: string;
  name: string;
  variantName?: string;
  brand?: string;
  category?: string;
  price: string;
  sku?: string;
  quantity?: number;
}

export interface ClientBrowserParameters {
  uniqueToken: string;
  visitToken: string;
  url: string;
  path: string;
  search: string;
  referrer: string;
  title: string;
  userAgent: string;
  navigationType: string;
  navigationApi: string;
}

export interface ShopifyAnalyticsBase {
  hasUserConsent: boolean;
  shopId: string;
  currency: string;
  storefrontId?: string;
  hydrogenSubchannelId?: string;
  acceptedLanguage?: string;
  shopifySalesChannel?: keyof typeof ShopifySalesChannel;
  assetVersionId?: string;
  customerId?: string;
  totalValue?: number;
  products?: ShopifyAnalyticsProduct[];
  analyticsAllowed?: boolean;
  marketingAllowed?: boolean;
  saleOfDataAllowed?: boolean;
  ccpaEnforced?: boolean;
  gdprEnforced?: boolean;
}

export interface ShopifyPageViewPayload
  extends ShopifyAnalyticsBase,
    ClientBrowserParameters {
  canonicalUrl?: string;
  pageType?: string;
  resourceId?: string;
  collectionHandle?: string;
  collectionId?: string;
  searchString?: string;
}

export interface ShopifyAddToCartPayload
  extends ShopifyAnalyticsBase,
    ClientBrowserParameters {
  cartId: string;
}

export type ShopifyAnalyticsPayload = ShopifyPageViewPayload | ShopifyAddToCartPayload;

export interface ShopifyAnalyticsEvent {
  eventName: string;
  payload: ShopifyAnalyticsPayload;
}

export interface ShopifyMonorailEvent {
  schema_id: string;
  payload: Record<string, unknown>;
  metadata: {
    event_created_at_ms: number;
  };
}

const CUSTOMER_TRACKING_SCHEMA = 'custom_storefront_customer_tracking/1.2';
const TREKKIE_PAGE_VIEW_SCHEMA = 'trekkie_storefront_page_view/1.4';
const ASSET_VERSION_ID = 'headless/1.0';

function isLighthouseUserAgent(): boolean {
  if (typeof window === 'undefined' || !window.navigator) return false;
  return /Chrome-Lighthouse/.test(window.navigator.userAgent);
}

export function getClientBrowserParameters(
  trackingValues?: TrackingValues,
): ClientBrowserParameters {
  if (typeof window === 'undefined') {
    return {
      uniqueToken: '',
      visitToken: '',
      url: '',
      path: '',
      search: '',
      referrer: '',
      title: '',
      userAgent: '',
      navigationType: '',
      navigationApi: '',
    };
  }

  const values = trackingValues || getTrackingValues();
  const [navigationType, navigationApi] = getNavigationType();

  return {
    uniqueToken: values.uniqueToken,
    visitToken: values.visitToken,
    url: location.href,
    path: location.pathname,
    search: location.search,
    referrer: document.referrer,
    title: document.title,
    userAgent: navigator.userAgent,
    navigationType,
    navigationApi,
  };
}

function getNavigationType(): [string, string] {
  try {
    let navApi = 'PerformanceNavigationTiming';
    let navType = getNavigationTypeExperimental();
    if (!navType) {
      navType = getNavigationTypeLegacy();
      navApi = 'performance.navigation';
    }
    if (navType) {
      return [navType, navApi];
    }
    return ['unknown', 'unknown'];
  } catch {
    return ['error', 'error'];
  }
}

function getNavigationTypeExperimental(): string | undefined {
  try {
    const entries =
      performance?.getEntriesByType &&
      performance?.getEntriesByType('navigation');
    if (entries && entries[0]) {
      const rawType = (entries[0] as PerformanceNavigationTiming).type;
      return rawType ? rawType.toString() : undefined;
    }
  } catch {
    // ignore
  }
  return undefined;
}

function getNavigationTypeLegacy(): string | undefined {
  try {
    // Cast to any to avoid ts(6385) deprecation warnings on performance.navigation.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const nav = (performance as any)?.navigation;
    if (nav && nav.type !== null && nav.type !== undefined) {
      // Use numeric literals because the PerformanceNavigation interface is deprecated.
      // 0 = navigate, 1 = reload, 2 = back_forward
      switch (nav.type) {
        case 0:
          return 'navigate';
        case 1:
          return 'reload';
        case 2:
          return 'back_forward';
        default:
          return `unknown: ${nav.type}`;
      }
    }
  } catch {
    // ignore
  }
  return undefined;
}

function formatPayload(
  payload: ShopifyAnalyticsPayload,
): Record<string, unknown> {
  const base: Record<string, unknown> = {
    source: payload.shopifySalesChannel || ShopifySalesChannel.headless,
    asset_version_id: payload.assetVersionId || ASSET_VERSION_ID,
    hydrogenSubchannelId: payload.storefrontId || payload.hydrogenSubchannelId || '0',

    is_persistent_cookie: payload.hasUserConsent,
    visit_token: payload.visitToken,
    unique_token: payload.uniqueToken,
    event_time: Date.now(),
    event_id: buildUUID(),

    event_source_url: payload.url,
    referrer: payload.referrer,
    user_agent: payload.userAgent,
    navigation_type: payload.navigationType,
    navigation_api: payload.navigationApi,

    shop_id: parseShopifyId(payload.shopId),
    currency: payload.currency,

    ccpa_enforced: payload.ccpaEnforced || false,
    gdpr_enforced: payload.gdprEnforced || false,
    gdpr_enforced_as_string: payload.gdprEnforced ? 'true' : 'false',
    analytics_allowed: payload.analyticsAllowed || false,
    marketing_allowed: payload.marketingAllowed || false,
    sale_of_data_allowed: payload.saleOfDataAllowed || false,
  };

  return base;
}

function formatProductPayload(
  products?: ShopifyAnalyticsProduct[],
): string[] {
  if (!products) return [];

  return products.map((p) => {
    const product: Record<string, unknown> = {
      product_gid: p.productGid,
      name: p.name,
      variant: p.variantName || '',
      brand: p.brand || '',
      price: parseFloat(p.price),
      quantity: Number(p.quantity || 0),
    };

    const optional: Record<string, unknown> = {};
    if (p.variantGid) optional.variant_gid = p.variantGid;
    if (p.category) optional.category = p.category;
    if (p.sku) optional.sku = p.sku;
    if (p.productGid) {
      optional.product_id = parseInt(parseGid(p.productGid).id || '0', 10);
    }
    if (p.variantGid) {
      optional.variant_id = parseInt(parseGid(p.variantGid).id || '0', 10);
    }

    Object.entries(optional).forEach(([key, value]) => {
      if (value) product[key] = value;
    });

    return JSON.stringify(product);
  });
}

function schemaWrapper(
  schemaId: string,
  payload: Record<string, unknown>,
): ShopifyMonorailEvent {
  return {
    schema_id: schemaId,
    payload,
    metadata: {
      event_created_at_ms: Date.now(),
    },
  };
}

function addDataIf(
  source: Record<string, unknown>,
  target: Record<string, unknown>,
): Record<string, unknown> {
  Object.entries(source).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      target[key] = value;
    }
  });
  return target;
}

function buildCustomerTrackingEvent(
  eventName: string,
  payload: ShopifyAnalyticsPayload,
  extra: Record<string, unknown> = {},
): ShopifyMonorailEvent {
  const base = formatPayload(payload);
  return schemaWrapper(
    CUSTOMER_TRACKING_SCHEMA,
    addDataIf(
      {
        event_name: eventName,
        canonical_url: (payload as ShopifyPageViewPayload).canonicalUrl || payload.url,
        customer_id: parseShopifyId(payload.customerId),
        ...extra,
      },
      base,
    ),
  );
}

function buildTrekkiePageView(
  payload: ShopifyPageViewPayload,
): ShopifyMonorailEvent {
  const { id, resource } = parseGid(payload.resourceId);
  const resourceType = resource ? resource.toLowerCase() : undefined;

  const base = formatPayload(payload);
  return schemaWrapper(
    TREKKIE_PAGE_VIEW_SCHEMA,
    addDataIf(
      {
        pageType: payload.pageType,
        customerId: parseShopifyId(payload.customerId),
        resourceType,
        resourceId: parseInt(id || '0', 10),
      },
      base,
    ),
  );
}

export function buildMonorailEvents(
  event: ShopifyAnalyticsEvent,
): ShopifyMonorailEvent[] {
  const { eventName, payload } = event;

  if (eventName === AnalyticsEventName.PAGE_VIEW) {
    const pagePayload = payload as ShopifyPageViewPayload;
    const events: ShopifyMonorailEvent[] = [
      buildTrekkiePageView(pagePayload),
      buildCustomerTrackingEvent('page_rendered', pagePayload),
    ];

    switch (pagePayload.pageType) {
      case AnalyticsPageType.collection:
        events.push(
          buildCustomerTrackingEvent('collection_page_rendered', pagePayload, {
            collection_name: pagePayload.collectionHandle,
            collection_id: parseInt(parseGid(pagePayload.collectionId).id || '0', 10),
          }),
        );
        break;
      case AnalyticsPageType.product:
        events.push(
          buildCustomerTrackingEvent('product_page_rendered', pagePayload, {
            products: formatProductPayload(pagePayload.products),
            total_value: pagePayload.totalValue,
          }),
        );
        break;
      case AnalyticsPageType.search:
        events.push(
          buildCustomerTrackingEvent('search_submitted', pagePayload, {
            search_string: pagePayload.searchString,
          }),
        );
        break;
    }

    return events;
  }

  if (eventName === AnalyticsEventName.PRODUCT_VIEW) {
    const pagePayload = payload as ShopifyPageViewPayload;
    return [
      buildCustomerTrackingEvent('product_page_rendered', pagePayload, {
        products: formatProductPayload(pagePayload.products),
        total_value: pagePayload.totalValue,
      }),
    ];
  }

  if (eventName === AnalyticsEventName.COLLECTION_VIEW) {
    const pagePayload = payload as ShopifyPageViewPayload;
    return [
      buildCustomerTrackingEvent('collection_page_rendered', pagePayload, {
        collection_name: pagePayload.collectionHandle,
        collection_id: parseInt(parseGid(pagePayload.collectionId).id || '0', 10),
      }),
    ];
  }

  if (eventName === AnalyticsEventName.SEARCH_VIEW) {
    const pagePayload = payload as ShopifyPageViewPayload;
    return [
      buildCustomerTrackingEvent('search_submitted', pagePayload, {
        search_string: pagePayload.searchString,
      }),
    ];
  }

  if (eventName === AnalyticsEventName.ADD_TO_CART) {
    const cartPayload = payload as ShopifyAddToCartPayload;
    const cartToken = parseGid(cartPayload.cartId);
    return [
      buildCustomerTrackingEvent('product_added_to_cart', cartPayload, {
        cart_token: cartToken.id ? `${cartToken.id}` : null,
        total_value: cartPayload.totalValue,
        products: formatProductPayload(cartPayload.products),
        customer_id: parseShopifyId(cartPayload.customerId),
      }),
    ];
  }

  return [];
}

export async function sendShopifyAnalytics(
  event: ShopifyAnalyticsEvent,
  shopDomain?: string,
): Promise<void> {
  if (!event.payload.hasUserConsent) return;
  if (isLighthouseUserAgent()) return;

  const events = buildMonorailEvents(event);
  if (events.length === 0) return;

  const endpoint = shopDomain
    ? `https://${shopDomain}/.well-known/shopify/monorail/unstable/produce_batch`
    : 'https://monorail-edge.shopifysvc.com/unstable/produce_batch';

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'text/plain',
      },
      body: JSON.stringify({
        events,
        metadata: {
          event_sent_at_ms: Date.now(),
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Monorail HTTP ${response.status}`);
    }

    const text = await response.text();
    if (text) {
      try {
        const json = JSON.parse(text) as {
          result?: Array<{ status: number; message: string }>;
        };
        json.result?.forEach((eventResponse) => {
          if (eventResponse.status !== 200) {
            console.error('[Shopify Analytics] event failed:', eventResponse.message);
          }
        });
      } catch {
        // ignore parse errors
      }
    }
  } catch (err) {
    console.error('[Shopify Analytics] send failed:', err);
  }
}
