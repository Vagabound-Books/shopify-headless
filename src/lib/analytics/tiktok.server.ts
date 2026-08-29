import { createHash } from 'node:crypto';

export const TIKTOK_EVENTS_API_URL =
  'https://business-api.tiktok.com/open_api/v1.3/event/track/';

export interface TikTokUser {
  external_id?: string;
  email?: string;
  phone?: string;
  client_ip_address?: string;
  user_agent?: string;
  ttclid?: string;
  ttp?: string;
}

export interface TikTokContent {
  content_id: string;
  content_type: string;
  quantity?: number;
  price?: number;
}

export interface TikTokProperties {
  value?: number;
  currency?: string;
  contents?: TikTokContent[];
  content_type?: string;
  content_id?: string;
  description?: string;
  status?: string;
  page_url?: string;
  referrer?: string;
}

export interface TikTokEvent {
  event_source: 'WEB';
  event_source_id: string;
  event_name: string;
  event_id: string;
  event_time: number;
  user: TikTokUser;
  properties?: TikTokProperties;
  test_event_code?: string;
}

export interface TikTokEventPayload {
  event_source?: string;
  event_source_id?: string;
  data: TikTokEvent[];
  test_event_code?: string;
}

export function sha256(value: string | undefined): string | undefined {
  if (!value) return undefined;
  return createHash('sha256')
    .update(String(value).trim().toLowerCase())
    .digest('hex');
}

export function parseTrackingConsent(
  raw: string | undefined,
): { analytics: boolean; marketing: boolean; preferences: boolean; saleOfData: boolean } {
  const denied = { analytics: false, marketing: false, preferences: false, saleOfData: false };
  if (!raw) return denied;
  try {
    const parsed = JSON.parse(decodeURIComponent(raw));
    const cmp = parsed?.con?.CMP || parsed?.CMP || {};
    return {
      analytics: cmp.a === 'yes',
      marketing: cmp.m === 'yes',
      preferences: cmp.p === 'yes',
      saleOfData: cmp.s === 'yes',
    };
  } catch {
    return denied;
  }
}

export function buildTikTokEvent(options: {
  pixelId: string;
  eventName: string;
  eventId: string;
  eventTime?: number;
  user: TikTokUser;
  properties?: TikTokProperties;
  testEventCode?: string;
}): TikTokEvent {
  const { pixelId, eventName, eventId, eventTime, user, properties, testEventCode } = options;
  const event: TikTokEvent = {
    event_source: 'WEB',
    event_source_id: pixelId,
    event_name: eventName,
    event_id: eventId,
    event_time: eventTime ?? Math.floor(Date.now() / 1000),
    user: {
      external_id: user.external_id ? sha256(user.external_id) : undefined,
      email: user.email ? sha256(user.email) : undefined,
      phone: user.phone ? sha256(user.phone) : undefined,
      client_ip_address: user.client_ip_address,
      user_agent: user.user_agent,
      ttclid: user.ttclid,
      ttp: user.ttp,
    },
    properties,
  };
  if (testEventCode) {
    event.test_event_code = testEventCode;
  }
  return event;
}

export async function sendTikTokEvents(events: TikTokEvent[]): Promise<void> {
  const token = import.meta.env.TIKTOK_ACCESS_TOKEN;
  const testEventCode = import.meta.env.TIKTOK_TEST_EVENT_CODE;
  if (!token) {
    console.error('[TikTok Events API] TIKTOK_ACCESS_TOKEN is not set.');
    return;
  }
  if (events.length === 0) return;

  const payload: TikTokEventPayload = {
    event_source: 'WEB',
    event_source_id: events[0].event_source_id,
    data: events,
  };
  if (testEventCode) {
    payload.test_event_code = testEventCode;
  }

  try {
    const response = await fetch(TIKTOK_EVENTS_API_URL, {
      method: 'POST',
      headers: {
        'Access-Token': token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`TikTok Events API HTTP ${response.status}: ${text}`);
    }
  } catch (err) {
    console.error('[TikTok Events API] send failed:', err);
  }
}
