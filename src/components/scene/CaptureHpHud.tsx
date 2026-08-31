import { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Hud, OrthographicCamera } from "@react-three/drei";
import * as THREE from "three";
import { DPS_PER_SOLDIER, formatCount } from "../../game";

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

  roundRect(ctx, 16, 10, w - 32, h - 20, 32);
  ctx.fillStyle = "rgba(8, 6, 4, 0.62)";
  ctx.fill();

  ctx.font = "800 56px Outfit, system-ui, sans-serif";
  ctx.fillStyle = "#fff";
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.fillText("Kalan sağlık", 48, 72);
  ctx.textAlign = "right";
  ctx.fillText(`%${label}`, w - 48, 72);

  const bx = 48;
  const by = 118;
  const bw = w - 96;
  const bh = 56;
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
  const size = useThree((s) => s.size);
  const canvas = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 1080;
    c.height = 240;
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

  const width = size.width * 0.94;
  const height = Math.max(96, size.height * 0.16);
  const y = size.height / 2 - height / 2 - Math.max(12, size.height * 0.02);

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

function strokeFill(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  stroke = 14
) {
  ctx.lineJoin = "round";
  ctx.miterLimit = 2;
  ctx.lineWidth = stroke;
  ctx.strokeStyle = "rgba(0,0,0,0.82)";
  ctx.fillStyle = "#fff";
  ctx.strokeText(text, x, y);
  ctx.fillText(text, x, y);
}

function drawTitles(
  canvas: HTMLCanvasElement,
  phase: "hook" | "cta" | "none",
  alpha: number,
  soldiers: number,
  handle: string
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  if (phase === "none" || alpha < 0.02) return;
  ctx.globalAlpha = alpha;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  if (phase === "hook") {
    const count = formatCount(soldiers);
    const big = count.length > 6 ? 160 : count.length > 4 ? 200 : 240;
    ctx.font = `800 ${big}px Outfit, system-ui, sans-serif`;
    strokeFill(ctx, count, w / 2, 130, 28);
    ctx.font = "800 72px Outfit, system-ui, sans-serif";
    strokeFill(ctx, "ASKER", w / 2, 250, 16);
    ctx.font = "800 64px Outfit, system-ui, sans-serif";
    strokeFill(ctx, "Bu kale düşecek mi?", w / 2, 360, 16);
  } else {
    ctx.font = "800 72px Outfit, system-ui, sans-serif";
    strokeFill(ctx, "Takip et, asker ol", w / 2, 170, 18);
    ctx.font = "800 64px Outfit, system-ui, sans-serif";
    strokeFill(ctx, `@${handle.replace(/^@/, "")}`, w / 2, 290, 16);
  }
  ctx.globalAlpha = 1;
}

type ReelTitlesProps = {
  soldiers: number;
  handle: string;
  duration: number;
};

function TitlesPlate({ soldiers, handle, duration }: ReelTitlesProps) {
  const size = useThree((s) => s.size);
  const canvas = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 1080;
    c.height = 480;
    return c;
  }, []);
  const tex = useMemo(() => {
    drawTitles(canvas, "hook", 1, soldiers, handle);
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    t.minFilter = THREE.LinearFilter;
    t.magFilter = THREE.LinearFilter;
    return t;
  }, [canvas, soldiers, handle]);
  const last = useRef("");
  const mat = useRef<THREE.MeshBasicMaterial>(null);

  useFrame(({ clock }) => {
    const recT = clock.elapsedTime - REEL_HOLD;
    const hook = Math.min(3, Math.max(0.9, duration * 0.4));
    const ctaLen = Math.min(2, Math.max(0.8, duration * 0.28));
    const ctaAt = duration - ctaLen;
    let phase: "hook" | "cta" | "none" = "none";
    let alpha = 0;
    if (recT >= 0 && recT < hook) {
      phase = "hook";
      if (recT < 0.35) alpha = recT / 0.35;
      else if (recT > hook - 0.4) alpha = Math.max(0, (hook - recT) / 0.4);
      else alpha = 1;
    } else if (recT >= ctaAt && recT <= duration + 0.2) {
      phase = "cta";
      const into = recT - ctaAt;
      if (into < 0.35) alpha = into / 0.35;
      else alpha = 1;
    }
    const key = `${phase}:${alpha.toFixed(2)}:${soldiers}:${handle}`;
    if (last.current !== key) {
      last.current = key;
      drawTitles(canvas, phase, 1, soldiers, handle);
      tex.needsUpdate = true;
    }
    if (mat.current) mat.current.opacity = alpha;
  });

  const width = size.width * 0.96;
  const height = Math.max(180, size.height * 0.42);
  const y = -size.height * 0.12;

  return (
    <mesh position={[0, y, 0]} renderOrder={25}>
      <planeGeometry args={[width, height]} />
      <meshBasicMaterial
        ref={mat}
        map={tex}
        transparent
        opacity={1}
        depthTest={false}
        toneMapped={false}
      />
    </mesh>
  );
}

export function ReelTitles(props: ReelTitlesProps) {
  return (
    <Hud renderPriority={2}>
      <OrthographicCamera makeDefault position={[0, 0, 10]} />
      <TitlesPlate {...props} />
    </Hud>
  );
}
