export interface VisitorConsent {
  marketing?: 'yes' | 'no' | '';
  analytics?: 'yes' | 'no' | '';
  preferences?: 'yes' | 'no' | '';
  sale_of_data?: 'yes' | 'no' | '';
}

export interface CustomerPrivacyApi {
  loadFeatures: (
    features: Array<{ name: string; version: string }>,
    callback: (error?: Error) => void,
  ) => void;
  shouldShowBanner: () => boolean;
  analyticsProcessingAllowed: () => boolean;
  marketingAllowed: () => boolean;
  saleOfDataAllowed: () => boolean;
  preferencesProcessingAllowed: () => boolean;
  currentVisitorConsent: () => VisitorConsent;
  setTrackingConsent: (
    consent: Record<string, unknown>,
    callback: () => void,
  ) => void;
  getRegion: () => string;
  consentId: () => string;
}

export interface ShopifyWindow extends Window {
  Shopify?: {
    customerPrivacy?: CustomerPrivacyApi;
    loadFeatures?: (
      features: Array<{ name: string; version: string }>,
      callback: (error?: Error) => void,
    ) => void;
  };
}

export function loadCustomerPrivacyApi(): Promise<CustomerPrivacyApi> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('Customer Privacy API can only be loaded in the browser'));
      return;
    }

    const win = window as ShopifyWindow;

    if (win.Shopify?.customerPrivacy) {
      resolve(win.Shopify.customerPrivacy);
      return;
    }

    const load = win.Shopify?.loadFeatures;
    if (!load) {
      reject(new Error('window.Shopify.loadFeatures is not available'));
      return;
    }

    load([{ name: 'consent-tracking-api', version: '0.1' }], (error) => {
      if (error) {
        reject(error);
        return;
      }
      const api = win.Shopify?.customerPrivacy;
      if (!api) {
        reject(new Error('Customer Privacy API did not initialize'));
        return;
      }
      resolve(api);
    });
  });
}

export function detectBrowserLocale(): { country: string; language: string } {
  if (typeof navigator === 'undefined') {
    return { country: 'US', language: 'EN' };
  }

  const locale = navigator.language || 'en-US';
  const parts = locale.split('-');
  const language = parts[0].toUpperCase();
  const country = parts.length > 1 ? parts[1].toUpperCase() : 'US';

  return { country, language };
}

export function shouldShowBannerSync(): boolean {
  if (typeof window === 'undefined') return false;
  const api = (window as ShopifyWindow).Shopify?.customerPrivacy;
  if (!api) return false;
  try {
    return api.shouldShowBanner();
  } catch {
    return false;
  }
}

export function analyticsProcessingAllowed(): boolean {
  if (typeof window === 'undefined') return false;
  const api = (window as ShopifyWindow).Shopify?.customerPrivacy;
  if (!api) return false;
  try {
    return api.analyticsProcessingAllowed();
  } catch {
    return false;
  }
}
