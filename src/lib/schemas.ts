import { z } from "zod";

export const MoneyV2Result = z.object({
  amount: z.string(),
  currencyCode: z.string(),
});

export const ImageResult = z
  .object({
    altText: z.string().nullable().optional(),
    url: z.string(),
    width: z.number().positive().int().optional(),
    height: z.number().positive().int().optional(),
  })
  .nullable();

export const SelectedOptionResult = z.object({
  name: z.string(),
  value: z.string(),
});

export const VariantResult = z.object({
  id: z.string(),
  title: z.string(),
  availableForSale: z.boolean(),
  price: MoneyV2Result,
  compareAtPrice: MoneyV2Result.nullable().optional(),
  selectedOptions: z.array(SelectedOptionResult).optional(),
  sku: z.string().optional(),
});

export const MetafieldResult = z.object({
  namespace: z.string(),
  key: z.string(),
  value: z.string(),
  type: z.string(),
});

export const ProductResult = z
  .object({
    id: z.string(),
    title: z.string(),
    handle: z.string(),
    description: z.string().nullable().optional(),
    descriptionHtml: z.string().nullable().optional(),
    vendor: z.string().nullable().optional(),
    priceRange: z.object({
      minVariantPrice: MoneyV2Result,
      maxVariantPrice: MoneyV2Result,
    }),
    compareAtPriceRange: z
      .object({
        minVariantPrice: MoneyV2Result,
        maxVariantPrice: MoneyV2Result,
      })
      .optional(),
    images: z.object({
      edges: z.array(
        z.object({
          node: ImageResult,
        })
      ),
    }),
    variants: z.object({
      edges: z.array(
        z.object({
          node: VariantResult,
        })
      ),
    }),
    featuredImage: ImageResult.nullable().optional(),
    metafields: z.array(MetafieldResult.nullable()).nullable().optional(),
  })
  .nullable();

export const CartItemResult = z.object({
  id: z.string(),
  cost: z.object({
    amountPerQuantity: MoneyV2Result,
    subtotalAmount: MoneyV2Result,
    totalAmount: MoneyV2Result,
  }),
  merchandise: z.object({
    id: z.string(),
    title: z.string(),
    product: z.object({
      title: z.string(),
      handle: z.string(),
    }),
    image: ImageResult.nullable().optional(),
  }),
  quantity: z.number().positive().int(),
});

export const CartResult = z
  .object({
    id: z.string(),
    cost: z.object({
      subtotalAmount: MoneyV2Result,
      totalAmount: MoneyV2Result.optional(),
    }),
    checkoutUrl: z.string(),
    totalQuantity: z.number().int(),
    lines: z.object({
      edges: z.array(
        z.object({
          node: CartItemResult,
        })
      ),
    }),
  })
  .nullable();

export const CollectionResult = z.object({
  id: z.string(),
  title: z.string(),
  handle: z.string(),
  descriptionHtml: z.string().nullable().optional(),
  image: ImageResult.nullable().optional(),
  products: z.object({
    pageInfo: z.object({
      hasNextPage: z.boolean(),
      endCursor: z.string().nullable().optional(),
    }),
    edges: z.array(
      z.object({
        node: ProductResult,
      })
    ),
  }),
});

export const PageResult = z.object({
  id: z.string(),
  title: z.string(),
  body: z.string().nullable().optional(),
});

export const BlogArticleResult = z.object({
  id: z.string(),
  title: z.string(),
  handle: z.string(),
  excerptHtml: z.string().nullable().optional(),
  publishedAt: z.string(),
  image: ImageResult.nullable().optional(),
  author: z.object({ name: z.string() }).nullable().optional(),
});

export const BlogResult = z.object({
  id: z.string(),
  title: z.string(),
  articles: z.object({
    edges: z.array(
      z.object({
        node: BlogArticleResult,
      })
    ),
  }),
});
