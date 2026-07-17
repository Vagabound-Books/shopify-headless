import type { APIRoute } from 'astro';
import {
  getCustomerAccountsTokens,
  getCustomerWishlist,
} from '../../../lib/customer-accounts';

export const GET: APIRoute = async ({ cookies }) => {
  const { accessToken } = getCustomerAccountsTokens(cookies);
  if (!accessToken) {
    return new Response(
      JSON.stringify({ error: 'Not authenticated' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    const items = await getCustomerWishlist(accessToken);
    return new Response(
      JSON.stringify({ items }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('[Wishlist] Failed to fetch cloud wishlist:', err);
    return new Response(
      JSON.stringify({ error: err.message || String(err) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
