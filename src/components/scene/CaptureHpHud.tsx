import { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Hud, OrthographicCamera } from "@react-three/drei";
import * as THREE from "three";
import { DPS_PER_SOLDIER } from "../../game";

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

function drawHp(canvas: HTMLCanvasElement, pct: number, label: string) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  roundRect(ctx, 20, 12, w - 40, h - 24, 28);
  ctx.fillStyle = "rgba(8, 6, 4, 0.55)";
  ctx.fill();

  ctx.font = "700 34px Outfit, system-ui, sans-serif";
  ctx.fillStyle = "#fff";
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.fillText("Kalan sağlık", 52, 58);
  ctx.textAlign = "right";
  ctx.fillText(`%${label}`, w - 52, 58);

  const bx = 52;
  const by = 92;
  const bw = w - 104;
  const bh = 40;
  roundRect(ctx, bx, by, bw, bh, 20);
  ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
  ctx.fill();

  const fillW = Math.max(8, (bw * pct) / 100);
  ctx.save();
  ctx.beginPath();
  roundRect(ctx, bx, by, bw, bh, 20);
  ctx.clip();
  const grad = ctx.createLinearGradient(bx, by, bx + bw, by);
  grad.addColorStop(0, "#7a1010");
  grad.addColorStop(0.5, "#e11d2e");
  grad.addColorStop(1, "#ff4d4d");
  ctx.fillStyle = grad;
  ctx.fillRect(bx, by, fillW, bh);
  ctx.restore();
}

type CaptureHpHudProps = {
  hp: number;
  maxHp: number;
  soldiers: number;
};

function HpPlate({ hp, maxHp, soldiers }: CaptureHpHudProps) {
  const viewport = useThree((s) => s.viewport);
  const canvas = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 1024;
    c.height = 192;
    return c;
  }, []);
  const tex = useMemo(() => {
    const pct = maxHp > 0 ? Math.max(0, Math.min(100, (hp / maxHp) * 100)) : 0;
    const label = (Math.floor(pct * 100 + 1e-9) / 100).toFixed(2);
    drawHp(canvas, pct, label);
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    t.minFilter = THREE.LinearFilter;
    t.magFilter = THREE.LinearFilter;
    return t;
  }, [canvas, hp, maxHp]);
  const last = useRef("");

  useFrame(({ clock }) => {
    const live = Math.max(0, hp - soldiers * DPS_PER_SOLDIER * clock.elapsedTime);
    const pct = maxHp > 0 ? Math.max(0, Math.min(100, (live / maxHp) * 100)) : 0;
    const label = (Math.floor(pct * 100 + 1e-9) / 100).toFixed(2);
    if (last.current === label) return;
    last.current = label;
    drawHp(canvas, pct, label);
    tex.needsUpdate = true;
  });

  const width = viewport.width * 0.9;
  const height = Math.min(viewport.height * 0.16, 1.55);
  const y = viewport.height / 2 - height / 2 - viewport.height * 0.035;

  return (
    <mesh position={[0, y, 0]} renderOrder={20}>
      <planeGeometry args={[width, height]} />
      <meshBasicMaterial map={tex} transparent depthTest={false} toneMapped={false} />
    </mesh>
  );
}

export function CaptureHpHud(props: CaptureHpHudProps) {
  return (
    <Hud renderPriority={1}>
      <OrthographicCamera makeDefault position={[0, 0, 10]} />
      <HpPlate {...props} />
    </Hud>
  );
}

const REEL_HOLD = 1.05;

function smooth01(x: number) {
  const t = Math.max(0, Math.min(1, x));
  return t * t * (3 - 2 * t);
}

function blinkOpacity(elapsed: number, duration: number) {
  const recT = elapsed - REEL_HOLD;
  if (recT < 0) return 1;
  let o = 0;
  if (recT < 0.08) o = 1;
  else if (recT < 0.5) o = 1 - smooth01((recT - 0.08) / 0.42);

  const hook = Math.min(3, Math.max(0.9, duration * 0.4));
  if (duration >= 5) {
    const half = 0.11;
    if (recT >= hook - half && recT <= hook + half) {
      o = Math.max(o, Math.sin(((recT - (hook - half)) / (half * 2)) * Math.PI));
    }
  }
  if (duration >= 10) {
    const t2 = hook + (duration - hook) * 0.55;
    const half = 0.1;
    if (recT >= t2 - half && recT <= t2 + half) {
      o = Math.max(o, Math.sin(((recT - (t2 - half)) / (half * 2)) * Math.PI) * 0.9);
    }
  }
  return o;
}

function ShutterPlate({ duration }: { duration: number }) {
  const viewport = useThree((s) => s.viewport);
  const mat = useRef<THREE.MeshBasicMaterial>(null);
  useFrame(({ clock }) => {
    if (mat.current) mat.current.opacity = blinkOpacity(clock.elapsedTime, duration);
  });
  return (
    <mesh renderOrder={40}>
      <planeGeometry args={[viewport.width * 2.2, viewport.height * 2.2]} />
      <meshBasicMaterial ref={mat} color="#050302" transparent opacity={1} depthTest={false} />
    </mesh>
  );
}

export function ReelShutter({ duration }: { duration: number }) {
  return (
    <Hud renderPriority={2}>
      <OrthographicCamera makeDefault position={[0, 0, 10]} />
      <ShutterPlate duration={duration} />
    </Hud>
  );
}
