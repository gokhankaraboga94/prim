export const WEBGL_BLOCKED =
  "Tarayıcı WebGL'i bu sayfada kapattı. Tüm Chrome pencerelerini kapat, tarayıcıyı tamamen kapatıp aç, sonra elf'i tekrar dene.";

export function webglBlocked(err?: unknown) {
  const text = err instanceof Error ? err.message : String(err ?? "");
  return /WebGL|context could not|creating WebGL/i.test(text);
}

export function webglOpen() {
  try {
    const canvas = document.createElement("canvas");
    const gl =
      canvas.getContext("webgl2", { failIfMajorPerformanceCaveat: false, powerPreference: "default" }) ||
      canvas.getContext("webgl", { failIfMajorPerformanceCaveat: false, powerPreference: "default" });
    return Boolean(gl && !gl.isContextLost());
  } catch {
    return false;
  }
}
