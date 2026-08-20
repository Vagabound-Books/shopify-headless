export const SHOPIFY_Y = '_shopify_y';
export const SHOPIFY_S = '_shopify_s';
export const TRACKING_CONSENT = '_tracking_consent';

export interface ShopifyCookies {
  [SHOPIFY_Y]: string;
  [SHOPIFY_S]: string;
  [TRACKING_CONSENT]: string;
}

export interface TrackingValues {
  uniqueToken: string;
  visitToken: string;
  consent: string;
}

let cachedTrackingValues: TrackingValues | null = null;

export function buildUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function getCookieValue(cookieString: string, name: string): string {
  const match = cookieString.match(new RegExp(`\\b${name}=([^;]+)`));
  return match?.[1] ?? '';
}

export function getShopifyCookies(cookieString?: string): ShopifyCookies {
  const cookies = cookieString ?? (typeof document !== 'undefined' ? document.cookie : '');
  return {
    [SHOPIFY_Y]: getCookieValue(cookies, SHOPIFY_Y),
    [SHOPIFY_S]: getCookieValue(cookies, SHOPIFY_S),
    [TRACKING_CONSENT]: getCookieValue(cookies, TRACKING_CONSENT),
  };
}

export function setCookie(
  name: string,
  value: string,
  maxAgeSeconds: number,
  domain?: string,
): void {
  if (typeof document === 'undefined') return;

  let cookie = `${name}=${encodeURIComponent(value)}; Max-Age=${maxAgeSeconds}; Path=/; SameSite=Lax`;
  if (domain) {
    cookie += `; Domain=${domain}`;
  }
  document.cookie = cookie;
}

export function deleteCookie(name: string, domain?: string): void {
  setCookie(name, '', 0, domain);
}

export function setShopifyCookies(
  values: Partial<TrackingValues>,
  hasUserConsent: boolean,
  domain?: string,
): void {
  if (typeof document === 'undefined') return;

  const cookieDomain = domain || getSharedCookieDomain();

  if (!hasUserConsent) {
    deleteCookie(SHOPIFY_Y, cookieDomain);
    deleteCookie(SHOPIFY_S, cookieDomain);
    return;
  }

  const uniqueToken = values.uniqueToken || buildUUID();
  const visitToken = values.visitToken || buildUUID();

  if (uniqueToken.startsWith('00000000-')) {
    return;
  }

  const oneYear = 60 * 60 * 24 * 365;
  const thirtyMinutes = 60 * 30;

  setCookie(SHOPIFY_Y, uniqueToken, oneYear, cookieDomain);
  setCookie(SHOPIFY_S, visitToken, thirtyMinutes, cookieDomain);
}

export function getSharedCookieDomain(): string {
  if (typeof window === 'undefined') return '';
  const host = window.location.host;
  if (/^localhost/.test(host)) return '';
  return `.${host}`;
}

export function getTrackingValues(cookieString?: string): TrackingValues {
  if (typeof window === 'undefined') {
    const cookies = getShopifyCookies(cookieString);
    return {
      uniqueToken: cookies[SHOPIFY_Y],
      visitToken: cookies[SHOPIFY_S],
      consent: cookies[TRACKING_CONSENT],
    };
  }

  let trackingValues: TrackingValues | undefined;

  try {
    if (typeof window.performance !== 'undefined') {
      const resourceRE =
        /^https?:\/\/([^/]+)(\/api\/(?:unstable|2\d{3}-\d{2})\/graphql\.json(?=$|\?))?/;
      const entries = performance.getEntriesByType(
        'resource',
      ) as PerformanceResourceTiming[];

      for (let i = entries.length - 1; i >= 0; i--) {
        const entry = entries[i];
        if (entry.initiatorType !== 'fetch') continue;

        const match = entry.name.match(resourceRE);
        if (!match) continue;

        const [, matchedHost, sfapiPath] = match;
        const currentHost = window.location.host;

        const isMatch =
          matchedHost === currentHost ||
          (Boolean(sfapiPath) && matchedHost?.endsWith(`.${currentHost}`));

        if (isMatch) {
          const values = extractFromPerformanceEntry(entry);
          if (values) {
            trackingValues = values;
            break;
          }
        }
      }

      if (trackingValues) {
        cachedTrackingValues = trackingValues;
      } else if (cachedTrackingValues) {
        trackingValues = cachedTrackingValues;
      }

      if (!trackingValues) {
        const navigationEntries = performance.getEntriesByType(
          'navigation',
        )[0] as PerformanceNavigationTiming | undefined;
        if (navigationEntries) {
          trackingValues = extractFromPerformanceEntry(navigationEntries, false);
        }
      }
    }
  } catch {
    // ignore
  }

  if (!trackingValues) {
    const cookies = getShopifyCookies();
    trackingValues = {
      uniqueToken: cookies[SHOPIFY_Y],
      visitToken: cookies[SHOPIFY_S],
      consent: cookies[TRACKING_CONSENT],
    };
  }

  return trackingValues;
}

function extractFromPerformanceEntry(
  entry: PerformanceResourceTiming | PerformanceNavigationTiming,
  isConsentRequired = true,
): TrackingValues | undefined {
  const serverTiming = (entry as PerformanceResourceTiming).serverTiming;
  if (!serverTiming || serverTiming.length < 3) return undefined;

  let uniqueToken = '';
  let visitToken = '';
  let consent = '';

  for (let i = serverTiming.length - 1; i >= 0; i--) {
    const { name, description } = serverTiming[i];
    if (!name || !description) continue;

    if (name === '_y') uniqueToken = description;
    else if (name === '_s') visitToken = description;
    else if (name === '_cmp') consent = description;

    if (uniqueToken && visitToken && consent) break;
  }

  return uniqueToken && visitToken && (isConsentRequired ? consent : true)
    ? { uniqueToken, visitToken, consent }
    : undefined;
}
