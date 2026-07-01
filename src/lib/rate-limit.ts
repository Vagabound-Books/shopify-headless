// Simple in-memory rate limiter for auth endpoints.
// In production with multiple instances, replace with Redis or a shared store.

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_ATTEMPTS = 5;

function getKey(ip: string, action: string): string {
  return `${ip}:${action}`;
}

export function isRateLimited(ip: string, action: string): boolean {
  const now = Date.now();
  const key = getKey(ip, action);
  const bucket = buckets.get(key);

  if (!bucket || now > bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }

  bucket.count++;
  return bucket.count > MAX_ATTEMPTS;
}

export function getRateLimitReset(ip: string, action: string): number | null {
  const key = getKey(ip, action);
  const bucket = buckets.get(key);
  if (!bucket) return null;
  return bucket.resetAt;
}
