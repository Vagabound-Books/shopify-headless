## Development

When starting the dev server, use background mode:

```
astro dev --background
```

Manage the background server with `astro dev stop`, `astro dev status`, and `astro dev logs`.

## Documentation

Full documentation: https://docs.astro.build

Consult these guides before working on related tasks:

- [Adding pages, dynamic routes, or middleware](https://docs.astro.build/en/guides/routing/)
- [Working with Astro components](https://docs.astro.build/en/basics/astro-components/)
- [Using React, Vue, Svelte, or other framework components](https://docs.astro.build/en/guides/framework-components/)
- [Adding or managing content](https://docs.astro.build/en/guides/content-collections/)
- [Adding styles or using Tailwind](https://docs.astro.build/en/guides/styling/)
- [Supporting multiple languages](https://docs.astro.build/en/guides/internationalization/)

## Shopify Analytics Gotchas

- `SHOPIFY_SHOP_ID` must be provided as a Shopify GID (`gid://shopify/Shop/<id>`) in the analytics config injected into the page. Raw numeric shop IDs are normalized to this GID format in `src/components/ShopifyAnalyticsInit.astro` before being serialized to `window.__VB_ANALYTICS__`. If a raw number is passed, Monorail may reject `trekkie_storefront_page_view/1.4` events with `shopId: no value provided for required field`.
