// JSON kept in the browser's Cache Storage for reading without internet:
// chapters a child saved for offline ("⬇️ Save offline" on a book) and the
// last chapter list of their class. backendApi falls back to these when a
// request fails (no network, or the sign-in token can't be refreshed).
const CACHE = 'ps-books-v1';
const keyUrl = (key: string) => `${location.origin}/__offline__/${key}`;
const hasCaches = () => typeof caches !== 'undefined';

export async function putOffline(key: string, data: unknown): Promise<number> {
  if (!hasCaches()) return 0;
  const body = JSON.stringify(data);
  const cache = await caches.open(CACHE);
  await cache.put(keyUrl(key), new Response(body, { headers: { 'Content-Type': 'application/json' } }));
  return body.length;
}

export async function getOffline<T>(key: string): Promise<T | null> {
  if (!hasCaches()) return null;
  try {
    const cache = await caches.open(CACHE);
    const res = await cache.match(keyUrl(key));
    return res ? ((await res.json()) as T) : null;
  } catch {
    return null;
  }
}

export async function deleteOffline(keys: string[]) {
  if (!hasCaches()) return;
  const cache = await caches.open(CACHE);
  await Promise.all(keys.map((k) => cache.delete(keyUrl(k))));
}

/**
 * Network first; when it fails, the copy saved on this device (if any).
 * `save` keeps a fresh copy of what came from the network (used for lists).
 */
export async function withOffline<T>(key: string, fetcher: () => Promise<T>, opts: { save?: boolean } = {}): Promise<T> {
  try {
    const data = await fetcher();
    if (opts.save) void putOffline(key, data).catch(() => undefined);
    return data;
  } catch (error) {
    const saved = await getOffline<T>(key);
    if (saved) return { ...(saved as any), offline: true };
    throw error;
  }
}
