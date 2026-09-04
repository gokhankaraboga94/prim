import { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Hud, OrthographicCamera } from "@react-three/drei";
import * as THREE from "three";
import { DPS_PER_SOLDIER, formatCount } from "../../game";
import { REEL_FADE_HOLD, REEL_HOLD, reelBeats, reelFade } from "../../recordCanvas";

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

  roundRect(ctx, 24, 18, w - 48, h - 36, 22);
  ctx.fillStyle = "rgba(6, 4, 8, 0.55)";
  ctx.fill();

  ctx.font = "800 42px Outfit, system-ui, sans-serif";
  ctx.fillStyle = "#f3e6c8";
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.fillText("KALE", 48, 58);
  ctx.textAlign = "right";
  ctx.fillStyle = "#fff";
  ctx.font = "800 56px Outfit, system-ui, sans-serif";
  ctx.fillText(`%${label}`, w - 48, 58);

  const bx = 48;
  const by = 92;
  const bw = w - 96;
  const bh = 28;
  roundRect(ctx, bx, by, bw, bh, 12);
  ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
  ctx.fill();

  const fillW = Math.max(8, (bw * pct) / 100);
  ctx.save();
  ctx.beginPath();
  roundRect(ctx, bx, by, bw, bh, 12);
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
  overlay?: boolean;
  duration?: number;
  skipCommander?: boolean;
};

function HpPlate({ hp, maxHp, soldiers, duration = 8, skipCommander = false }: CaptureHpHudProps) {
  const size = useThree((s) => s.size);
  const mat = useRef<THREE.MeshBasicMaterial>(null);
  const canvas = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 1080;
    c.height = 160;
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
    const recT = clock.elapsedTime - REEL_HOLD;
    const { pullStart } = reelBeats(duration, skipCommander);
    let alpha = 0;
    if (recT >= pullStart) {
      alpha = Math.min(1, (recT - pullStart) / 0.4);
    }
    if (mat.current) mat.current.opacity = alpha;

    const live = Math.max(0, hp - soldiers * DPS_PER_SOLDIER * clock.elapsedTime);
    const pct = maxHp > 0 ? Math.max(0, Math.min(100, (live / maxHp) * 100)) : 0;
    const label = (Math.floor(pct * 100 + 1e-9) / 100).toFixed(2);
    if (last.current === label) return;
    last.current = label;
    drawHp(canvas, pct, label);
    tex.needsUpdate = true;
  });

  const width = size.width * 0.9;
  const height = Math.max(64, size.height * 0.1);
  const y = size.height / 2 - height / 2 - Math.max(10, size.height * 0.018);

  return (
    <mesh position={[0, y, 0]} renderOrder={20}>
      <planeGeometry args={[width, height]} />
      <meshBasicMaterial ref={mat} map={tex} transparent opacity={0} depthTest={false} toneMapped={false} />
    </mesh>
  );
}

export function CaptureHpHud({ overlay, ...props }: CaptureHpHudProps) {
  return (
    <Hud renderPriority={overlay ? 2 : 1}>
      <OrthographicCamera makeDefault position={[0, 0, 10]} />
      <HpPlate {...props} />
    </Hud>
  );
}

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
  phase: "hook" | "army" | "cta" | "none",
  soldiers: number,
  day: number
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  if (phase === "none") return;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  if (phase === "hook") {
    if (day > 0) {
      ctx.font = "800 168px Outfit, system-ui, sans-serif";
      strokeFill(ctx, `${day}. GÜN`, w / 2, 150, 28);
    }
    ctx.font = "800 54px Outfit, system-ui, sans-serif";
    strokeFill(ctx, "KALE KUŞATILDI", w / 2, day > 0 ? 280 : 160, 16);
  } else if (phase === "army") {
    const count = formatCount(soldiers);
    const big = count.length > 6 ? 130 : count.length > 4 ? 170 : 200;
    ctx.font = `800 ${big}px Outfit, system-ui, sans-serif`;
    strokeFill(ctx, count, w / 2, 130, 26);
    ctx.font = "800 58px Outfit, system-ui, sans-serif";
    strokeFill(ctx, "kişilik ordu", w / 2, 250, 16);
  } else {
    ctx.font = "800 88px Outfit, system-ui, sans-serif";
    strokeFill(ctx, "ORDUYA KATIL", w / 2, 120, 22);
    ctx.font = "800 48px Outfit, system-ui, sans-serif";
    strokeFill(ctx, "@wargame2028", w / 2, 210, 14);
  }
}

type ReelTitlesProps = {
  soldiers: number;
  duration: number;
  overlay?: boolean;
  day?: number;
  skipCommander?: boolean;
};

function TitlesPlate({ soldiers, duration, day = 0, skipCommander = false }: ReelTitlesProps) {
  const size = useThree((s) => s.size);
  const mesh = useRef<THREE.Mesh>(null);
  const canvas = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 1080;
    c.height = 520;
    return c;
  }, []);
  const tex = useMemo(() => {
    drawTitles(canvas, "hook", soldiers, day);
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    t.minFilter = THREE.LinearFilter;
    t.magFilter = THREE.LinearFilter;
    return t;
  }, [canvas, soldiers, day]);
  const last = useRef("");
  const mat = useRef<THREE.MeshBasicMaterial>(null);

  useFrame(({ clock }) => {
    const recT = clock.elapsedTime - REEL_HOLD;
    const { cmd, turn, pullStart } = reelBeats(duration, skipCommander);
    const ctaLen = Math.min(1.4, Math.max(0.9, duration * 0.18));
    const ctaAt = duration - ctaLen;
    let phase: "hook" | "army" | "cta" | "none" = "none";
    let alpha = 0;
    if (recT >= 0 && recT < 2.15) {
      phase = "hook";
      if (recT < 0.12) alpha = recT / 0.12;
      else if (recT > 1.75) alpha = Math.max(0, (2.15 - recT) / 0.4);
      else alpha = 1;
    } else if (recT >= cmd + turn * 0.22 && recT < pullStart + 1.25) {
      phase = "army";
      const into = recT - (cmd + turn * 0.22);
      const left = pullStart + 1.1 - recT;
      if (into < 0.35) alpha = into / 0.35;
      else if (left < 0.35) alpha = Math.max(0, left / 0.35);
      else alpha = 1;
    } else if (recT >= ctaAt && recT <= duration + 0.2) {
      phase = "cta";
      const into = recT - ctaAt;
      if (into < 0.3) alpha = into / 0.3;
      else alpha = 1;
    }
    const key = `${phase}:${soldiers}:${day}`;
    if (last.current !== key) {
      last.current = key;
      drawTitles(canvas, phase, soldiers, day);
      tex.needsUpdate = true;
    }
    if (mat.current) mat.current.opacity = alpha;
    if (mesh.current) {
      if (phase === "hook") {
        mesh.current.position.y = size.height * 0.3;
      } else if (phase === "army") {
        mesh.current.position.y = size.height * 0.28;
      } else if (phase === "cta") {
        const hpH = Math.max(64, size.height * 0.1);
        const hpY = size.height / 2 - hpH / 2 - Math.max(12, size.height * 0.02);
        const hpBottom = hpY - hpH / 2;
        const hookH = Math.max(160, size.height * 0.32);
        mesh.current.position.y = hpBottom - Math.max(8, size.height * 0.01) - hookH / 2;
      } else {
        mesh.current.position.y = -size.height * 0.32;
      }
    }
  });

  const width = size.width * 0.96;
  const height = Math.max(180, size.height * 0.42);
  const y = -size.height * 0.26;

  return (
    <mesh ref={mesh} position={[0, y, 0]} renderOrder={25}>
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

export function ReelTitles({ overlay, ...props }: ReelTitlesProps) {
  return (
    <Hud renderPriority={overlay ? 3 : 2}>
      <OrthographicCamera makeDefault position={[0, 0, 10]} />
      <TitlesPlate {...props} />
    </Hud>
  );
}

function FadePlate({ duration }: { duration: number }) {
  const size = useThree((s) => s.size);
  const mat = useRef<THREE.MeshBasicMaterial>(null);

  useFrame(({ clock }) => {
    const recT = clock.elapsedTime - REEL_HOLD;
    const fade = reelFade(duration);
    const start = duration - fade;
    const end = duration - REEL_FADE_HOLD;
    let a = 0;
    if (recT >= end) a = 1;
    else if (recT > start) {
      const u = (recT - start) / Math.max(0.08, end - start);
      a = u * u;
    }
    if (mat.current) mat.current.opacity = a;
  });

  return (
    <mesh position={[0, 0, 2]} renderOrder={80}>
      <planeGeometry args={[size.width * 2, size.height * 2]} />
      <meshBasicMaterial
        ref={mat}
        color="#000000"
        transparent
        opacity={0}
        depthTest={false}
        toneMapped={false}
      />
    </mesh>
  );
}

export function ReelFade({ duration }: { duration: number }) {
  return (
    <Hud renderPriority={2}>
      <OrthographicCamera makeDefault position={[0, 0, 10]} />
      <FadePlate duration={duration} />
    </Hud>
  );
}

function VignettePlate() {
  const size = useThree((s) => s.size);
  const tex = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 512;
    c.height = 512;
    const ctx = c.getContext("2d");
    if (!ctx) return null;
    const g = ctx.createRadialGradient(256, 256, 90, 256, 256, 256);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(0.62, "rgba(0,0,0,0)");
    g.addColorStop(1, "rgba(0,0,0,0.55)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 512, 512);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);
  if (!tex) return null;
  return (
    <mesh position={[0, 0, 1]} renderOrder={70}>
      <planeGeometry args={[size.width * 2, size.height * 2]} />
      <meshBasicMaterial map={tex} transparent depthTest={false} toneMapped={false} />
    </mesh>
  );
}

export function ReelVignette() {
  return (
    <Hud renderPriority={1}>
      <OrthographicCamera makeDefault position={[0, 0, 10]} />
      <VignettePlate />
    </Hud>
  );
}
