import type { APIRoute } from 'astro';
import { config } from '../../../lib/config';
import {
  createTrackingContext,
  getTrackingHeaders,
  collectTrackingResponseHeaders,
  buildServerTimingHeader,
  trackingStorage,
} from '../../../lib/analytics/trackingContext';

const FORWARD_REQUEST_HEADERS = [
  'accept',
  'accept-encoding',
  'accept-language',
  'access-control-request-headers',
  'access-control-request-method',
  'content-type',
  'content-length',
  'cookie',
  'origin',
  'referer',
  'user-agent',
  'x-shopify-unique-token',
  'x-shopify-visit-token',
];

const FORWARD_RESPONSE_HEADERS = [
  'content-type',
  'content-length',
  'server-timing',
  'x-request-id',
];

export const POST: APIRoute = async ({ request, params }) => {
  const version = params.version;
  if (!version || typeof version !== 'string') {
    return new Response(JSON.stringify({ error: 'Missing API version' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    });
  }

  const shopifyDomain = config.shopifyShop;
  if (!shopifyDomain) {
    return new Response(JSON.stringify({ error: 'Shopify domain not configured' }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }

  const trackingContext = createTrackingContext(request);

  return trackingStorage.run(trackingContext, async () => {
    const url = `https://${shopifyDomain}/api/${version}/graphql.json`;

    const forwardHeaders = new Headers();

    for (const headerName of FORWARD_REQUEST_HEADERS) {
      const value = request.headers.get(headerName);
      if (value) {
        forwardHeaders.set(headerName, value);
      }
    }

    // Ensure the public access token is present
    if (!forwardHeaders.has('x-shopify-storefront-access-token')) {
      forwardHeaders.set(
        'x-shopify-storefront-access-token',
        config.publicShopifyAccessToken,
      );
    }

    // Inject generated or existing tracking tokens
    const trackingHeaders = getTrackingHeaders();
    for (const [key, value] of Object.entries(trackingHeaders)) {
      forwardHeaders.set(key, value);
    }

    // Forward client IP if available
    const clientIp =
      request.headers.get('x-forwarded-for') ||
      request.headers.get('x-real-ip');
    if (clientIp) {
      forwardHeaders.set('x-forwarded-for', clientIp);
    }

    try {
      const shopifyResponse = await fetch(url, {
        method: 'POST',
        headers: forwardHeaders,
        body: request.body,
        // @ts-expect-error Node fetch requires duplex when streaming a request body
        duplex: 'half',
      });

      collectTrackingResponseHeaders(shopifyResponse);

      const responseHeaders = new Headers();

      for (const headerName of FORWARD_RESPONSE_HEADERS) {
        const value = shopifyResponse.headers.get(headerName);
        if (value) {
          responseHeaders.set(headerName, value);
        }
      }

      // Forward any Set-Cookie headers from Shopify
      try {
        const setCookies = shopifyResponse.headers.getSetCookie();
        for (const cookie of setCookies) {
          responseHeaders.append('set-cookie', cookie);
        }
      } catch {
        const setCookie = shopifyResponse.headers.get('set-cookie');
        if (setCookie) {
          responseHeaders.set('set-cookie', setCookie);
        }
      }

      // Inject our own server-timing header with the tokens we generated/used
      const serverTiming = buildServerTimingHeader(trackingContext);
      if (serverTiming) {
        responseHeaders.set('server-timing', serverTiming);
      }

      // CORS: allow the storefront origin
      const origin = request.headers.get('origin');
      if (origin) {
        responseHeaders.set('access-control-allow-origin', origin);
        responseHeaders.set('access-control-allow-credentials', 'true');
      }

      return new Response(shopifyResponse.body, {
        status: shopifyResponse.status,
        statusText: shopifyResponse.statusText,
        headers: responseHeaders,
      });
    } catch (error) {
      console.error('[Shopify Proxy] Error forwarding request:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to proxy Shopify request' }),
        {
          status: 502,
          headers: { 'content-type': 'application/json' },
        },
      );
    }
  });
};
