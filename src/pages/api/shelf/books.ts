import type { APIRoute } from 'astro';
import { shopifyFetchServer } from '../../../lib/shopify';
import { PRODUCT_FRAGMENT } from '../../../lib/queries';

function buildHandlesQuery(handles: string[]): { query: string; variables: Record<string, unknown> } {
  const uniqueHandles = Array.from(new Set(handles.filter(Boolean)));
  const aliases: string[] = [];
  const variables: Record<string, unknown> = {};
  for (let i = 0; i < uniqueHandles.length; i++) {
    const varName = `handle${i}`;
    aliases.push(`product${i}: product(handle: $${varName}) { ...productFields }`);
    variables[varName] = uniqueHandles[i];
  }
  const query = `
    ${PRODUCT_FRAGMENT}
    query GetProductsByHandles(${Object.keys(variables).map((k) => `$${k}: String!`).join(', ')}) {
      ${aliases.join('\n      ')}
    }
  `;
  return { query, variables };
}

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

  console.log(`[Shelf API] Fetching ${handles.length} product(s): ${handles.join(', ')}`);

  try {
    const { query, variables } = buildHandlesQuery(handles);
    const data = await shopifyFetchServer({
      query,
      variables,
      buyerIP: clientAddress || '',
    });

    const products = Object.values(data || {}).filter(Boolean);
    console.log(`[Shelf API] Returning ${products.length} product(s)`);

    return new Response(
      JSON.stringify({ products }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('[Shelf API] Failed to fetch products:', err);
    return new Response(
      JSON.stringify({ error: err.message || String(err), handles }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
