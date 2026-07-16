import type { APIRoute } from 'astro';
import { shopifyFetchServer } from '../../../lib/shopify';
import { GET_PRODUCTS_BY_HANDLES } from '../../../lib/queries';

export const POST: APIRoute = async ({ request, clientAddress }) => {
  let body: { handles?: string[] };
  try {
    body = await request.json();
  } catch {
    return new Response(
      JSON.stringify({ error: 'Invalid JSON body' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const handles = (body.handles || []).filter(Boolean);
  if (handles.length === 0) {
    return new Response(
      JSON.stringify({ products: [] }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const query = handles.map((h) => `handle:${h}`).join(' OR ');

  try {
    const data = await shopifyFetchServer({
      query: GET_PRODUCTS_BY_HANDLES,
      variables: { query, first: handles.length },
      buyerIP: clientAddress || '',
    });

    const products = (data?.products?.edges || []).map((e: any) => e.node);

    return new Response(
      JSON.stringify({ products }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('[Shelf API] Failed to fetch products:', err);
    return new Response(
      JSON.stringify({ error: err.message || String(err) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
