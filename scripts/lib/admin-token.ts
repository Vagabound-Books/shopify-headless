/**
 * Resolve an Admin API access token for scripts.
 *
 * Preferred: mint one via the client credentials grant (SHOPIFY_CLIENT_ID +
 * SHOPIFY_CLIENT_SECRET from the Librarian custom app). Tokens live 24h;
 * scripts simply mint a fresh one per run.
 *
 * Fallback: SHOPIFY_ADMIN_API_ACCESS_TOKEN (Headless channel token).
 */
export async function getAdminToken(shopDomain: string): Promise<string> {
  const clientId = process.env.SHOPIFY_CLIENT_ID;
  const clientSecret = process.env.SHOPIFY_CLIENT_SECRET;

  if (clientId && clientSecret) {
    const response = await fetch(`https://${shopDomain}/admin/oauth/access_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `grant_type=client_credentials&client_id=${clientId}&client_secret=${clientSecret}`,
    });

    if (!response.ok) {
      throw new Error(`Token mint failed: ${response.status} ${await response.text()}`);
    }

    const json = await response.json();
    return json.access_token as string;
  }

  const fallback = process.env.SHOPIFY_ADMIN_API_ACCESS_TOKEN;
  if (!fallback) {
    throw new Error(
      'No Admin token available: set SHOPIFY_CLIENT_ID + SHOPIFY_CLIENT_SECRET, ' +
      'or SHOPIFY_ADMIN_API_ACCESS_TOKEN.'
    );
  }
  return fallback;
}
