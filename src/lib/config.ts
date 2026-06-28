import { z } from "zod";

export const configSchema = z.object({
  shopifyShop: z.string().min(1),
  publicShopifyAccessToken: z.string().min(1),
  privateShopifyAccessToken: z.string().min(1),
  apiVersion: z.string().min(1),
});

function getClientConfig() {
  if (typeof window !== "undefined") {
    const w = window as any;
    if (w.__SHOPIFY_CONFIG__) {
      return {
        shopifyShop: w.__SHOPIFY_CONFIG__.storeDomain || "",
        publicShopifyAccessToken: w.__SHOPIFY_CONFIG__.storefrontAccessToken || "",
        privateShopifyAccessToken: w.__SHOPIFY_CONFIG__.storefrontAccessToken || "",
        apiVersion: w.__SHOPIFY_CONFIG__.apiVersion || "2024-07",
      };
    }
  }
  return null;
}

function getServerConfig() {
  return {
    shopifyShop:
      import.meta.env.PUBLIC_SHOPIFY_SHOP ||
      import.meta.env.SHOPIFY_STORE_DOMAIN ||
      "",
    publicShopifyAccessToken:
      import.meta.env.PUBLIC_SHOPIFY_STOREFRONT_ACCESS_TOKEN ||
      import.meta.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN ||
      "",
    privateShopifyAccessToken:
      import.meta.env.PRIVATE_SHOPIFY_STOREFRONT_ACCESS_TOKEN ||
      import.meta.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN ||
      "",
    apiVersion: import.meta.env.SHOPIFY_API_VERSION || "2024-07",
  };
}

const isSSR = import.meta.env.SSR;
const defineConfig = isSSR ? getServerConfig() : (getClientConfig() ?? getServerConfig());

const parsed = configSchema.safeParse(defineConfig);

if (!parsed.success) {
  console.warn(
    "[Shopify Config] Missing or invalid Shopify environment variables. " +
    "Some features (products, cart) will not work until SHOPIFY_STORE_DOMAIN, " +
    "SHOPIFY_STOREFRONT_ACCESS_TOKEN, and SHOPIFY_API_VERSION are configured."
  );
}

export const config = parsed.success
  ? parsed.data
  : {
      shopifyShop: "",
      publicShopifyAccessToken: "",
      privateShopifyAccessToken: "",
      apiVersion: "2024-07",
    };
