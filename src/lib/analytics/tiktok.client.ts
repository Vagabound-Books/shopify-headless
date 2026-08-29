import { getCookieValue } from './cookies';

export function getTtclid(): string | undefined {
  if (typeof document === 'undefined') return undefined;
  return getCookieValue(document.cookie, 'ttclid') || undefined;
}

export function getTtp(): string | undefined {
  if (typeof document === 'undefined') return undefined;
  return getCookieValue(document.cookie, '_ttp') || undefined;
}

export function appendTtclid(url: string): string {
  const ttclid = getTtclid();
  if (!ttclid) return url;
  try {
    const u = new URL(url, typeof window !== 'undefined' ? window.location.href : undefined);
    u.searchParams.set('ttclid', ttclid);
    return u.toString();
  } catch {
    return url;
  }
}
