import type { APIRoute } from 'astro';
import {
  createTrackingContext,
  trackingStorage,
} from '../../../lib/analytics/trackingContext.server';
import { getCookieValue, TRACKING_CONSENT } from '../../../lib/analytics/cookies';
import {
  buildTikTokEvent,
  parseTrackingConsent,
  sendTikTokEvents,
  type TikTokProperties,
  type TikTokUser,
} from '../../../lib/analytics/tiktok.server';

export const POST: APIRoute = async ({ request, clientAddress }) => {
  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const eventName = body.eventName;
  const eventId = body.eventId;
  if (!eventName || !eventId || typeof eventName !== 'string' || typeof eventId !== 'string') {
    return new Response(JSON.stringify({ error: 'Missing eventName or eventId.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const cookieHeader = request.headers.get('cookie') || '';
  const consentRaw = getCookieValue(cookieHeader, TRACKING_CONSENT);
  const consent = parseTrackingConsent(consentRaw);
  if (!consent.analytics) {
    return new Response(null, { status: 204 });
  }

  await trackingStorage.run(createTrackingContext(request), async () => {
    const pixelId = import.meta.env.PUBLIC_TIKTOK_PIXEL_ID;
    if (!pixelId) {
      console.error('[TikTok API] PUBLIC_TIKTOK_PIXEL_ID is not set.');
      return;
    }

    const forwarded = request.headers.get('x-forwarded-for');
    const ip =
      clientAddress || (forwarded ? forwarded.split(',')[0].trim() : undefined);
    const userAgent = request.headers.get('user-agent') || undefined;
    const ttclid = getCookieValue(cookieHeader, 'ttclid') || undefined;
    const ttp = getCookieValue(cookieHeader, '_ttp') || undefined;

    const user: TikTokUser = {
      external_id: typeof body.externalId === 'string' ? body.externalId : undefined,
      email: typeof body.email === 'string' ? body.email : undefined,
      phone: typeof body.phone === 'string' ? body.phone : undefined,
      client_ip_address: ip,
      user_agent: userAgent,
      ttclid,
      ttp,
    };

    const properties = (body.properties ?? {}) as TikTokProperties;
    if (typeof body.url === 'string') properties.page_url = body.url;
    if (typeof body.referrer === 'string') properties.referrer = body.referrer;

    const eventTime =
      typeof body.eventTime === 'number' ? body.eventTime : Math.floor(Date.now() / 1000);

    const event = buildTikTokEvent({
      pixelId,
      eventName,
      eventId,
      eventTime,
      user,
      properties,
    });

    await sendTikTokEvents([event]);
  });

  return new Response(null, { status: 204 });
};

export const ALL: APIRoute = async () =>
  new Response(JSON.stringify({ error: 'Method not allowed.' }), {
    status: 405,
    headers: { 'Content-Type': 'application/json', Allow: 'POST' },
  });
