import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

const PROMPT = `Two polished metal ring ends approach forever.
Camera dolly speed = gap shrink speed (exact 1:1). Gap angle fixed so
screen gap never closes — they never touch.
Wide → macro zoom is obvious; loop cut back to wide is intentional.`;

const DURATION = 10;
const FPS = 30;
const W = 1080;
const H = 1920;

/**
 * Self-similar dolly: every length scales by 1/s, gap ANGLE stays fixed.
 * That keeps screen gap exactly constant (1:1 with camera). Old bug scaled
 * gap angle by 1/s too → arc length ~1/s² → ends appeared to touch ~6s.
 */
const ZOOM_END = 4.2;
const BASE_R = 1.2;
const BASE_TUBE = 0.11;
/** Fixed angular gap (radians). Must keep BASE_R*sin(GAP_ANGLE/2) > BASE_TUBE. */
const GAP_ANGLE = 0.62;
const BASE_DIST = 1.4;
const SEG = 256;
const FOV = 42;

function scaleAt(t: number) {
  const u = (((t % DURATION) + DURATION) % DURATION) / DURATION;
  const e = u * u * (3 - 2 * u);
  return 1 + (ZOOM_END - 1) * e;
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
  c.width = 1024;
  c.height = 1024;
  const g = c.getContext("2d")!;
  const grd = g.createLinearGradient(0, 0, 1024, 0);
  grd.addColorStop(0, "#b8bcc6");
  grd.addColorStop(0.5, "#e8eaef");
  grd.addColorStop(1, "#aeb2bc");
  g.fillStyle = grd;
  g.fillRect(0, 0, 1024, 1024);
  for (let i = 0; i < 220; i++) {
    const y = Math.random() * 1024;
    g.strokeStyle = `rgba(255,255,255,${0.05 + Math.random() * 0.12})`;
    g.lineWidth = 0.8 + Math.random() * 2;
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(1024, y + (Math.random() - 0.5) * 8);
    g.stroke();
  }
  for (let i = 0; i < 90; i++) {
    const y = Math.random() * 1024;
    g.strokeStyle = `rgba(20,22,28,${0.06 + Math.random() * 0.12})`;
    g.lineWidth = 0.7 + Math.random();
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(1024, y);
    g.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 16;
  return tex;
}

type Engine = {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  ringGroup: THREE.Group;
  metal: THREE.MeshPhysicalMaterial;
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
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(W, H, false);
    renderer.setClearColor(0x000000, 1);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, W / H, 0.0005, 80);

    const pmrem = new THREE.PMREMGenerator(renderer);
    const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTex;
    pmrem.dispose();

    const key = new THREE.DirectionalLight(0xffffff, 3.2);
    key.position.set(2.4, 3.8, 4.2);
    scene.add(key);
    const kick = new THREE.DirectionalLight(0xfff2e0, 1.4);
    kick.position.set(-1.2, 1.5, 3.2);
    scene.add(kick);
    const fill = new THREE.DirectionalLight(0x9eb0ff, 0.7);
    fill.position.set(-3.5, -0.8, 1.8);
    scene.add(fill);
    const rim = new THREE.DirectionalLight(0xffffff, 1.8);
    rim.position.set(-2.2, 2.6, -3.8);
    scene.add(rim);
    scene.add(new THREE.AmbientLight(0xffffff, 0.15));

    const scratch = makeScratchTexture();
    const metal = new THREE.MeshPhysicalMaterial({
      color: 0xd8dbe3,
      metalness: 1,
      roughness: 0.18,
      map: scratch,
      roughnessMap: scratch,
      envMapIntensity: 1.35,
      clearcoat: 0.55,
      clearcoatRoughness: 0.12,
      reflectivity: 1,
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
      // 1:1 lock — radius, tube, camera distance all /s; gap ANGLE fixed.
      const rad = BASE_R / s;
      const tube = BASE_TUBE / s;
      const gap = GAP_ANGLE;
      const arc = Math.PI * 2 - gap;
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

      state.ringMesh = new THREE.Mesh(new THREE.TubeGeometry(curve, SEG, tube, 48, false), metal);
      state.ringGroup.add(state.ringMesh);

      // Caps slightly smaller than tube so they never bridge the gap.
      const capGeo = new THREE.SphereGeometry(tube * 0.92, 48, 32);
      state.capA = new THREE.Mesh(capGeo, metal);
      state.capB = new THREE.Mesh(capGeo, metal);
      const a0 = start;
      const a1 = start + arc;
      state.capA.position.set(Math.cos(a0) * rad, Math.sin(a0) * rad, 0);
      state.capB.position.set(Math.cos(a1) * rad, Math.sin(a1) * rad, 0);
      state.ringGroup.add(state.capA, state.capB);

      const gapY = rad;
      const dist = BASE_DIST / s;
      camera.near = Math.max(0.00015, dist * 0.015);
      camera.far = Math.max(40, dist * 60);
      camera.fov = FOV; // fixed — FOV change was closing the gap on screen
      camera.updateProjectionMatrix();
      camera.position.set(0, gapY, dist);
      camera.lookAt(0, gapY, 0);

      // Motion read from surface flow (geometry gap stays locked)
      scratch.repeat.set(1, 2.4);
      scratch.offset.y = Math.log2(s) * 1.1;
      scratch.needsUpdate = true;
    };

    state.renderAt = (t: number) => {
      state.rebuild(scaleAt(t));
      renderer.render(scene, camera);
    };

    const previewLoop = (now: number) => {
      if (!engine.current || engine.current !== state || state.busy) return;
      const t = ((now - state.previewT0) / 1000) % DURATION;
      state.renderAt(t);
      const s = scaleAt(t);
      const loopSoon = t > DURATION - 0.35;
      setHud(
        loopSoon
          ? `Önizleme · ${t.toFixed(1)}s · LOOP (genişe dönüş)`
          : `Önizleme · ${t.toFixed(1)}s · kamera ×${s.toFixed(2)} (boşluk açık)`
      );
      state.previewRaf = requestAnimationFrame(previewLoop);
    };

    engine.current = state;
    state.rebuild(1);
    state.previewRaf = requestAnimationFrame(previewLoop);

    return () => {
      cancelAnimationFrame(state.previewRaf);
      metal.dispose();
      scratch.dispose();
      envTex.dispose();
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
      const recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 14_000_000 });
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
      for (let i = 0; i < totalFrames; i++) {
        // End on tight macro (s≈ZOOM_END). Loop back to wide is a clear cut — intentional.
        const t = (i / totalFrames) * DURATION;
        state.renderAt(t);
        setHud(`Üretiliyor · ${t.toFixed(1)} / ${DURATION}s · ×${scaleAt(t).toFixed(2)}`);
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
      setHud(`Hazır · ${(blob.size / 1024 / 1024).toFixed(1)} MB · loop'ta genişe sıçrar`);
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
        const s = scaleAt(t);
        setHud(
          t > DURATION - 0.35
            ? `Önizleme · ${t.toFixed(1)}s · LOOP (genişe dönüş)`
            : `Önizleme · ${t.toFixed(1)}s · kamera ×${s.toFixed(2)} (boşluk açık)`
        );
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
          Kamera boşluğa net girer; boşluk açık kalır. Başa sarınca geniş plana düşer — loop okunur.
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
