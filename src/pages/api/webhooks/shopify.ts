import type { APIRoute } from 'astro';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { invalidateCollectionCache } from '../../../lib/pagination';
import {
  buildTikTokEvent,
  sendTikTokEvents,
  sha256,
} from '../../../lib/analytics/tiktok.server';

/**
 * Shopify webhook receiver.
 *
 * Verifies the X-Shopify-Hmac-Sha256 header (base64 HMAC-SHA256 of the raw
 * body, keyed with the app's API secret key) and clears the collection
 * light-list cache so product/collection changes show up immediately.
 * The TTL in pagination.ts remains as a fallback.
 *
 * Registered topics: products/*, collections/* (create, update, delete),
 * and orders/paid for server-side TikTok purchase events.
 */

function verifySignature(rawBody: string, header: string, secret: string): boolean {
  const digest = createHmac('sha256', secret).update(rawBody, 'utf8').digest('base64');
  const a = Buffer.from(digest, 'utf8');
  const b = Buffer.from(header, 'utf8');
  return a.length === b.length && timingSafeEqual(a, b);
}

interface ShopifyWebhookLineItem {
  variant_id?: number;
  product_id?: number;
  quantity?: number;
  price?: string;
  title?: string;
}

interface ShopifyWebhookCustomer {
  id?: number;
  email?: string;
  phone?: string;
}

interface ShopifyWebhookOrder {
  id?: number;
  name?: string;
  created_at?: string;
  total_price?: string;
  currency?: string;
  line_items?: ShopifyWebhookLineItem[];
  customer?: ShopifyWebhookCustomer;
  browser_ip?: string;
  client_details?: { user_agent?: string };
  user_agent?: string;
}

async function handleOrderPaid(order: ShopifyWebhookOrder): Promise<void> {
  const pixelId = import.meta.env.PUBLIC_TIKTOK_PIXEL_ID;
  if (!pixelId) {
    console.error('[Webhook] PUBLIC_TIKTOK_PIXEL_ID is not set.');
    return;
  }

  const eventId = String(order.id ?? order.name ?? '');
  if (!eventId) {
    console.warn('[Webhook] Order webhook missing id/name; skipping TikTok event.');
    return;
  }

  const contents =
    order.line_items?.map((item) => ({
      content_id: String(item.variant_id ?? item.product_id ?? item.title ?? ''),
      content_type: 'product',
      quantity: item.quantity ?? 1,
      price: item.price ? parseFloat(item.price) : undefined,
    })) ?? [];

  const event = buildTikTokEvent({
    pixelId,
    eventName: 'CompletePayment',
    eventId,
    eventTime: order.created_at ? Math.floor(new Date(order.created_at).getTime() / 1000) : undefined,
    user: {
      external_id: order.customer?.id ? String(order.customer.id) : undefined,
      email: order.customer?.email,
      phone: order.customer?.phone,
      client_ip_address: order.browser_ip,
      user_agent: order.user_agent || order.client_details?.user_agent,
    },
    properties: {
      value: order.total_price ? parseFloat(order.total_price) : undefined,
      currency: order.currency,
      contents,
    },
  });

  await sendTikTokEvents([event]);
}

export const POST: APIRoute = async ({ request }) => {
  const secret = import.meta.env.SHOPIFY_WEBHOOK_SECRET;
  if (!secret) {
    console.error('[Webhook] SHOPIFY_WEBHOOK_SECRET is not set — refusing webhooks.');
    return new Response(JSON.stringify({ error: 'Webhook secret not configured.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const hmac = request.headers.get('x-shopify-hmac-sha256');
  const topic = request.headers.get('x-shopify-topic');
  const shop = request.headers.get('x-shopify-shop-domain');

  // Raw body is required for signature verification — do not parse first.
  const rawBody = await request.text();

  if (!hmac || !verifySignature(rawBody, hmac, secret)) {
    console.warn(`[Webhook] Rejected (bad signature) topic=${topic} shop=${shop}`);
    return new Response(JSON.stringify({ error: 'Invalid signature.' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (topic === 'orders/paid') {
    try {
      const order = JSON.parse(rawBody) as ShopifyWebhookOrder;
      await handleOrderPaid(order);
    } catch (err) {
      console.error('[Webhook] Failed to process orders/paid:', err);
    }
  }

  if (topic?.startsWith('products/') || topic?.startsWith('collections/')) {
    invalidateCollectionCache();
    console.log(`[Webhook] Collection cache cleared (topic=${topic} shop=${shop})`);
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};

export const ALL: APIRoute = async () =>
  new Response(JSON.stringify({ error: 'Method not allowed.' }), {
    status: 405,
    headers: { 'Content-Type': 'application/json', Allow: 'POST' },
  });
