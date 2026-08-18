import type { APIRoute } from 'astro';
import { shopifyFetchServer } from '../../lib/shopify';
import { GET_BLOG_BY_HANDLE } from '../../lib/queries';

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function toRFC3339(date: string): string {
  const d = new Date(date);
  return d.toISOString();
}

export const GET: APIRoute = async ({ request }) => {
  const siteUrl = import.meta.env.PUBLIC_SITE_URL || 'https://vagaboundbooks.com';
  const feedUrl = `${siteUrl}/field-notes/latest.xml`;

  const data = await shopifyFetchServer({
    query: GET_BLOG_BY_HANDLE,
    variables: { handle: 'field-notes', first: 1 },
    buyerIP: request.headers.get('x-forwarded-for') || '127.0.0.1',
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
  const content = article.contentHtml || article.excerptHtml || '';
  const updatedAt = article.updatedAt || article.publishedAt;

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
