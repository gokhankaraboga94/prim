import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import * as THREE from "three";

const PROMPT = `Create a mesmerizing 10-second seamless looping vertical video, 9:16, photorealistic 3D.

SUBJECT:
A single thick broken metal ring centered on a pure black background. The ring has one clear gap between two sharp ends. Nothing else in the scene. No text, no people, no logos, no extra objects.

THE HOOK — FIRST 0.5 SECONDS:
The very first frame already shows the two ends moving toward each other.
The gap is large, obvious, and dead-center on screen — roughly 15–20% of the frame width.
The ring fills most of the frame. Fixed camera. No fade-in, no intro, no empty frame.
Motion is already happening. The viewer must instantly feel: “they are about to touch.”

0.5–3.0 SECONDS (MUST HOLD ATTENTION):
The gap shrinks slowly and continuously, never stopping.
By 2.0s the gap is tiny — about 1–2 mm — clearly unfinished.
By 3.0s the ends are almost touching but still NOT touching.
No cuts, no camera move, no distraction. Only the closing gap.

3.0–8.0 SECONDS:
Extremely slow approach. Micro-movement only.
The tension is the unfinished contact.
Reflections on brushed metal, crisp studio lighting, sharp edges.

8.0–10.0 SECONDS (LOOP):
At the exact moment they should touch, the ends slip past / miss by a hair / reset to the opening gap position.
Final frame must match the first frame exactly: same gap size, same end positions, same lighting, same camera, continuous motion across the loop.

STYLE:
Ultra-realistic polished metal, black void background, macro close-up, fixed camera, smooth hypnotic motion, no motion blur that hides the gap, no jitter, no morphing into other shapes.`;

const DURATION = 10;
const FPS = 30;
const W = 720;
const H = 1280;
const R = 1.55;
const TUBE = 0.16;
const SEG = 96;
const START_GAP = 0.72;
const NEAR_GAP = 0.028;

function gapAt(t: number) {
  const x = ((t % DURATION) + DURATION) % DURATION;
  if (x <= 8) {
    const u = x / 8;
    const e = 1 - Math.pow(1 - u, 2.35);
    return START_GAP + (NEAR_GAP - START_GAP) * e;
  }
  const u = (x - 8) / 2;
  const e = u * u * (3 - 2 * u);
  return NEAR_GAP + (START_GAP - NEAR_GAP) * e;
}

function pickMime() {
  const opts = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"];
  for (const m of opts) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(m)) return m;
  }
  return "";
}

export function UretPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engine = useRef<{
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    ringGroup: THREE.Group;
    metal: THREE.MeshStandardMaterial;
    ringMesh: THREE.Mesh | null;
    capA: THREE.Mesh | null;
    capB: THREE.Mesh | null;
    previewRaf: number;
    previewT0: number;
    busy: boolean;
  } | null>(null);
  const [hud, setHud] = useState("Hazır");
  const [busy, setBusy] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      preserveDrawingBuffer: true,
    });
    renderer.setPixelRatio(1);
    renderer.setSize(W, H, false);
    renderer.setClearColor(0x000000, 1);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, W / H, 0.1, 100);
    camera.position.set(0, 0, 6.2);
    camera.lookAt(0, 0, 0);

    const key = new THREE.DirectionalLight(0xffffff, 2.4);
    key.position.set(3.2, 4.5, 5.5);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xb8c4ff, 0.55);
    fill.position.set(-4, -1, 2);
    scene.add(fill);
    const rim = new THREE.DirectionalLight(0xffffff, 1.1);
    rim.position.set(-2, 3, -4);
    scene.add(rim);
    scene.add(new THREE.AmbientLight(0xffffff, 0.18));

    const metal = new THREE.MeshStandardMaterial({
      color: 0xc9ccd3,
      metalness: 1,
      roughness: 0.22,
    });
    const ringGroup = new THREE.Group();
    scene.add(ringGroup);

    const state = {
      renderer,
      scene,
      camera,
      ringGroup,
      metal,
      ringMesh: null as THREE.Mesh | null,
      capA: null as THREE.Mesh | null,
      capB: null as THREE.Mesh | null,
      previewRaf: 0,
      previewT0: performance.now(),
      busy: false,
    };
    engine.current = state;

    const rebuildRing = (gap: number) => {
      const arc = Math.max(0.05, Math.PI * 2 - gap);
      if (state.ringMesh) {
        state.ringGroup.remove(state.ringMesh);
        state.ringMesh.geometry.dispose();
      }
      if (state.capA) {
        state.ringGroup.remove(state.capA);
        state.capA.geometry.dispose();
      }
      if (state.capB) {
        state.ringGroup.remove(state.capB);
        state.capB.geometry.dispose();
      }
      const geo = new THREE.TorusGeometry(R, TUBE, 28, SEG, arc);
      state.ringMesh = new THREE.Mesh(geo, metal);
      state.ringMesh.rotation.z = -arc / 2;
      state.ringGroup.add(state.ringMesh);
      const capGeo = new THREE.SphereGeometry(TUBE * 0.98, 20, 16);
      state.capA = new THREE.Mesh(capGeo, metal);
      state.capB = new THREE.Mesh(capGeo, metal);
      const a0 = -arc / 2;
      const a1 = arc / 2;
      state.capA.position.set(Math.cos(a0) * R, Math.sin(a0) * R, 0);
      state.capB.position.set(Math.cos(a1) * R, Math.sin(a1) * R, 0);
      state.ringGroup.add(state.capA, state.capB);
    };

    const renderAt = (t: number) => {
      rebuildRing(gapAt(t));
      state.ringGroup.rotation.y = Math.sin(t * 0.15) * 0.04;
      renderer.render(scene, camera);
    };

    const previewLoop = (now: number) => {
      if (state.busy) return;
      const t = ((now - state.previewT0) / 1000) % DURATION;
      renderAt(t);
      setHud(`Önizleme · ${t.toFixed(1)}s`);
      state.previewRaf = requestAnimationFrame(previewLoop);
    };

    rebuildRing(START_GAP);
    state.previewRaf = requestAnimationFrame(previewLoop);

    return () => {
      cancelAnimationFrame(state.previewRaf);
      metal.dispose();
      state.ringMesh?.geometry.dispose();
      state.capA?.geometry.dispose();
      state.capB?.geometry.dispose();
      renderer.dispose();
      engine.current = null;
    };
  }, []);

  async function produce() {
    const state = engine.current;
    const canvas = canvasRef.current;
    if (!state || !canvas) return;
    const mime = pickMime();
    if (!mime) {
      alert("Bu tarayıcıda video kaydı desteklenmiyor. Chrome kullan.");
      return;
    }

    cancelAnimationFrame(state.previewRaf);
    state.busy = true;
    setBusy(true);
    if (downloadUrl) URL.revokeObjectURL(downloadUrl);
    setDownloadUrl(null);

    const rebuildRing = (gap: number) => {
      const arc = Math.max(0.05, Math.PI * 2 - gap);
      if (state.ringMesh) {
        state.ringGroup.remove(state.ringMesh);
        state.ringMesh.geometry.dispose();
      }
      if (state.capA) {
        state.ringGroup.remove(state.capA);
        state.capA.geometry.dispose();
      }
      if (state.capB) {
        state.ringGroup.remove(state.capB);
        state.capB.geometry.dispose();
      }
      const geo = new THREE.TorusGeometry(R, TUBE, 28, SEG, arc);
      state.ringMesh = new THREE.Mesh(geo, state.metal);
      state.ringMesh.rotation.z = -arc / 2;
      state.ringGroup.add(state.ringMesh);
      const capGeo = new THREE.SphereGeometry(TUBE * 0.98, 20, 16);
      state.capA = new THREE.Mesh(capGeo, state.metal);
      state.capB = new THREE.Mesh(capGeo, state.metal);
      const a0 = -arc / 2;
      const a1 = arc / 2;
      state.capA.position.set(Math.cos(a0) * R, Math.sin(a0) * R, 0);
      state.capB.position.set(Math.cos(a1) * R, Math.sin(a1) * R, 0);
      state.ringGroup.add(state.capA, state.capB);
    };

    const renderAt = (t: number) => {
      rebuildRing(gapAt(t));
      state.ringGroup.rotation.y = Math.sin(t * 0.15) * 0.04;
      state.renderer.render(state.scene, state.camera);
    };

    try {
      const chunks: BlobPart[] = [];
      const stream = canvas.captureStream(FPS);
      const recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 8_000_000 });
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size) chunks.push(e.data);
      };
      const done = new Promise<void>((resolve) => {
        recorder.onstop = () => resolve();
      });
      recorder.start(100);

      const totalFrames = DURATION * FPS;
      const frameMs = 1000 / FPS;
      const wall0 = performance.now();
      for (let i = 0; i <= totalFrames; i++) {
        const t = (i / totalFrames) * DURATION;
        renderAt(t);
        setHud(`Üretiliyor · ${t.toFixed(1)} / ${DURATION}s`);
        const target = wall0 + i * frameMs;
        for (;;) {
          await new Promise<void>((r) => requestAnimationFrame(() => r()));
          if (performance.now() >= target) break;
        }
      }

      recorder.stop();
      await done;
      stream.getTracks().forEach((tr) => tr.stop());

      const blob = new Blob(chunks, { type: mime });
      const url = URL.createObjectURL(blob);
      setDownloadUrl(url);
      setHud(`Hazır · ${(blob.size / 1024 / 1024).toFixed(1)} MB`);
    } catch (err) {
      console.error(err);
      alert("Üretim hatası: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      state.busy = false;
      setBusy(false);
      state.previewT0 = performance.now();
      const previewLoop = (now: number) => {
        if (state.busy || engine.current !== state) return;
        const t = ((now - state.previewT0) / 1000) % DURATION;
        rebuildRing(gapAt(t));
        state.ringGroup.rotation.y = Math.sin(t * 0.15) * 0.04;
        state.renderer.render(state.scene, state.camera);
        setHud(`Önizleme · ${t.toFixed(1)}s`);
        state.previewRaf = requestAnimationFrame(previewLoop);
      };
      state.previewRaf = requestAnimationFrame(previewLoop);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "radial-gradient(1200px 600px at 50% -10%, #1a1a1f, #0b0b0c)",
        color: "#f2f2f3",
        fontFamily: '"Segoe UI", system-ui, sans-serif',
        padding: "20px 16px 40px",
      }}
    >
      <div style={{ maxWidth: 520, margin: "0 auto" }}>
        <Link to="/" style={{ color: "#9a9aa2", textDecoration: "none", fontSize: 13 }}>
          ← Ana sayfa
        </Link>
        <h1 style={{ margin: "8px 0 4px", fontSize: 28, letterSpacing: "-0.03em" }}>1 mm boşluk</h1>
        <p style={{ margin: 0, color: "#9a9aa2", fontSize: 13 }}>10 sn · 9:16 · yerelde üret</p>

        <div
          style={{
            position: "relative",
            background: "#000",
            border: "1px solid #2a2a2e",
            borderRadius: 16,
            overflow: "hidden",
            aspectRatio: "9 / 16",
            maxHeight: "min(68vh, 720px)",
            margin: "16px auto 0",
          }}
        >
          <canvas
            ref={canvasRef}
            width={W}
            height={H}
            style={{ display: "block", width: "100%", height: "100%", objectFit: "contain", background: "#000" }}
          />
          <div
            style={{
              position: "absolute",
              left: 12,
              bottom: 12,
              padding: "6px 10px",
              borderRadius: 999,
              background: "rgba(0,0,0,0.55)",
              border: "1px solid rgba(255,255,255,0.12)",
              fontSize: 12,
              color: "#ddd",
            }}
          >
            {hud}
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
          <button
            type="button"
            onClick={() => void produce()}
            disabled={busy}
            style={{
              flex: 1,
              border: 0,
              borderRadius: 12,
              padding: "14px 16px",
              fontSize: 16,
              fontWeight: 650,
              cursor: busy ? "wait" : "pointer",
              background: "#e8e8ea",
              color: "#111",
              opacity: busy ? 0.55 : 1,
            }}
          >
            Üret
          </button>
          {downloadUrl && (
            <a
              href={downloadUrl}
              download="bir-mm-bosluk-10s.webm"
              style={{
                flex: 1,
                borderRadius: 12,
                padding: "14px 16px",
                fontSize: 16,
                fontWeight: 650,
                textAlign: "center",
                textDecoration: "none",
                background: "#222228",
                color: "#f2f2f3",
                border: "1px solid #2a2a2e",
              }}
            >
              İndir
            </a>
          )}
        </div>

        <details
          style={{
            marginTop: 18,
            background: "#141416",
            border: "1px solid #2a2a2e",
            borderRadius: 12,
            padding: "10px 12px",
          }}
        >
          <summary style={{ cursor: "pointer", color: "#9a9aa2", fontSize: 13 }}>Kullanılan prompt / brief</summary>
          <pre style={{ whiteSpace: "pre-wrap", fontSize: 11, lineHeight: 1.45, color: "#c8c8d0", margin: "10px 0 4px" }}>
            {PROMPT}
          </pre>
        </details>
      </div>
    </div>
  );
}
