import { REEL_SALLY_AT, REEL_SWORD_START, SWORD_SWING } from "./siegeEvent";

export const REEL_DURATIONS = [3, 5, 6, 7, 10, 15] as const;
export type ReelDuration = (typeof REEL_DURATIONS)[number];

/** Warmup before MediaRecorder starts — keep in sync with ReelCapture wait. */
export const REEL_HOLD = 1.05;

export function reelFade(duration: number) {
  return Math.min(1.15, Math.max(0.6, duration * 0.14));
}

/** Face hold until the sword is up, then a short army beat, then a long pull. */
export function reelBeats(duration: number) {
  const fade = reelFade(duration);
  const cmd = REEL_SWORD_START - REEL_SALLY_AT + SWORD_SWING * 0.3;
  const turn = Math.min(0.95, Math.max(0.62, duration * 0.08));
  const army = Math.min(1.8, Math.max(0.65, duration * 0.12));
  let pullStart = cmd + turn + army;
  const pullFloor = duration - Math.max(1.2, fade + 0.55);
  if (pullStart > pullFloor) pullStart = Math.max(cmd + turn + 0.4, pullFloor);
  return { cmd, turn, army: pullStart - cmd - turn, pullStart, fade };
}

export function reelHook(duration: number) {
  const b = reelBeats(duration);
  return b.cmd + b.turn * 0.35;
}

export function reelZoomDur(duration: number) {
  const b = reelBeats(duration);
  return Math.max(0.8, duration - b.pullStart - b.fade * 0.4);
}

/** Full-black hold after the fade so the recorder doesn't cut mid-grey. */
export const REEL_FADE_HOLD = 0.15;

function pickMime() {
  if (typeof MediaRecorder === "undefined") return "";
  const types = [
    "video/mp4",
    "video/mp4;codecs=avc1.42E01E",
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8",
    "video/webm",
  ];
  return types.find((t) => MediaRecorder.isTypeSupported(t)) || "";
}

export function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export async function recordCanvas(canvas: HTMLCanvasElement, seconds: number) {
  const mime = pickMime();
  if (!mime) throw new Error("Bu tarayıcı video kaydını desteklemiyor. Safari veya Chrome dene.");
  const stream = canvas.captureStream(30);
  const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 8_000_000 });
  const chunks: BlobPart[] = [];
  rec.ondataavailable = (e) => {
    if (e.data.size) chunks.push(e.data);
  };
  const done = new Promise<Blob>((resolve, reject) => {
    rec.onerror = () => reject(new Error("Kayıt hata verdi."));
    rec.onstop = () => resolve(new Blob(chunks, { type: rec.mimeType || mime }));
  });
  rec.start(250);
  await wait(Math.max(1000, seconds * 1000));
  if (rec.state !== "inactive") rec.stop();
  stream.getTracks().forEach((track) => track.stop());
  const blob = await done;
  if (!blob.size) throw new Error("Kayıt boş geldi. Sayfayı yenileyip tekrar dene.");
  return blob;
}

export async function saveReelBlob(blob: Blob, seconds: number) {
  const ext = blob.type.includes("mp4") ? "mp4" : "webm";
  const file = new File([blob], `kusatma-${seconds}s.${ext}`, { type: blob.type || `video/${ext}` });
  const nav = navigator as Navigator & { canShare?: (data: ShareData) => boolean };
  if (typeof nav.canShare === "function" && nav.canShare({ files: [file] })) {
    await navigator.share({ files: [file], title: "Kuşatma kaydı" });
    return;
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.name;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 8000);
}
