import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import * as THREE from "three";

const PROMPT = `Infinite near-miss loop: two metal ring ends approach forever.
As the physical gap shrinks, the camera dollies into the gap at the same rate,
so the visible gap on screen stays constant — they never touch.
Self-similar scale (doubles each loop) makes the 10s clip seamless.
Viewer keeps waiting for contact even after the video restarts.`;

const DURATION = 10;
const FPS = 30;
const W = 720;
const H = 1280;

/** World units at scale s=1 (loop start = loop end visually). */
const BASE_R = 1.15;
const BASE_TUBE = 0.11;
const BASE_GAP = 0.42; // ~18% of frame when camera is tuned
const BASE_DIST = 1.15; // distance from gap center along +Z
const SEG = 160;

function scaleAt(t: number) {
  const u = (((t % DURATION) + DURATION) % DURATION) / DURATION;
  // s: 1 → 2 over one loop. Geometry/camera all /s → identical end/start frame.
  return Math.pow(2, u);
}

function pickMime() {
  const opts = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"];
  for (const m of opts) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(m)) return m;
  }
  return "";
}

function makeScratchTexture() {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 512;
  const g = c.getContext("2d")!;
  g.fillStyle = "#c8ccd4";
  g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 120; i++) {
    const y = Math.random() * 512;
    g.strokeStyle = `rgba(255,255,255,${0.04 + Math.random() * 0.08})`;
    g.lineWidth = 1 + Math.random() * 1.5;
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(512, y + (Math.random() - 0.5) * 6);
    g.stroke();
  }
  for (let i = 0; i < 40; i++) {
    const y = Math.random() * 512;
    g.strokeStyle = `rgba(0,0,0,${0.05 + Math.random() * 0.1})`;
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(512, y);
    g.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  return tex;
}

type Engine = {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  ringGroup: THREE.Group;
  metal: THREE.MeshStandardMaterial;
  scratch: THREE.CanvasTexture;
  ringMesh: THREE.Mesh | null;
  capA: THREE.Mesh | null;
  capB: THREE.Mesh | null;
  previewRaf: number;
  previewT0: number;
  busy: boolean;
  rebuild: (s: number) => void;
  renderAt: (t: number) => void;
};

export function UretPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engine = useRef<Engine | null>(null);
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
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(W, H, false);
    renderer.setClearColor(0x000000, 1);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, W / H, 0.001, 50);

    const key = new THREE.DirectionalLight(0xffffff, 2.5);
    key.position.set(2.2, 3.2, 3.5);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xa8b4ff, 0.55);
    fill.position.set(-3, -1, 2);
    scene.add(fill);
    const rim = new THREE.DirectionalLight(0xffffff, 1.3);
    rim.position.set(-2, 2, -3);
    scene.add(rim);
    scene.add(new THREE.AmbientLight(0xffffff, 0.2));

    const scratch = makeScratchTexture();
    const metal = new THREE.MeshStandardMaterial({
      color: 0xd4d7de,
      metalness: 1,
      roughness: 0.28,
      map: scratch,
      roughnessMap: scratch,
    });

    const ringGroup = new THREE.Group();
    scene.add(ringGroup);

    const state: Engine = {
      renderer,
      scene,
      camera,
      ringGroup,
      metal,
      scratch,
      ringMesh: null,
      capA: null,
      capB: null,
      previewRaf: 0,
      previewT0: performance.now(),
      busy: false,
      rebuild: () => undefined,
      renderAt: () => undefined,
    };

    state.rebuild = (s: number) => {
      const rad = BASE_R / s;
      const tube = BASE_TUBE / s;
      const gap = BASE_GAP / s;
      const arc = Math.max(0.05, Math.PI * 2 - gap);
      const start = Math.PI / 2 + gap / 2;

      const pts: THREE.Vector3[] = [];
      for (let i = 0; i <= SEG; i++) {
        const a = start + (i / SEG) * arc;
        pts.push(new THREE.Vector3(Math.cos(a) * rad, Math.sin(a) * rad, 0));
      }
      const curve = new THREE.CatmullRomCurve3(pts);

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

      state.ringMesh = new THREE.Mesh(new THREE.TubeGeometry(curve, SEG, tube, 24, false), metal);
      state.ringGroup.add(state.ringMesh);

      const capGeo = new THREE.SphereGeometry(tube * 1.02, 24, 18);
      state.capA = new THREE.Mesh(capGeo, metal);
      state.capB = new THREE.Mesh(capGeo, metal);
      const a0 = start;
      const a1 = start + arc;
      state.capA.position.set(Math.cos(a0) * rad, Math.sin(a0) * rad, 0);
      state.capB.position.set(Math.cos(a1) * rad, Math.sin(a1) * rad, 0);
      state.ringGroup.add(state.capA, state.capB);

      // Camera locked on the gap — dolly in as gap shrinks (same rate → constant screen gap).
      const gapY = rad;
      const dist = BASE_DIST / s;
      camera.near = Math.max(0.0002, dist * 0.02);
      camera.far = Math.max(20, dist * 40);
      camera.updateProjectionMatrix();
      camera.position.set(0, gapY, dist);
      camera.lookAt(0, gapY, 0);

      // Scratches flow outward with zoom → brain reads “approaching”
      scratch.offset.y = Math.log2(s) * 0.35;
      scratch.needsUpdate = true;
    };

    state.renderAt = (t: number) => {
      const s = scaleAt(t);
      state.rebuild(s);
      renderer.render(scene, camera);
    };

    const previewLoop = (now: number) => {
      if (!engine.current || engine.current !== state || state.busy) return;
      const t = ((now - state.previewT0) / 1000) % DURATION;
      state.renderAt(t);
      const s = scaleAt(t);
      setHud(`Önizleme · ${t.toFixed(1)}s · zoom ×${s.toFixed(2)} (boşluk sabit)`);
      state.previewRaf = requestAnimationFrame(previewLoop);
    };

    engine.current = state;
    state.rebuild(1);
    state.previewRaf = requestAnimationFrame(previewLoop);

    return () => {
      cancelAnimationFrame(state.previewRaf);
      metal.dispose();
      scratch.dispose();
      state.ringMesh?.geometry.dispose();
      state.capA?.geometry.dispose();
      state.capB?.geometry.dispose();
      renderer.dispose();
      if (engine.current === state) engine.current = null;
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
        // Last frame = first frame (s=2 ≡ s=1 visually) for seamless loop
        const t = i === totalFrames ? 0 : (i / totalFrames) * DURATION;
        state.renderAt(t);
        setHud(`Üretiliyor · ${((i / totalFrames) * DURATION).toFixed(1)} / ${DURATION}s`);
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
      setHud(`Hazır · ${(blob.size / 1024 / 1024).toFixed(1)} MB · sonsuz loop`);
    } catch (err) {
      console.error(err);
      alert("Üretim hatası: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      state.busy = false;
      setBusy(false);
      state.previewT0 = performance.now();
      const previewLoop = (now: number) => {
        if (!engine.current || engine.current !== state || state.busy) return;
        const t = ((now - state.previewT0) / 1000) % DURATION;
        state.renderAt(t);
        setHud(`Önizleme · ${t.toFixed(1)}s · zoom ×${scaleAt(t).toFixed(2)} (boşluk sabit)`);
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
      <div style={{ maxWidth: 420, margin: "0 auto" }}>
        <Link to="/" style={{ color: "#9a9aa2", textDecoration: "none", fontSize: 13 }}>
          ← Ana sayfa
        </Link>
        <h1 style={{ margin: "8px 0 4px", fontSize: 28, letterSpacing: "-0.03em" }}>Sonsuz yaklaşma</h1>
        <p style={{ margin: 0, color: "#9a9aa2", fontSize: 13 }}>
          Uçlar yakınlaşır, kamera boşluğa aynı hızda girer — ekranda boşluk hep aynı, değmezler.
        </p>

        <div
          style={{
            position: "relative",
            background: "#000",
            border: "1px solid #2a2a2e",
            borderRadius: 16,
            overflow: "hidden",
            width: "100%",
            aspectRatio: "9 / 16",
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
              download="sonsuz-yaklasma-10s.webm"
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
          <summary style={{ cursor: "pointer", color: "#9a9aa2", fontSize: 13 }}>Brief</summary>
          <pre style={{ whiteSpace: "pre-wrap", fontSize: 11, lineHeight: 1.45, color: "#c8c8d0", margin: "10px 0 4px" }}>
            {PROMPT}
          </pre>
        </details>
      </div>
    </div>
  );
}
