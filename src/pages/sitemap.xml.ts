import type { APIRoute } from 'astro';
import { shopifyFetchServer } from '../lib/shopify';
import { GET_COLLECTIONS, GET_BLOG_BY_HANDLE } from '../lib/queries';

const SITE_URL = (import.meta.env.PUBLIC_SITE_URL || 'https://vagaboundbooks.com').replace(/\/$/, '');

function formatDate(date: string): string {
  return new Date(date).toISOString().split('T')[0];
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export const GET: APIRoute = async ({ clientAddress }) => {
  const [collectionsData, blogData] = await Promise.all([
    shopifyFetchServer({
      query: GET_COLLECTIONS,
      variables: { first: 50 },
      buyerIP: clientAddress,
    }).catch((err) => {
      console.error('[Sitemap] Failed to fetch collections:', err);
      return null;
    }),
    shopifyFetchServer({
      query: GET_BLOG_BY_HANDLE,
      variables: { handle: 'field-notes', first: 50 },
      buyerIP: clientAddress,
    }).catch((err) => {
      console.error('[Sitemap] Failed to fetch articles:', err);
      return null;
    }),
  ]);

  const collections = (collectionsData?.collections?.edges || [])
    .map((e: any) => e.node)
    .filter((c: any) => c.handle !== 'frontpage');

  const articles = (blogData?.blog?.articles?.edges || [])
    .map((e: any) => e.node);

  const today = new Date().toISOString().split('T')[0];

  const urls = [
    { loc: `${SITE_URL}/`, lastmod: today, priority: '1.0' },
    { loc: `${SITE_URL}/collections/`, lastmod: today, priority: '0.8' },
    { loc: `${SITE_URL}/field-notes/`, lastmod: today, priority: '0.8' },
    { loc: `${SITE_URL}/about/`, lastmod: today, priority: '0.6' },
    { loc: `${SITE_URL}/terms/`, lastmod: today, priority: '0.3' },
    { loc: `${SITE_URL}/privacy/`, lastmod: today, priority: '0.3' },
    ...collections.map((c: any) => ({
      loc: `${SITE_URL}/collections/${c.handle}/`,
      lastmod: c.updatedAt ? formatDate(c.updatedAt) : today,
      priority: '0.7',
    })),
    ...articles.map((a: any) => ({
      loc: `${SITE_URL}/field-notes/${a.handle}/`,
      lastmod: a.publishedAt ? formatDate(a.publishedAt) : today,
      priority: '0.6',
    })),
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((url) => `  <url>
    <loc>${escapeXml(url.loc)}</loc>
    <lastmod>${url.lastmod}</lastmod>
    <priority>${url.priority}</priority>
  </url>`).join('\n')}
</urlset>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
    },
  });
};
