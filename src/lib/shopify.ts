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
        "Shopify-Storefront-Private-Token": privateShopifyAccessToken,
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
    throw new Error(`${response.status} ${body}`);
  }

  const json = await response.json();
  if (json.errors) {
    throw new Error(json.errors.map((e: Error) => e.message).join("\n"));
  }

  return json.data as T;
}

// Server-side helper (reads from env, no buyerIP by default)
export async function shopifyFetchServer<T = any>({
  query,
  variables = {},
}: {
  query: string;
  variables?: Record<string, any>;
}): Promise<T> {
  return makeShopifyRequest(query, variables);
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
