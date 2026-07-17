# Vagabound — Astro Headless Storefront

A headless rebuild of the Vagabound Books Shopify theme using [Astro](https://astro.build), the Shopify Storefront API, and Preact islands for interactivity.

## Architecture

- **Framework**: Astro 7.x with `output: 'server'` (server-rendered on demand)
- **UI Islands**: Preact 10.x for interactive components (shelf button, cart, shelf page)
- **Data Layer**: Shopify Storefront API (GraphQL)
- **Styling**: Ported directly from the original theme's design system (`theme.css`)
- **Shelf/Wishlist**: Custom localStorage-based implementation (no app dependency)
- **Cart**: Shopify Storefront API cart mutations

## Prerequisites

- Node.js >= 22.12.0
- A Shopify store with:
  - Storefront API access token
  - Admin API access token (for metafield migration only)
  - Products with `app-ibp-book` metafields (to be migrated)

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

```bash
cp .env.example .env
```

Edit `.env`:

```env
SHOPIFY_STORE_DOMAIN=your-store.myshopify.com
SHOPIFY_STOREFRONT_ACCESS_TOKEN=your-storefront-access-token
SHOPIFY_ADMIN_API_ACCESS_TOKEN=your-admin-api-access-token
SHOPIFY_API_VERSION=2024-07
```

**How to get these tokens:**
- **Storefront token**: Shopify Admin → Settings → Apps and sales channels → Develop apps → Create an app → Configuration → Storefront API integration → Install → copy token
- **Admin token**: Same app, but enable Admin API access and copy that token

### 3. Migrate metafields

The original theme uses `app-ibp-book` namespace metafields. The Storefront API can only read `custom` namespace metafields that are explicitly exposed. Run the migration script to copy all book metadata to the `custom` namespace:

```bash
npm run migrate
```

This will:
- Create metafield definitions in the `custom` namespace (cover_palette, genre, authors, publisher, year, binding, pages, provenance)
- Set their storefront access to `PUBLIC_READ`
- Copy values from `app-ibp-book` to `custom` for every product

**Important**: After running this, go to Shopify Admin → Settings → Custom data → Products and verify the metafields have "Storefronts" access enabled.

### 4. Start the dev server

```bash
npm run dev
```

Open http://localhost:4321

## Project Structure

```
astro-storefront/
├── src/
│   ├── components/          # Astro + Preact components
│   │   ├── Header.astro
│   │   ├── Footer.astro
│   │   ├── ProductCard.astro
│   │   ├── ShelfButton.tsx      # Interactive shelf toggle
│   │   ├── AddToCart.tsx        # Interactive add-to-cart
│   │   ├── CartPage.tsx         # Client-side cart rendering
│   │   └── ShelfPage.tsx        # Client-side shelf rendering
│   ├── layouts/
│   │   └── Layout.astro         # Base HTML layout
│   ├── lib/
│   │   ├── shopify.ts           # Storefront API client
│   │   ├── queries.ts           # GraphQL queries/mutations
│   │   ├── metafields.ts        # Metafield parsing helpers
│   │   ├── money.ts             # Currency formatting
│   │   ├── shelf.ts             # Shelf state (localStorage)
│   │   └── cart.ts              # Cart state (Storefront API)
│   ├── pages/
│   │   ├── index.astro          # Homepage
│   │   ├── search.astro         # Search results
│   │   ├── cart.astro           # Cart page
│   │   ├── 404.astro            # Not found
│   │   ├── shelf.astro          # Shelf/wishlist page
│   │   ├── privacy.astro        # Privacy policy
│   │   ├── terms.astro          # Terms of service
│   │   ├── products/[handle].astro
│   │   ├── collections/
│   │   │   ├── index.astro
│   │   │   └── [handle].astro
│   │   ├── blogs/field-notes/
│   │   │   ├── index.astro
│   │   │   └── [handle].astro
│   │   ├── pages/
│   │   │   └── [handle].astro   # Generic Shopify pages
│   │   └── api/
│   │       └── contact.ts       # Contact form endpoint
│   └── styles/
│       ├── theme.css            # Original design system
│       └── swish-theme.css      # Shelf button styles
├── scripts/
│   └── migrate-metafields.ts    # One-time data migration
├── public/assets/               # SVG icons and logos
└── .env
```

## Key Features

### Custom Shelf (Wishlist)

- No third-party app required
- Stores items in `localStorage` with product metadata (title, image, price, genre, authors)
- Shelf button appears on all product cards and product pages
- Shelf page (`/shelf`) renders saved items client-side
- Items persist across sessions on the same device

### Cart

- Uses Shopify Storefront API cart mutations
- Cart ID stored in `localStorage`
- Client-side cart page with remove functionality
- Checkout redirects to Shopify's native checkout

### Search

- Server-rendered search results via Storefront API
- Searches products only
- Same grid layout as collection pages

## Deployment

This project uses `output: 'server'` and requires a hosting platform that supports server-side rendering:

### Recommended: Vercel

```bash
npm install -g vercel
vercel
```

### Alternative: Netlify

```bash
npm install -g netlify-cli
netlify deploy --build
```

### Alternative: Node.js server

```bash
npm run build
node dist/server/entry.mjs
```

**Environment variables must be set on your hosting platform.**

## Migration Checklist

Before going live:

- [ ] Run `npm run migrate` to copy metafields
- [ ] Verify `custom` metafields have storefront access in Shopify Admin
- [ ] Update `.env` with production tokens
- [ ] Set environment variables on hosting platform
- [ ] Create Shopify page: `/pages/visit`
- [ ] Wire up contact form handler (`src/pages/api/contact.ts`) to your email service
- [ ] Test cart checkout flow end-to-end
- [ ] Test shelf add/remove on product pages
- [ ] Verify mobile menu and scroll behaviors

## Differences from Original Theme

| Feature | Original (Liquid) | Headless (Astro) |
|---|---|---|
| Wishlist | Swish Wishlist King app | Custom localStorage shelf |
| Cart | HTML form POSTs | Storefront API mutations |
| Search | Standard Shopify search | Storefront API search query |
| Contact form | Shopify `/contact` form | Custom API endpoint (needs wiring) |
| Newsletter | Shopify customer form | Needs third-party integration |
| Rendering | Liquid server-side | Astro server-side + Preact islands |

## Next Steps / Enhancements

1. **Customer accounts**: Implement Shopify Customer Access Token login
2. **Shelf sync**: Sync shelf to customer metafields when logged in
3. **Newsletter**: Integrate with Klaviyo, Mailchimp, or Shopify customer API
4. **Contact form**: Wire `src/pages/api/contact.ts` to Resend/SendGrid
5. **Related products**: Add collection-based related products to product page
6. **Variant selector**: Build interactive variant picker on product page
7. **Pagination**: Add cursor-based pagination to collection/search pages
8. **OG images**: Generate social share images dynamically
9. **Sitemap**: Add Astro sitemap integration
10. **Analytics**: Add Plausible or Fathom analytics

## License

Same as the original Vagabound theme.
