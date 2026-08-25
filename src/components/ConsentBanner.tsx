import { useEffect, useState } from 'preact/hooks';
import {
  loadCustomerPrivacyApi,
  detectBrowserLocale,
  type CustomerPrivacyApi,
} from '../lib/analytics/privacy';
import {
  getSharedCookieDomain,
  setShopifyCookies,
  getTrackingValues,
} from '../lib/analytics/cookies';

interface Props {
  alwaysShow?: boolean;
  storefrontAccessToken: string;
  checkoutRootDomain: string;
  storefrontRootDomain: string;
}

const CONSENT_STORAGE_KEY = 'vagabound-consent-decision';

function dispatchConsentEvent(detail: {
  analytics: boolean;
  marketing: boolean;
  preferences: boolean;
  saleOfData: boolean;
}) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('vagabound:consentUpdated', { detail }));
}

export default function ConsentBanner({
  storefrontAccessToken,
  checkoutRootDomain,
  storefrontRootDomain,
  alwaysShow = false,
}: Props) {
  const [api, setApi] = useState<CustomerPrivacyApi | null>(null);
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(true);

  const [forceShow, setForceShow] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const showHandler = () => setForceShow(true);
    window.addEventListener('vagabound:show-consent', showHandler);

    loadCustomerPrivacyApi()
      .then((loadedApi) => {
        if (cancelled) return;
        setApi(loadedApi);

        const alreadyDecided = window.localStorage.getItem(CONSENT_STORAGE_KEY);
        if (alreadyDecided && !forceShow) {
          setShow(false);
          setLoading(false);
          return;
        }

        const shouldShow = loadedApi.shouldShowBanner();
        setShow(forceShow || shouldShow || alwaysShow);
        setLoading(false);
      })
      .catch((err) => {
        console.error('[ConsentBanner] Failed to load Customer Privacy API:', err);
        if (!cancelled) {
          setLoading(false);
          setShow(false);
        }
      });

    return () => {
      cancelled = true;
      window.removeEventListener('vagabound:show-consent', showHandler);
    };
  }, [forceShow]);

  const handleConsent = (accepted: boolean) => {
    if (!api) return;

    const { country, language } = detectBrowserLocale();

    const consent = {
      analytics: accepted,
      marketing: accepted,
      preferences: accepted,
      sale_of_data: accepted,
      headlessStorefront: true,
      checkoutRootDomain,
      storefrontRootDomain,
      storefrontAccessToken,
      country,
      language,
    };

    api.setTrackingConsent(consent, () => {
      window.localStorage.setItem(CONSENT_STORAGE_KEY, accepted ? 'accepted' : 'rejected');

      const analyticsAllowed = api.analyticsProcessingAllowed();
      const marketingAllowed = api.marketingAllowed();
      const preferencesAllowed = api.preferencesProcessingAllowed();
      const saleOfDataAllowed = api.saleOfDataAllowed();

      if (analyticsAllowed) {
        const values = getTrackingValues();
        setShopifyCookies(values, true, getSharedCookieDomain());
      } else {
        setShopifyCookies({}, false, getSharedCookieDomain());
      }

      dispatchConsentEvent({
        analytics: analyticsAllowed,
        marketing: marketingAllowed,
        preferences: preferencesAllowed,
        saleOfData: saleOfDataAllowed,
      });

      setShow(false);
    });
  };

  if (loading || !show) return null;

  return (
    <div
      class="vb-consent-banner"
      role="dialog"
      aria-live="polite"
      aria-label="Cookie consent"
    >
      <div class="vb-consent-banner__inner">
        <p class="vb-consent-banner__text">
          We use cookies to keep your cart safe, understand how the shop is used,
          and keep the lights on. Read more in our{' '}
          <a href="/privacy">Privacy Policy</a>.
        </p>
        <div class="vb-consent-banner__actions">
          <button
            type="button"
            class="vb-btn vb-btn--sm vb-btn--secondary"
            onClick={() => handleConsent(false)}
          >
            Reject
          </button>
          <button
            type="button"
            class="vb-btn vb-btn--sm vb-btn--primary"
            onClick={() => handleConsent(true)}
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}
