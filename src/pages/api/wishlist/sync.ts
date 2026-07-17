import type { APIRoute } from 'astro';
import {
  getCustomerAccountsTokens,
  customerAccountsFetch,
} from '../../../lib/customer-accounts';
import { CUSTOMER_WISHLIST_QUERY, CUSTOMER_WISHLIST_UPDATE } from '../../../lib/queries';

export const POST: APIRoute = async ({ request, cookies }) => {
  const { accessToken } = getCustomerAccountsTokens(cookies);
  if (!accessToken) {
    return new Response(
      JSON.stringify({ error: 'Not authenticated' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }

  let body: Record<string, any>;
  try {
    body = await request.json();
  } catch {
    return new Response(
      JSON.stringify({ error: 'Invalid JSON body' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const items = body.items || [];

  try {
    // metafieldsSet writes against the customer resource, so resolve the id first
    const customerData = await customerAccountsFetch(
      CUSTOMER_WISHLIST_QUERY,
      {},
      accessToken
    );
    const customerId = customerData?.customer?.id;
    if (!customerId) {
      return new Response(
        JSON.stringify({ error: 'Customer not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const data = await customerAccountsFetch(
      CUSTOMER_WISHLIST_UPDATE,
      {
        metafields: [
          {
            ownerId: customerId,
            namespace: 'custom',
            key: 'wishlist',
            value: JSON.stringify(items),
            type: 'json',
          },
        ],
      },
      accessToken
    );

    if (data?.metafieldsSet?.userErrors?.length > 0) {
      return new Response(
        JSON.stringify({ error: data.metafieldsSet.userErrors }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || String(err) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
