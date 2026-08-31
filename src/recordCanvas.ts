export const REEL_DURATIONS = [3, 5, 6, 7, 10, 15] as const;
export type ReelDuration = (typeof REEL_DURATIONS)[number];

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
