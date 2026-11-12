/**
 * Arena3 fetches its packed models before the reel scene mounts, so the clock
 * and the recorder start with every hero already in place. Buffers stay in
 * memory (about 27 MB) so a second recording skips the network.
 */
const store = new Map<string, ArrayBuffer>();

function looksLikeHtml(buf: ArrayBuffer) {
  if (buf.byteLength < 15) return false;
  const head = new TextDecoder().decode(new Uint8Array(buf, 0, Math.min(64, buf.byteLength))).trimStart();
  return head.startsWith("<!") || head.toLowerCase().startsWith("<html") || head.toLowerCase().startsWith("<!doctype");
}

function looksLikeGlb(buf: ArrayBuffer) {
  if (buf.byteLength < 4) return false;
  const mag = new TextDecoder("ascii").decode(new Uint8Array(buf, 0, 4));
  return mag === "glTF";
}

export async function preloadGlbs(urls: readonly string[], onProgress?: (done: number, total: number) => void) {
  let done = 0;
  await Promise.all(
    urls.map(async (url) => {
      if (!store.has(url)) {
        try {
          const res = await fetch(url);
          if (!res.ok) throw new Error(`${url}: ${res.status}`);
          const type = (res.headers.get("content-type") || "").toLowerCase();
          if (type.includes("text/html")) throw new Error(`${url}: HTML geldi (model yok)`);
          const buf = await res.arrayBuffer();
          if (looksLikeHtml(buf) || !looksLikeGlb(buf)) {
            throw new Error(`${url}: GLB değil (SPA/HTML yanıtı)`);
          }
          store.set(url, buf);
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

/** Drop buffers after parse so phones can free ~tens of MB before recording. */
export function releasePreloadedGlbs(urls: readonly string[]) {
  for (const url of urls) store.delete(url);
}
