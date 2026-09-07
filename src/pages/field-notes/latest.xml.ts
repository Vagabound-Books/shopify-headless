import type { APIRoute } from 'astro';
import { shopifyFetchServer } from '../../lib/shopify';
import { GET_BLOG_BY_HANDLE, GET_PRODUCTS_BY_IDS } from '../../lib/queries';

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function escapeHtmlAttr(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function toRFC3339(date: string): string {
  const d = new Date(date);
  return d.toISOString();
}

function pickRandom<T>(items: T[], count: number): T[] {
  const pool = [...items];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, count);
}

async function buildFeaturedBooksGallery(
  article: any,
  siteUrl: string,
  buyerIP: string
): Promise<string> {
  const relatedMeta = article.metafields?.find((m: any) => m?.key === 'related_books');
  if (!relatedMeta?.value) return '';

  let ids: string[];
  try {
    ids = JSON.parse(relatedMeta.value);
  } catch {
    return '';
  }

  if (!Array.isArray(ids) || ids.length === 0) return '';

  const productsData = await shopifyFetchServer({
    query: GET_PRODUCTS_BY_IDS,
    variables: { ids },
    buyerIP,
  }).catch((err) => {
    console.error('[RSS] Failed to fetch related books:', err);
    return null;
  });

  const books = (productsData?.nodes || [])
    .filter((p: any) => p?.featuredImage?.url);

  if (books.length === 0) return '';

  const selected = pickRandom(books, 3);

  const imagesHtml = selected
    .map((book: any) => {
      const imageUrl = book.featuredImage.url;
      const alt = escapeHtmlAttr(book.featuredImage.altText || book.title);
      const bookUrl = `${siteUrl}/books/${book.handle}`;
      return `
        <a href="${bookUrl}" style="text-decoration:none;flex:0 0 auto;">
          <img src="${imageUrl}" alt="${alt}" width="180" style="width:100%;max-width:180px;border-radius:8px;display:block;">
        </a>
      `;
    })
    .join('');

  return `
    <div style="margin-top:40px;padding-top:32px;border-top:1px solid #e5e5e5;">
      <h3 style="font-family:Georgia,serif;font-size:20px;margin:0 0 20px;color:#1a1a1a;">Featured books from this dispatch</h3>
      <div style="display:flex;gap:16px;flex-wrap:wrap;justify-content:flex-start;">
        ${imagesHtml}
      </div>
    </div>
  `;
}

export const GET: APIRoute = async ({ request }) => {
  const siteUrl = import.meta.env.PUBLIC_SITE_URL || 'https://vagaboundbooks.com';
  const feedUrl = `${siteUrl}/field-notes/latest.xml`;
  const buyerIP = request.headers.get('x-forwarded-for') || '127.0.0.1';

  const data = await shopifyFetchServer({
    query: GET_BLOG_BY_HANDLE,
    variables: { handle: 'field-notes', first: 1 },
    buyerIP,
  }).catch((err) => {
    console.error('[RSS] Failed to fetch blog:', err);
    return null;
  });

  const article = data?.blog?.articles?.edges?.[0]?.node;

  if (!article) {
    return new Response('<?xml version="1.0" encoding="UTF-8"?><feed xmlns="http://www.w3.org/2005/Atom"><title>Vagabound - Field Notes</title></feed>', {
      status: 200,
      headers: { 'Content-Type': 'application/atom+xml; charset=utf-8' },
    });
  }

  const volumeMeta = article.metafields?.find((m: any) => m?.key === 'volume');
  const volume = volumeMeta?.value || 'I';
  const title = `Field Notes — Volume ${volume}: ${article.title}`;
  const articleUrl = `${siteUrl}/field-notes/${article.handle}`;
  const updatedAt = article.updatedAt || article.publishedAt;

  const galleryHtml = await buildFeaturedBooksGallery(article, siteUrl, buyerIP);
  const content = (article.contentHtml || article.excerptHtml || '') + galleryHtml;

  const feed = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xml:lang="en">
  <id>${feedUrl}</id>
  <link rel="alternate" type="text/html" href="${siteUrl}/field-notes"/>
  <link rel="self" type="application/atom+xml" href="${feedUrl}"/>
  <title>Vagabound - Field Notes</title>
  <updated>${toRFC3339(updatedAt)}</updated>
  <author>
    <name>${escapeXml(article.author?.name || 'The Vagabound')}</name>
  </author>
  <entry>
    <id>${articleUrl}</id>
    <published>${toRFC3339(article.publishedAt)}</published>
    <updated>${toRFC3339(updatedAt)}</updated>
    <link rel="alternate" type="text/html" href="${articleUrl}"/>
    <title>${escapeXml(title)}</title>
    <author>
      <name>${escapeXml(article.author?.name || 'The Vagabound')}</name>
    </author>
    <content type="html">${escapeXml(content)}</content>
  </entry>
</feed>`;

  return new Response(feed, {
    status: 200,
    headers: {
      'Content-Type': 'application/atom+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
    },
  });
};
