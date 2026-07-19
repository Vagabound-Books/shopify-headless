import type { APIRoute } from 'astro';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { invalidateCollectionCache } from '../../../lib/pagination';

/**
 * Shopify webhook receiver.
 *
 * Verifies the X-Shopify-Hmac-Sha256 header (base64 HMAC-SHA256 of the raw
 * body, keyed with the app's API secret key) and clears the collection
 * light-list cache so product/collection changes show up immediately.
 * The TTL in pagination.ts remains as a fallback.
 *
 * Registered topics: products/* and collections/* (create, update, delete).
 */

function verifySignature(rawBody: string, header: string, secret: string): boolean {
  const digest = createHmac('sha256', secret).update(rawBody, 'utf8').digest('base64');
  const a = Buffer.from(digest, 'utf8');
  const b = Buffer.from(header, 'utf8');
  return a.length === b.length && timingSafeEqual(a, b);
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

  invalidateCollectionCache();
  console.log(`[Webhook] Collection cache cleared (topic=${topic} shop=${shop})`);

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
