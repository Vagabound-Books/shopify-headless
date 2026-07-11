import { config } from "./config";
import { CartResult, ProductResult } from "./schemas";
import {
  GET_PRODUCT_BY_HANDLE,
  GET_CART,
  CREATE_CART,
  ADD_TO_CART,
  REMOVE_FROM_CART,
} from "./queries";

// Make a request to Shopify's GraphQL API and return the data object from the response body as JSON data.
export async function makeShopifyRequest<T = any>(
  query: string,
  variables: Record<string, unknown> = {},
  buyerIP: string = ""
): Promise<T> {
  const isSSR = import.meta.env.SSR;
  const apiUrl = `https://${config.shopifyShop}/api/${config.apiVersion}/graphql.json`;

  function getOptions(): RequestInit {
    if (isSSR && !buyerIP) {
      console.error(
        `No buyer IP provided => make sure to pass the buyer IP when making a server side Shopify request.`
      );
    }

    const { privateShopifyAccessToken, publicShopifyAccessToken } = config;
    const options: RequestInit = {
      method: "POST",
      headers: {},
      body: JSON.stringify({ query, variables }),
    };

    if (isSSR) {
      options.headers = {
        "Content-Type": "application/json",
        "X-Shopify-Storefront-Access-Token": privateShopifyAccessToken,
        ...(buyerIP ? { "Shopify-Storefront-Buyer-IP": buyerIP } : {}),
      };
    } else {
      options.headers = {
        "Content-Type": "application/json",
        "X-Shopify-Storefront-Access-Token": publicShopifyAccessToken,
      };
    }

    return options;
  }

  const response = await fetch(apiUrl, getOptions());

  if (!response.ok) {
    const body = await response.text();
    console.error(`[Shopify] HTTP ${response.status}: ${body}`);
    throw new Error(`${response.status} ${body}`);
  }

  const json = await response.json();
  if (json.errors) {
    const messages = json.errors.map((e: Error) => e.message).join("\n");
    console.error(`[Shopify] GraphQL errors: ${messages}`);
    throw new Error(messages);
  }

  return json.data as T;
}

// Server-side helper (reads from env)
export async function shopifyFetchServer<T = any>({
  query,
  variables = {},
  buyerIP = "",
}: {
  query: string;
  variables?: Record<string, any>;
  buyerIP?: string;
}): Promise<T> {
  return makeShopifyRequest(query, variables, buyerIP);
}

// Client-side helper (uses public token)
export async function shopifyFetchClient<T = any>({
  query,
  variables = {},
}: {
  query: string;
  variables?: Record<string, any>;
}): Promise<T> {
  return makeShopifyRequest(query, variables);
}

// Cart helpers using the new request client
export async function createCart(id: string, quantity: number) {
  const data = await makeShopifyRequest(CREATE_CART, { lines: [{ merchandiseId: id, quantity }] });
  const { cartCreate } = data;
  if (cartCreate.userErrors?.length > 0) {
    const messages = cartCreate.userErrors.map((e: any) => e.message).join(', ');
    throw new Error(messages);
  }
  const { cart } = cartCreate;
  const parsedCart = CartResult.parse(cart);
  return parsedCart;
}

export async function addCartLines(
  cartId: string,
  merchandiseId: string,
  quantity: number
) {
  const data = await makeShopifyRequest(ADD_TO_CART, {
    cartId,
    lines: [{ merchandiseId, quantity }],
  });
  const { cartLinesAdd } = data;
  if (cartLinesAdd.userErrors?.length > 0) {
    const messages = cartLinesAdd.userErrors.map((e: any) => e.message).join(', ');
    throw new Error(messages);
  }
  const { cart } = cartLinesAdd;
  const parsedCart = CartResult.parse(cart);
  return parsedCart;
}

export async function removeCartLines(cartId: string, lineIds: string[]) {
  const data = await makeShopifyRequest(REMOVE_FROM_CART, {
    cartId,
    lineIds,
  });
  const { cartLinesRemove } = data;
  if (cartLinesRemove.userErrors?.length > 0) {
    const messages = cartLinesRemove.userErrors.map((e: any) => e.message).join(', ');
    throw new Error(messages);
  }
  const { cart } = cartLinesRemove;
  const parsedCart = CartResult.parse(cart);
  return parsedCart;
}

export async function getCart(id: string) {
  const data = await makeShopifyRequest(GET_CART, { id });
  const { cart } = data;
  const parsedCart = CartResult.parse(cart);
  return parsedCart;
}

// Product helpers
export async function getProductByHandle(options: {
  handle: string;
  buyerIP?: string;
}) {
  const { handle, buyerIP = "" } = options;
  const data = await makeShopifyRequest(GET_PRODUCT_BY_HANDLE, { handle }, buyerIP);
  const { product } = data;
  const parsedProduct = ProductResult.parse(product);
  return parsedProduct;
}

/**
 * Normalize a Shopify checkout URL to use the checkout subdomain.
 * Shopify returns checkout URLs like:
 *   https://vagabound-books.myshopify.com/cart/c/...
 * We rewrite them to:
 *   https://checkout.vagaboundbooks.com/cart/c/...
 * so checkout traffic goes to Shopify while the storefront stays separate.
 */
export function normalizeCheckoutUrl(url: string): string {
  if (!url) return url;
  // Rewrite both the myshopify origin and the primary custom domain
  // to the dedicated checkout subdomain.
  return url
    .replace(/^https:\/\/vagabound-books\.myshopify\.com/, 'https://checkout.vagaboundbooks.com')
    .replace(/^https:\/\/vagaboundbooks\.com/, 'https://checkout.vagaboundbooks.com');
}
