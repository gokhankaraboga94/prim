/**
 * Arena3 fetches its packed models before the reel scene mounts, so the clock
 * and the recorder start with every hero already in place. Buffers stay in
 * memory (about 27 MB) so a second recording skips the network.
 */
const store = new Map<string, ArrayBuffer>();

export async function preloadGlbs(urls: readonly string[], onProgress?: (done: number, total: number) => void) {
  let done = 0;
  await Promise.all(
    urls.map(async (url) => {
      if (!store.has(url)) {
        try {
          const res = await fetch(url);
          if (!res.ok) throw new Error(`${url}: ${res.status}`);
          store.set(url, await res.arrayBuffer());
        } catch (err) {
          console.warn("arena preload failed", url, err);
        }
      }
      done += 1;
      onProgress?.(done, urls.length);
    })
  );
}

export function preloadedGlb(url: string) {
  return store.get(url);
}
