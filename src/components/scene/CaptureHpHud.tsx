import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Hud, OrthographicCamera } from "@react-three/drei";
import * as THREE from "three";
import { DPS_PER_SOLDIER, formatCount } from "../../game";
import { REEL_FADE_HOLD, REEL_HOLD, reelBeats, reelFade } from "../../recordCanvas";
import { cinemaScale } from "../../shotModes";
import { isJoin, rosterBeat, rosterSoldierIds, rosterTimeline, type PlanBId } from "../../rosterReel";
import { sagaBeat, type SagaId } from "../../sagaReel";
import { discoverBeat, DISCOVER_HOOK_END, isDiscoverEngage, isDiscoverShelf, isDiscoverTrailer, shelfBeat, trailerBeat, type DiscoverId } from "../../discoverReel";
import { countdownBeat, countdownFlash, type CountdownId } from "../../countdownReel";
import { DEFEND_HOOK_END, defendBeat, defendPlayhead, type DefendId } from "../../defendReel";
import { harika2TextPhase, harika3TextPhase, harika4TextPhase, harika6TextPhase, spinNamePool, spinScramble, spinShuffle, SPIN_LOCK, SPIN_SECONDS } from "../../xxxReel";
import { new2AliveCounts, new5AliveCounts } from "../../new1Reel";

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
  cinema?: boolean;
  roster?: PlanBId | null;
  discover?: DiscoverId | null;
};

function HpPlate({ hp, maxHp, soldiers, duration = 8, skipCommander = false, cinema = false, roster = null, discover = null }: CaptureHpHudProps) {
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
    if (isDiscoverTrailer(discover)) {
      if (recT < 0) alpha = 0;
      else if (recT < 0.28) alpha = recT / 0.28;
      else if (recT >= 32.4) alpha = Math.max(0, 1 - (recT - 32.4) / 0.7);
      else alpha = 1;
    } else if (isDiscoverShelf(discover)) {
      if (recT < 0) alpha = 0;
      else if (recT < 0.2) alpha = recT / 0.2;
      else if (recT >= 13.2) alpha = Math.max(0, 1 - (recT - 13.2) / 0.5);
      else alpha = 1;
    } else if (discover) {
      if (recT < 0) alpha = 0;
      else if (recT < 0.22) alpha = recT / 0.22;
      else if (recT >= 13.25) alpha = Math.max(0, 1 - (recT - 13.25) / 0.45);
      else alpha = 1;
    } else if (roster) {
      alpha = recT < 0 ? 0 : recT < 0.22 ? recT / 0.22 : 1;
    } else {
      const showAt = cinema ? 14.8 * cinemaScale(duration) : pullStart;
      if (recT >= showAt) {
        alpha = Math.min(1, (recT - showAt) / 0.4);
      }
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
  const y = roster || isDiscoverTrailer(discover) || isDiscoverShelf(discover)
    ? -size.height / 2 + height / 2 + Math.max(22, size.height * 0.07)
    : size.height / 2 - height / 2 - Math.max(10, size.height * 0.018);

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

/** Video içi kanca bandı: beyaz zemin, dev kırmızı "ADINI BUL", altına siyah merak satırı. */
function drawXxxHook(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  // Solid white band — recompression-proof, pops against sky and army alike.
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.5)";
  ctx.shadowBlur = 24;
  ctx.shadowOffsetY = 10;
  roundRect(ctx, 26, 30, w - 52, h - 76, 34);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.restore();

  // Thin red keyline makes the band read as a deliberate alert card.
  roundRect(ctx, 26, 30, w - 52, h - 76, 34);
  ctx.lineWidth = 6;
  ctx.strokeStyle = "#d40000";
  ctx.stroke();

  ctx.textBaseline = "middle";
  ctx.textAlign = "center";
  const maxW = w - 200;

  const fitFont = (text: string, start: number, weight = 900) => {
    let size = start;
    for (; size > 40; size -= 2) {
      ctx.font = `${weight} ${size}px Outfit, "Segoe UI", system-ui, sans-serif`;
      if (ctx.measureText(text).width <= maxW) break;
    }
    return size;
  };

  // Line 1: the command — huge, pure red, impossible to skip.
  const line1 = "ADINI BUL";
  const s1 = fitFont(line1, 168);
  ctx.font = `900 ${s1}px Outfit, "Segoe UI", system-ui, sans-serif`;
  ctx.fillStyle = "#d40000";
  ctx.fillText(line1, w / 2, h / 2 - 42);

  // Line 2: the curiosity gap — smaller, near-black, one glance to read.
  const line2 = "bulamazsan sebebi var";
  const s2 = Math.min(fitFont(line2, 62, 800), 62);
  ctx.font = `800 ${s2}px Outfit, "Segoe UI", system-ui, sans-serif`;
  ctx.fillStyle = "#141414";
  ctx.fillText(line2, w / 2, h / 2 + s1 * 0.5 + 6);
}

type AdHookPhase = "static" | "scan" | "hook" | "off";

/**
 * harika2 hook — intersection of the pasted research:
 * gold-yellow field (periphery + arousal) + matte black ink (achromatic,
 * positive polarity, ≥7:1). No red-on-blue. No negative polarity.
 */
const AD_PAPER = "#ffd54f";
const AD_INK = "#111111";
const AD_FONT = `Inter, Montserrat, Helvetica, Arial, sans-serif`;
const AD_WEIGHT = 900;

function drawAdHook(canvas: HTMLCanvasElement, phase: AdHookPhase = "static") {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  if (phase === "off") return;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  ctx.miterLimit = 2;

  const cx = w * 0.5;
  const maxW = w * 0.86;
  const glance = phase === "scan";
  const lines = glance
    ? [
        { t: "TAKİPÇİLERİMLE", start: Math.round(w * 0.1) },
        { t: "BİRLİKTE SAVAŞIYORUZ", start: Math.round(w * 0.078) },
      ]
    : [
        { t: "TAKİPÇİLERİMLE", start: Math.round(w * 0.088) },
        { t: "BİRLİKTE SAVAŞIYORUZ", start: Math.round(w * 0.07) },
        { t: "SEN DE ORDUYA KATIL", start: Math.round(w * 0.074) },
      ];

  const setType = (size: number) => {
    ctx.font = `${AD_WEIGHT} ${size}px ${AD_FONT}`;
    ctx.letterSpacing = `${Math.round(size * 0.016)}px`;
  };

  const fit = (text: string, start: number) => {
    let size = start;
    setType(size);
    while (ctx.measureText(text).width > maxW && size > 40) {
      size -= 3;
      setType(size);
    }
    return size;
  };

  const sizes = lines.map((l) => fit(l.t, l.start));
  const lead = 1.02;
  const y0 = glance ? h * 0.36 : h * 0.3;
  const ys = [y0];
  for (let i = 0; i < sizes.length - 1; i++) ys.push(ys[i] + sizes[i] * lead);
  const top = ys[0] - sizes[0] * 0.72;
  const last = sizes.length - 1;
  const bot = ys[last] + sizes[last] * 0.68;
  const boxX = w * 0.035;
  const boxW = w - boxX * 2;

  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.5)";
  ctx.shadowBlur = 26;
  ctx.shadowOffsetY = 5;
  ctx.fillStyle = AD_PAPER;
  roundRect(ctx, boxX, top, boxW, bot - top, 26);
  ctx.fill();
  ctx.restore();

  for (let i = 0; i < lines.length; i++) {
    setType(sizes[i]);
    ctx.lineWidth = Math.max(3, sizes[i] * 0.035);
    ctx.strokeStyle = AD_INK;
    ctx.fillStyle = AD_INK;
    ctx.strokeText(lines[i].t, cx, ys[i]);
    ctx.fillText(lines[i].t, cx, ys[i]);
  }
  ctx.letterSpacing = "0px";
}

const DOC_PAPER = "#ffd54f";
const DOC_INK = "#111111";
const DOC_EDGE = "#1a1a1a";
const DOC_FONT = `Inter, Helvetica, Arial, sans-serif`;
const DOC_GLYPHS = "ADINI BUL SAVAŞA GİR İSMİNİ ARA İSMİN NERDE SATIRDA ARA ORDUN HAZIR DUR. SENİN İSMİN DE BURADA OLABİLİR İıĞğŞşÖöÜüÇç";

type DocHookPhase = "scan" | "hook" | "off";

/**
 * harika3 hook — önemli.md: the game is the name hunt, not the brand.
 * Compact gold island, Inter 900, no site URL, no exclamation, gone at 4s.
 */
function drawHarika3Hook(canvas: HTMLCanvasElement, phase: DocHookPhase = "scan") {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  if (phase === "off") return;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.letterSpacing = "0px";

  const glance = phase === "scan";
  const lines = glance ? ["ADINI", "BUL"] : ["ADINI BUL", "SAVAŞA GİR", "İSMİNİ ARA"];
  const start = glance ? Math.round(w * 0.142) : Math.round(w * 0.118);

  const setType = (size: number) => {
    ctx.font = `900 ${size}px ${DOC_FONT}`;
    ctx.letterSpacing = `${Math.round(size * -0.018)}px`;
  };

  const fit = (text: string, cap: number) => {
    let size = cap;
    setType(size);
    const maxW = w * 0.72;
    while (ctx.measureText(text).width > maxW && size > 48) {
      size -= 2;
      setType(size);
    }
    return size;
  };

  const sizes = lines.map((t) => fit(t, start));
  const lead = 1.04;
  const padX = Math.max(36, sizes[0] * 0.42);
  const padY = Math.max(22, sizes[0] * 0.28);
  const y0 = padY + sizes[0] * 0.55;
  const ys = [y0];
  for (let i = 0; i < sizes.length - 1; i++) ys.push(ys[i] + (sizes[i] + sizes[i + 1]) * 0.5 * lead);
  let blockW = 0;
  for (let i = 0; i < lines.length; i++) {
    setType(sizes[i]);
    blockW = Math.max(blockW, ctx.measureText(lines[i]).width);
  }
  const boxW = Math.min(w * 0.78, blockW + padX * 2);
  const boxH = ys[ys.length - 1] + sizes[sizes.length - 1] * 0.55 + padY - (y0 - sizes[0] * 0.55);
  const boxX = (w - boxW) * 0.5;
  const boxY = Math.max(8, y0 - sizes[0] * 0.55 - padY);

  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.28)";
  ctx.shadowBlur = 8;
  ctx.shadowOffsetY = 2;
  ctx.fillStyle = DOC_PAPER;
  roundRect(ctx, boxX, boxY, boxW, boxH, 14);
  ctx.fill();
  ctx.restore();
  ctx.lineWidth = 2;
  ctx.strokeStyle = DOC_EDGE;
  roundRect(ctx, boxX, boxY, boxW, boxH, 14);
  ctx.stroke();

  for (let i = 0; i < lines.length; i++) {
    setType(sizes[i]);
    ctx.fillStyle = DOC_INK;
    ctx.fillText(lines[i], w * 0.5, ys[i]);
  }
  ctx.letterSpacing = "0px";
}

function drawHarika4Hook(canvas: HTMLCanvasElement, phase: DocHookPhase = "scan") {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  if (phase === "off") return;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.letterSpacing = "0px";

  const glance = phase === "scan";
  const lines = glance ? ["İSMİN", "NERDE"] : ["İSMİN NERDE", "SATIRDA ARA", "ORDUN HAZIR"];
  const start = glance ? Math.round(w * 0.142) : Math.round(w * 0.118);

  const setType = (size: number) => {
    ctx.font = `900 ${size}px ${DOC_FONT}`;
    ctx.letterSpacing = `${Math.round(size * -0.018)}px`;
  };

  const fit = (text: string, cap: number) => {
    let size = cap;
    setType(size);
    const maxW = w * 0.72;
    while (ctx.measureText(text).width > maxW && size > 48) {
      size -= 2;
      setType(size);
    }
    return size;
  };

  const sizes = lines.map((t) => fit(t, start));
  const lead = 1.04;
  const padX = Math.max(36, sizes[0] * 0.42);
  const padY = Math.max(22, sizes[0] * 0.28);
  const y0 = padY + sizes[0] * 0.55;
  const ys = [y0];
  for (let i = 0; i < sizes.length - 1; i++) ys.push(ys[i] + (sizes[i] + sizes[i + 1]) * 0.5 * lead);
  let blockW = 0;
  for (let i = 0; i < lines.length; i++) {
    setType(sizes[i]);
    blockW = Math.max(blockW, ctx.measureText(lines[i]).width);
  }
  const boxW = Math.min(w * 0.78, blockW + padX * 2);
  const boxH = ys[ys.length - 1] + sizes[sizes.length - 1] * 0.55 + padY - (y0 - sizes[0] * 0.55);
  const boxX = (w - boxW) * 0.5;
  const boxY = Math.max(8, y0 - sizes[0] * 0.55 - padY);

  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.28)";
  ctx.shadowBlur = 8;
  ctx.shadowOffsetY = 2;
  ctx.fillStyle = DOC_PAPER;
  roundRect(ctx, boxX, boxY, boxW, boxH, 14);
  ctx.fill();
  ctx.restore();
  ctx.lineWidth = 2;
  ctx.strokeStyle = DOC_EDGE;
  roundRect(ctx, boxX, boxY, boxW, boxH, 14);
  ctx.stroke();

  for (let i = 0; i < lines.length; i++) {
    setType(sizes[i]);
    ctx.fillStyle = DOC_INK;
    ctx.fillText(lines[i], w * 0.5, ys[i]);
  }
  ctx.letterSpacing = "0px";
}

function drawHarika6Hook(canvas: HTMLCanvasElement, phase: DocHookPhase = "hook") {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  if (phase === "off") return;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.letterSpacing = "0px";

  const lines = ["DUR.", "SENİN İSMİN", "DE BURADA OLABİLİR."];
  const start = Math.round(w * 0.118);

  const setType = (size: number) => {
    ctx.font = `900 ${size}px ${DOC_FONT}`;
    ctx.letterSpacing = `${Math.round(size * -0.018)}px`;
  };

  const fit = (text: string, cap: number) => {
    let size = cap;
    setType(size);
    const maxW = w * 0.72;
    while (ctx.measureText(text).width > maxW && size > 48) {
      size -= 2;
      setType(size);
    }
    return size;
  };

  const sizes = lines.map((t) => fit(t, start));
  const lead = 1.04;
  const padX = Math.max(36, sizes[0] * 0.42);
  const padY = Math.max(22, sizes[0] * 0.28);
  const y0 = padY + sizes[0] * 0.55;
  const ys = [y0];
  for (let i = 0; i < sizes.length - 1; i++) ys.push(ys[i] + (sizes[i] + sizes[i + 1]) * 0.5 * lead);
  let blockW = 0;
  for (let i = 0; i < lines.length; i++) {
    setType(sizes[i]);
    blockW = Math.max(blockW, ctx.measureText(lines[i]).width);
  }
  const boxW = Math.min(w * 0.78, blockW + padX * 2);
  const boxH = ys[ys.length - 1] + sizes[sizes.length - 1] * 0.55 + padY - (y0 - sizes[0] * 0.55);
  const boxX = (w - boxW) * 0.5;
  const boxY = Math.max(8, y0 - sizes[0] * 0.55 - padY);

  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.28)";
  ctx.shadowBlur = 8;
  ctx.shadowOffsetY = 2;
  ctx.fillStyle = DOC_PAPER;
  roundRect(ctx, boxX, boxY, boxW, boxH, 14);
  ctx.fill();
  ctx.restore();
  ctx.lineWidth = 2;
  ctx.strokeStyle = DOC_EDGE;
  roundRect(ctx, boxX, boxY, boxW, boxH, 14);
  ctx.stroke();

  for (let i = 0; i < lines.length; i++) {
    setType(sizes[i]);
    ctx.fillStyle = DOC_INK;
    ctx.fillText(lines[i], w * 0.5, ys[i]);
  }
  ctx.letterSpacing = "0px";
}

/** 2 words, no plate — TikTok caption: black stroke, red fill, transparent. */
function drawClearHook(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const text = "ADIN BURADA";
  let size = Math.round(w * 0.125);
  ctx.font = `900 ${size}px Outfit, "Segoe UI", system-ui, sans-serif`;
  while (ctx.measureText(text).width > w * 0.9 && size > 52) {
    size -= 4;
    ctx.font = `900 ${size}px Outfit, "Segoe UI", system-ui, sans-serif`;
  }
  ctx.lineJoin = "round";
  ctx.miterLimit = 2;
  ctx.lineWidth = Math.max(22, size * 0.18);
  ctx.strokeStyle = "rgba(0,0,0,0.94)";
  ctx.fillStyle = "#e10600";
  ctx.strokeText(text, w / 2, h * 0.55);
  ctx.fillText(text, w / 2, h * 0.55);
}

type HookVariant = "banner" | "clear" | "ad" | "doc" | "hunt" | "hold";

function paintHook(canvas: HTMLCanvasElement, variant: HookVariant, phase: AdHookPhase | DocHookPhase) {
  if (variant === "hold") drawHarika6Hook(canvas, phase as DocHookPhase);
  else if (variant === "hunt") drawHarika4Hook(canvas, phase as DocHookPhase);
  else if (variant === "doc") drawHarika3Hook(canvas, phase as DocHookPhase);
  else if (variant === "ad") drawAdHook(canvas, phase as AdHookPhase);
  else if (variant === "clear") drawClearHook(canvas);
  else drawXxxHook(canvas);
}

function XxxHookPlate({ variant = "banner", instant = false }: { variant?: HookVariant; instant?: boolean }) {
  const size = useThree((s) => s.size);
  const mat = useRef<THREE.MeshBasicMaterial>(null);
  const mesh = useRef<THREE.Mesh>(null);
  const tex = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = variant === "doc" || variant === "hunt" || variant === "hold" ? 1080 : 2160;
    c.height = variant === "doc" || variant === "hunt" || variant === "hold" ? 520 : variant === "ad" ? 680 : variant === "clear" ? 560 : 800;
    if (variant === "hold") drawHarika6Hook(c, "off");
    else if (variant === "hunt") drawHarika4Hook(c, "scan");
    else if (variant === "doc") drawHarika3Hook(c, "scan");
    else if (variant === "ad") drawAdHook(c, instant ? "scan" : "static");
    else if (variant === "clear") drawClearHook(c);
    else drawXxxHook(c);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.minFilter = THREE.LinearFilter;
    t.magFilter = THREE.LinearFilter;
    return t;
  }, [variant, instant]);
  const redraws = useRef(0);
  const lastPhase = useRef<AdHookPhase | DocHookPhase>(
    variant === "hold" ? "off" : variant === "doc" || variant === "hunt" || instant ? "scan" : "static"
  );

  useEffect(() => {
    let alive = true;
    const paint = () => {
      if (!alive) return;
      paintHook(tex.image as HTMLCanvasElement, variant, lastPhase.current);
      tex.needsUpdate = true;
    };
    const loads =
      variant === "doc" || variant === "hunt" || variant === "hold"
        ? [document.fonts.load("900 80px Inter", DOC_GLYPHS)]
        : [document.fonts.load(`${AD_WEIGHT} 80px Inter`), document.fonts.load("800 80px Montserrat")];
    void Promise.all(loads).then(paint, paint);
    return () => {
      alive = false;
    };
  }, [tex, variant]);

  useFrame(({ clock, size: frameSize }) => {
    const recT = clock.elapsedTime - REEL_HOLD;
    const phase: AdHookPhase | DocHookPhase =
      variant === "hold"
        ? harika6TextPhase(recT)
        : variant === "hunt"
          ? harika4TextPhase(recT)
          : variant === "doc"
            ? harika3TextPhase(recT)
            : variant === "ad" && instant
              ? harika2TextPhase(recT)
              : variant === "ad"
                ? "static"
                : lastPhase.current;
    if (redraws.current < 3 && clock.elapsedTime > (redraws.current + 1) * 0.5) {
      redraws.current += 1;
      paintHook(tex.image as HTMLCanvasElement, variant, phase);
      tex.needsUpdate = true;
    } else if ((variant === "ad" || variant === "doc" || variant === "hunt" || variant === "hold") && lastPhase.current !== phase) {
      paintHook(tex.image as HTMLCanvasElement, variant, phase);
      tex.needsUpdate = true;
    }
    lastPhase.current = phase;
    let alpha = 0;
    if (variant === "doc" || variant === "hunt" || variant === "hold") {
      if (phase === "off") alpha = 0;
      else if (recT >= -0.05) alpha = 1;
    } else if (instant) {
      if (recT < 4) alpha = recT >= -0.05 ? 1 : 0;
      else if (recT < 4.16) alpha = 1 - (recT - 4) / 0.16;
      else alpha = 0;
    } else if (recT >= 0) {
      const into = recT;
      alpha = into < 0.14 ? into / 0.14 : 1;
    }
    if (mat.current) mat.current.opacity = alpha;
    if (mesh.current && (variant === "doc" || variant === "hunt" || variant === "hold")) {
      const img = tex.image as HTMLCanvasElement;
      const width = frameSize.width * 0.62;
      const height = width * (img.height / img.width);
      const fromTop = frameSize.height * (260 / 1920);
      mesh.current.position.y = frameSize.height / 2 - fromTop - height / 2;
      mesh.current.scale.set(1, 1, 1);
    } else if (instant && mesh.current) {
      let s = 1;
      if (recT >= 0 && recT < 0.18) s = 1.08 - (recT / 0.18) * 0.08;
      mesh.current.scale.set(s, s, 1);
    }
  });

  const img = tex.image as HTMLCanvasElement;
  const width = size.width * (variant === "doc" || variant === "hunt" || variant === "hold" ? 0.62 : variant === "ad" ? 0.86 : variant === "clear" ? 0.92 : 0.94);
  const height = width * (img.height / img.width);
  const topInset =
    variant === "doc" || variant === "hunt" || variant === "hold"
      ? size.height * (260 / 1920)
      : variant === "ad"
        ? size.height * 0.16
        : Math.max(48, size.height * (variant === "clear" ? 0.07 : 0.055));
  const y = size.height / 2 - topInset - height / 2;
  const x = 0;

  return (
    <mesh ref={mesh} position={[x, y, 0]} renderOrder={30}>
      <planeGeometry args={[width, height]} />
      <meshBasicMaterial ref={mat} map={tex} transparent opacity={0} depthTest={false} toneMapped={false} />
    </mesh>
  );
}

export function XxxHookHud({ variant = "banner", instant = false }: { variant?: HookVariant; instant?: boolean }) {
  return (
    <Hud renderPriority={3}>
      <OrthographicCamera makeDefault position={[0, 0, 10]} />
      <XxxHookPlate variant={variant} instant={instant} />
    </Hud>
  );
}

const SIGHT_INK = "#111111";
const SIGHT_EDGE = "#f5f5f5";

function drawHuntSight(canvas: HTMLCanvasElement, recT: number) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  if (recT < -0.05 || recT >= 4) return;

  const lock = recT >= 2.55 && recT < 3.2;
  const slam = lock ? 0.82 : 1;
  const boxW = w * 0.62 * slam;
  const boxH = h * 0.34 * slam;
  const x = (w - boxW) * 0.5;
  const y = h * 0.42 - boxH * 0.5;
  const arm = Math.max(28, boxW * 0.12);
  const thick = lock ? 14 : 9;

  const corner = (cx: number, cy: number, dx: number, dy: number) => {
    ctx.beginPath();
    ctx.moveTo(cx, cy + dy * arm);
    ctx.lineTo(cx, cy);
    ctx.lineTo(cx + dx * arm, cy);
    ctx.stroke();
  };

  ctx.lineCap = "square";
  ctx.lineJoin = "miter";
  ctx.strokeStyle = SIGHT_INK;
  ctx.lineWidth = thick + 6;
  corner(x, y, 1, 1);
  corner(x + boxW, y, -1, 1);
  corner(x, y + boxH, 1, -1);
  corner(x + boxW, y + boxH, -1, -1);
  ctx.strokeStyle = SIGHT_EDGE;
  ctx.lineWidth = thick;
  corner(x, y, 1, 1);
  corner(x + boxW, y, -1, 1);
  corner(x, y + boxH, 1, -1);
  corner(x + boxW, y + boxH, -1, -1);

  if (!lock) {
    const sweep = (recT % 0.82) / 0.82;
    const ly = y + 8 + sweep * (boxH - 16);
    ctx.strokeStyle = "rgba(17,17,17,0.55)";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(x + 10, ly);
    ctx.lineTo(x + boxW - 10, ly);
    ctx.stroke();
    ctx.strokeStyle = "rgba(245,245,245,0.92)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + 10, ly);
    ctx.lineTo(x + boxW - 10, ly);
    ctx.stroke();
  } else {
    ctx.strokeStyle = SIGHT_EDGE;
    ctx.lineWidth = 3;
    ctx.strokeRect(x + 16, y + boxH * 0.5 - 2, boxW - 32, 4);
  }
}

function HuntSightPlate() {
  const size = useThree((s) => s.size);
  const mat = useRef<THREE.MeshBasicMaterial>(null);
  const tex = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 1080;
    c.height = 1080;
    drawHuntSight(c, 0);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.minFilter = THREE.LinearFilter;
    t.magFilter = THREE.LinearFilter;
    return t;
  }, []);

  useFrame(({ clock }) => {
    const recT = clock.elapsedTime - REEL_HOLD;
    drawHuntSight(tex.image as HTMLCanvasElement, recT);
    tex.needsUpdate = true;
    if (mat.current) mat.current.opacity = recT >= -0.05 && recT < 4 ? 1 : 0;
  });

  const width = size.width * 0.78;
  const height = width;
  const y = size.height * 0.04;

  return (
    <mesh position={[0, y, 0]} renderOrder={28}>
      <planeGeometry args={[width, height]} />
      <meshBasicMaterial ref={mat} map={tex} transparent opacity={0} depthTest={false} toneMapped={false} />
    </mesh>
  );
}

export function HuntSightHud() {
  return (
    <Hud renderPriority={4}>
      <OrthographicCamera makeDefault position={[0, 0, 10]} />
      <HuntSightPlate />
    </Hud>
  );
}

function drawSpinName(canvas: HTMLCanvasElement, text: string) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  ctx.miterLimit = 2;
  let size = Math.round(w * 0.11);
  ctx.font = `900 ${size}px Inter, Montserrat, Helvetica, Arial, sans-serif`;
  while (ctx.measureText(text).width > w * 0.9 && size > 48) {
    size -= 4;
    ctx.font = `900 ${size}px Inter, Montserrat, Helvetica, Arial, sans-serif`;
  }
  ctx.lineWidth = Math.max(10, size * 0.08);
  ctx.strokeStyle = "rgba(0,0,0,0.85)";
  ctx.fillStyle = "#ffffff";
  ctx.strokeText(text, w / 2, h / 2);
  ctx.fillText(text, w / 2, h / 2);
}

function SpinNamePlate({ names, soldiers }: { names: string[]; soldiers: number }) {
  const size = useThree((s) => s.size);
  const mat = useRef<THREE.MeshBasicMaterial>(null);
  const mesh = useRef<THREE.Mesh>(null);
  const pool = useMemo(() => spinNamePool(names, soldiers), [names, soldiers]);
  const winner = useMemo(() => {
    if (!pool.length) return "SEN";
    return pool[Math.floor(Math.random() * pool.length)];
  }, [pool]);
  const deck = useMemo(() => spinShuffle(pool, winner), [pool, winner]);
  const tex = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 2160;
    c.height = 640;
    drawSpinName(c, deck[0] || winner);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.minFilter = THREE.LinearFilter;
    t.magFilter = THREE.LinearFilter;
    return t;
  }, [deck, winner]);
  const last = useRef("");

  useEffect(() => {
    let alive = true;
    void document.fonts.load("900 80px Inter").then(() => {
      if (!alive) return;
      drawSpinName(tex.image as HTMLCanvasElement, last.current || deck[0] || winner);
      tex.needsUpdate = true;
    });
    return () => {
      alive = false;
    };
  }, [tex, deck, winner]);

  useFrame(({ clock }) => {
    const recT = clock.elapsedTime - REEL_HOLD;
    const shown = spinScramble(recT, deck, winner);
    if (last.current !== shown) {
      last.current = shown;
      drawSpinName(tex.image as HTMLCanvasElement, shown);
      tex.needsUpdate = true;
    }
    if (mat.current) mat.current.opacity = recT >= -0.05 ? 1 : 0;
    if (mesh.current) {
      let s = 1;
      if (recT >= SPIN_LOCK) {
        const u = Math.max(0, Math.min(1, (recT - SPIN_LOCK) / Math.max(0.4, SPIN_SECONDS - SPIN_LOCK)));
        const e = u * u * (3 - 2 * u);
        s = 1 + e * 2.6;
      }
      mesh.current.scale.set(s, s, 1);
    }
  });

  const width = size.width * 0.9;
  const height = width * (640 / 2160);

  return (
    <>
      <mesh position={[0, 0, -1]} renderOrder={25}>
        <planeGeometry args={[size.width * 2, size.height * 2]} />
        <meshBasicMaterial color="#000000" depthTest={false} toneMapped={false} />
      </mesh>
      <mesh ref={mesh} position={[0, 0, 0]} renderOrder={30}>
        <planeGeometry args={[width, height]} />
        <meshBasicMaterial ref={mat} map={tex} transparent opacity={0} depthTest={false} toneMapped={false} />
      </mesh>
    </>
  );
}

export function SpinNameHud({ names, soldiers }: { names: string[]; soldiers: number }) {
  return (
    <Hud renderPriority={4}>
      <OrthographicCamera makeDefault position={[0, 0, 10]} />
      <SpinNamePlate names={names} soldiers={soldiers} />
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

function strokeFillGold(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  size: number,
  stroke = 22
) {
  ctx.font = `800 ${size}px Outfit, system-ui, sans-serif`;
  ctx.lineJoin = "round";
  ctx.miterLimit = 2;
  ctx.lineWidth = stroke;
  ctx.strokeStyle = "rgba(0,0,0,0.9)";
  const grad = ctx.createLinearGradient(x, y - size * 0.45, x, y + size * 0.45);
  grad.addColorStop(0, "#fff4c8");
  grad.addColorStop(0.45, "#ffd54a");
  grad.addColorStop(1, "#e87818");
  ctx.fillStyle = grad;
  ctx.strokeText(text, x, y);
  ctx.fillText(text, x, y);
}

function strokeFillRed(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  size: number,
  stroke = 20
) {
  ctx.font = `800 ${size}px Outfit, system-ui, sans-serif`;
  ctx.lineJoin = "round";
  ctx.miterLimit = 2;
  ctx.lineWidth = stroke;
  ctx.strokeStyle = "rgba(0,0,0,0.9)";
  const grad = ctx.createLinearGradient(x, y - size * 0.4, x, y + size * 0.4);
  grad.addColorStop(0, "#ff8a80");
  grad.addColorStop(0.5, "#ff2a2a");
  grad.addColorStop(1, "#b80e0e");
  ctx.fillStyle = grad;
  ctx.strokeText(text, x, y);
  ctx.fillText(text, x, y);
}

function drawTitles(
  canvas: HTMLCanvasElement,
  phase:
    | "hook"
    | "army"
    | "cta"
    | "none"
    | "huntHook"
    | "huntArmy"
    | "huntPack"
    | "huntCta"
    | "sagaArmy"
    | "sagaWall"
    | "sagaVolley"
    | "sagaGate"
    | "sagaFight"
    | "sagaCta"
    | "discHook"
    | "discProof"
    | "discHold"
    | "discStorm"
    | "discNext"
    | "trailTitle"
    | "trailArmy"
    | "trailVolley"
    | "trailWall"
    | "trailGate"
    | "trailFight"
    | "trailCta"
    | "shelfHook"
    | "shelfArmy"
    | "shelfShare"
    | "shelfCta"
    | "cdHook"
    | "cd3"
    | "cd2"
    | "cd1"
    | "cdFire"
    | "cdProof"
    | "cdYou"
    | "cdCta"
    | "defHook",
  soldiers: number,
  day: number,
  packLabel = "",
  packHead = "",
  engage = false,
  join = false
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  if (phase === "none") return;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  if (phase === "huntHook") {
    if (join) {
      if (day > 0) {
        ctx.font = "800 88px Outfit, system-ui, sans-serif";
        strokeFill(ctx, `${day}. GÜN`, w / 2, 108, 22);
        ctx.font = "800 40px Outfit, system-ui, sans-serif";
        strokeFill(ctx, "BU ASKERLER", w / 2, 198, 13);
        ctx.font = "800 40px Outfit, system-ui, sans-serif";
        strokeFill(ctx, "ARAMIZA KATILDI", w / 2, 258, 13);
      } else {
        ctx.font = "800 52px Outfit, system-ui, sans-serif";
        strokeFill(ctx, "BU ASKERLER", w / 2, 130, 16);
        ctx.font = "800 52px Outfit, system-ui, sans-serif";
        strokeFill(ctx, "ARAMIZA KATILDI", w / 2, 210, 16);
      }
    } else {
      ctx.font = "800 72px Outfit, system-ui, sans-serif";
      strokeFill(ctx, "BU İSİMLER", w / 2, 108, 20);
      ctx.font = "800 72px Outfit, system-ui, sans-serif";
      strokeFill(ctx, "KALEYİ YIKIYOR", w / 2, 188, 20);
      ctx.font = "800 40px Outfit, system-ui, sans-serif";
      strokeFill(ctx, "takip etmezsen kale duruyor", w / 2, 268, 13);
    }
  } else if (phase === "huntArmy") {
    const count = formatCount(soldiers);
    ctx.font = "800 150px Outfit, system-ui, sans-serif";
    strokeFill(ctx, count, w / 2, 140, 26);
    ctx.font = "800 42px Outfit, system-ui, sans-serif";
    strokeFill(ctx, join ? "SAYIMIZ OLDU" : "HEPSİ GERÇEK HESAP", w / 2, 260, 14);
  } else if (phase === "huntPack") {
    ctx.font = "800 56px Outfit, system-ui, sans-serif";
    strokeFill(ctx, packHead || "TANIDIĞIN VAR MI?", w / 2, 58, 16);
    ctx.font = "800 40px Outfit, system-ui, sans-serif";
    strokeFill(ctx, packLabel || "GRUP", w / 2, 128, 12);
  } else if (phase === "huntCta") {
    if (join) {
      ctx.font = "800 48px Outfit, system-ui, sans-serif";
      strokeFill(ctx, "ADINI GÖRMEK İSTİYORSAN", w / 2, 108, 15);
      ctx.font = "800 52px Outfit, system-ui, sans-serif";
      strokeFill(ctx, "TAKİP ET · ORDUYA KATIL", w / 2, 188, 16);
      ctx.font = "800 44px Outfit, system-ui, sans-serif";
      strokeFill(ctx, "@wargame2028", w / 2, 268, 14);
    } else {
      ctx.font = "800 62px Outfit, system-ui, sans-serif";
      strokeFill(ctx, "ADIN YOKSA TAKİP ET", w / 2, 118, 18);
      ctx.font = "800 40px Outfit, system-ui, sans-serif";
      strokeFill(ctx, "sonraki reelde asker olursun", w / 2, 198, 13);
      ctx.font = "800 44px Outfit, system-ui, sans-serif";
      strokeFill(ctx, "@wargame2028", w / 2, 268, 14);
    }
  } else if (phase === "sagaArmy") {
    ctx.font = "800 72px Outfit, system-ui, sans-serif";
    strokeFill(ctx, "ORDUMUZ", w / 2, 150, 20);
    ctx.font = "800 40px Outfit, system-ui, sans-serif";
    strokeFill(ctx, "1 TAKİP = 1 ASKER", w / 2, 240, 13);
  } else if (phase === "sagaWall") {
    ctx.font = "800 58px Outfit, system-ui, sans-serif";
    strokeFill(ctx, "KALE BİZİ İZLİYOR", w / 2, 150, 18);
  } else if (phase === "sagaVolley") {
    ctx.font = "800 80px Outfit, system-ui, sans-serif";
    strokeFill(ctx, "ATEŞ", w / 2, 150, 22);
  } else if (phase === "sagaGate") {
    ctx.font = "800 64px Outfit, system-ui, sans-serif";
    strokeFill(ctx, "KAPI AÇILDI", w / 2, 150, 18);
  } else if (phase === "sagaFight") {
    ctx.font = "800 80px Outfit, system-ui, sans-serif";
    strokeFill(ctx, "SAVAŞ", w / 2, 150, 22);
  } else if (phase === "sagaCta") {
    ctx.font = "800 72px Outfit, system-ui, sans-serif";
    strokeFill(ctx, "ORDUYA KATIL", w / 2, 130, 20);
    ctx.font = "800 44px Outfit, system-ui, sans-serif";
    strokeFill(ctx, "@wargame2028", w / 2, 220, 14);
  } else if (phase === "discHook") {
    if (engage) {
      ctx.font = "800 68px Outfit, system-ui, sans-serif";
      strokeFill(ctx, "ADIN ÇIKARSA", w / 2, 118, 20);
      ctx.font = "800 64px Outfit, system-ui, sans-serif";
      strokeFill(ctx, "SAVAŞTAYIM YAZ", w / 2, 208, 19);
    } else {
      ctx.font = "800 68px Outfit, system-ui, sans-serif";
      strokeFill(ctx, "TAKİP ETMEZSEN", w / 2, 118, 20);
      ctx.font = "800 72px Outfit, system-ui, sans-serif";
      strokeFill(ctx, "KALE YIKILMIYOR", w / 2, 208, 20);
    }
  } else if (phase === "discProof") {
    const count = formatCount(soldiers);
    ctx.font = "800 150px Outfit, system-ui, sans-serif";
    strokeFill(ctx, count, w / 2, 130, 26);
    ctx.font = "800 40px Outfit, system-ui, sans-serif";
    strokeFill(ctx, engage ? "İSMİN BURADA MI?" : "HEPSİ GERÇEK HESAP", w / 2, 250, 14);
  } else if (phase === "discHold") {
    if (engage) {
      ctx.font = "800 52px Outfit, system-ui, sans-serif";
      strokeFill(ctx, "GÖRDÜYSEN YAZ", w / 2, 118, 16);
      ctx.font = "800 64px Outfit, system-ui, sans-serif";
      strokeFill(ctx, "SAVAŞTAYIM", w / 2, 208, 18);
    } else {
      ctx.font = "800 58px Outfit, system-ui, sans-serif";
      strokeFill(ctx, "TANIDIĞIN VAR MI?", w / 2, 118, 18);
      ctx.font = "800 40px Outfit, system-ui, sans-serif";
      strokeFill(ctx, "kaydırma — ismini ara", w / 2, 198, 13);
    }
  } else if (phase === "discStorm") {
    if (engage) {
      ctx.font = "800 68px Outfit, system-ui, sans-serif";
      strokeFill(ctx, "KALE DÜŞSÜN", w / 2, 118, 20);
      ctx.font = "800 48px Outfit, system-ui, sans-serif";
      strokeFill(ctx, "DİYE BEĞEN", w / 2, 214, 15);
    } else {
      ctx.font = "800 72px Outfit, system-ui, sans-serif";
      strokeFill(ctx, "KAPI AÇILDI", w / 2, 130, 20);
      ctx.font = "800 40px Outfit, system-ui, sans-serif";
      strokeFill(ctx, "kale düşüyor", w / 2, 214, 13);
    }
  } else if (phase === "discNext") {
    if (engage) {
      ctx.font = "800 52px Outfit, system-ui, sans-serif";
      strokeFill(ctx, "YAZ + BEĞEN", w / 2, 108, 16);
      ctx.font = "800 36px Outfit, system-ui, sans-serif";
      strokeFill(ctx, "sonraki saldırı gelsin", w / 2, 188, 12);
      ctx.font = "800 44px Outfit, system-ui, sans-serif";
      strokeFill(ctx, "@wargame2028", w / 2, 258, 14);
    } else {
      ctx.font = "800 58px Outfit, system-ui, sans-serif";
      strokeFill(ctx, "ADIN YOKSA TAKİP ET", w / 2, 108, 18);
      ctx.font = "800 36px Outfit, system-ui, sans-serif";
      strokeFill(ctx, "sonraki turda askersin", w / 2, 188, 12);
      ctx.font = "800 44px Outfit, system-ui, sans-serif";
      strokeFill(ctx, "@wargame2028", w / 2, 258, 14);
    }
  } else if (phase === "trailTitle") {
    if (day > 0) {
      ctx.font = "800 120px Outfit, system-ui, sans-serif";
      strokeFill(ctx, `${day}. GÜN`, w / 2, 118, 24);
      ctx.font = "800 48px Outfit, system-ui, sans-serif";
      strokeFill(ctx, "KUŞATMA SÜRÜYOR", w / 2, 228, 15);
    } else {
      ctx.font = "800 64px Outfit, system-ui, sans-serif";
      strokeFill(ctx, "KUŞATMA SÜRÜYOR", w / 2, 160, 18);
    }
  } else if (phase === "trailArmy") {
    const count = formatCount(soldiers);
    ctx.font = "800 140px Outfit, system-ui, sans-serif";
    strokeFill(ctx, count, w / 2, 124, 24);
    ctx.font = "800 36px Outfit, system-ui, sans-serif";
    strokeFill(ctx, "1 TAKİP = 1 ASKER", w / 2, 250, 12);
  } else if (phase === "trailVolley") {
    ctx.font = "800 88px Outfit, system-ui, sans-serif";
    strokeFill(ctx, "ATEŞ", w / 2, 150, 22);
  } else if (phase === "trailWall") {
    ctx.font = "800 52px Outfit, system-ui, sans-serif";
    strokeFill(ctx, "KALE BİZİ İZLİYOR", w / 2, 150, 16);
  } else if (phase === "trailGate") {
    ctx.font = "800 68px Outfit, system-ui, sans-serif";
    strokeFill(ctx, "KAPI AÇILDI", w / 2, 150, 20);
  } else if (phase === "trailFight") {
    ctx.font = "800 88px Outfit, system-ui, sans-serif";
    strokeFill(ctx, "SAVAŞ", w / 2, 150, 22);
  } else if (phase === "trailCta") {
    ctx.font = "800 52px Outfit, system-ui, sans-serif";
    strokeFill(ctx, "TAKİP ET · DESTEK OL", w / 2, 108, 16);
    ctx.font = "800 48px Outfit, system-ui, sans-serif";
    strokeFill(ctx, "ORDUYA KATIL", w / 2, 188, 15);
    ctx.font = "800 44px Outfit, system-ui, sans-serif";
    strokeFill(ctx, "@wargame2028", w / 2, 268, 14);
  } else if (phase === "shelfHook") {
    ctx.font = "800 120px Outfit, system-ui, sans-serif";
    strokeFill(ctx, "DUR", w / 2, 108, 26);
    ctx.font = "800 58px Outfit, system-ui, sans-serif";
    strokeFill(ctx, "1 ASKER EKSİĞİZ", w / 2, 208, 18);
    ctx.font = "800 36px Outfit, system-ui, sans-serif";
    strokeFill(ctx, "çünkü sen yoksun", w / 2, 278, 12);
  } else if (phase === "shelfArmy") {
    const count = formatCount(soldiers);
    ctx.font = "800 150px Outfit, system-ui, sans-serif";
    strokeFill(ctx, count, w / 2, 124, 26);
    ctx.font = "800 40px Outfit, system-ui, sans-serif";
    strokeFill(ctx, "1 TAKİP = 1 ASKER", w / 2, 250, 13);
  } else if (phase === "shelfShare") {
    ctx.font = "800 58px Outfit, system-ui, sans-serif";
    strokeFill(ctx, "VİDEOYU PAYLAŞ", w / 2, 118, 18);
    ctx.font = "800 48px Outfit, system-ui, sans-serif";
    strokeFill(ctx, "ORDUYA ASKER ÇAĞIR", w / 2, 214, 15);
  } else if (phase === "shelfCta") {
    ctx.font = "800 64px Outfit, system-ui, sans-serif";
    strokeFill(ctx, "TAKİP ET", w / 2, 108, 18);
    ctx.font = "800 40px Outfit, system-ui, sans-serif";
    strokeFill(ctx, "ORDUYA KATIL", w / 2, 188, 13);
    ctx.font = "800 44px Outfit, system-ui, sans-serif";
    strokeFill(ctx, "@wargame2028", w / 2, 268, 14);
  } else if (phase === "cdHook") {
    strokeFillRed(ctx, "DUR", w / 2, 102, 112, 24);
    ctx.font = "800 40px Outfit, system-ui, sans-serif";
    strokeFill(ctx, "3 SANİYE SONRA ATEŞ", w / 2, 186, 13);
    ctx.font = "800 30px Outfit, system-ui, sans-serif";
    strokeFill(ctx, "kaydırma — sonunu gör", w / 2, 232, 10);
  } else if (phase === "cd3") {
    strokeFillGold(ctx, "3", w / 2, 148, 220, 30);
  } else if (phase === "cd2") {
    strokeFillGold(ctx, "2", w / 2, 148, 220, 30);
  } else if (phase === "cd1") {
    strokeFillGold(ctx, "1", w / 2, 148, 220, 30);
  } else if (phase === "cdFire") {
    strokeFillRed(ctx, "ATEŞ", w / 2, 138, 132, 28);
    ctx.font = "800 40px Outfit, system-ui, sans-serif";
    strokeFill(ctx, "KALEYE SALDIRI", w / 2, 248, 13);
  } else if (phase === "cdProof") {
    const count = formatCount(soldiers);
    ctx.font = "800 150px Outfit, system-ui, sans-serif";
    strokeFill(ctx, count, w / 2, 124, 26);
    ctx.font = "800 44px Outfit, system-ui, sans-serif";
    strokeFill(ctx, "ASKER SAVAŞIYOR", w / 2, 250, 14);
    ctx.font = "800 36px Outfit, system-ui, sans-serif";
    strokeFill(ctx, "hepsi gerçek takipçi", w / 2, 302, 11);
  } else if (phase === "cdYou") {
    const next = formatCount(soldiers + 1);
    ctx.font = "800 120px Outfit, system-ui, sans-serif";
    strokeFill(ctx, next, w / 2, 118, 24);
    ctx.font = "800 58px Outfit, system-ui, sans-serif";
    strokeFill(ctx, "SENSİN", w / 2, 218, 18);
    ctx.font = "800 38px Outfit, system-ui, sans-serif";
    strokeFill(ctx, "takip et · +1 asker", w / 2, 288, 12);
  } else if (phase === "cdCta") {
    ctx.font = "800 52px Outfit, system-ui, sans-serif";
    strokeFill(ctx, "BEĞEN = ORDUYA DESTEK VER", w / 2, 98, 16);
    ctx.font = "800 56px Outfit, system-ui, sans-serif";
    strokeFill(ctx, "BURADAYIM YAZ", w / 2, 178, 17);
    ctx.font = "800 44px Outfit, system-ui, sans-serif";
    strokeFill(ctx, "@wargame2028", w / 2, 258, 14);
  } else if (phase === "defHook") {
    strokeFillRed(ctx, "KUŞATILDIK", w / 2, 118, 88, 22);
    ctx.font = "800 36px Outfit, system-ui, sans-serif";
    strokeFill(ctx, "çember daralıyor", w / 2, 208, 12);
  } else if (phase === "hook") {
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
  cinema?: boolean;
  roster?: PlanBId | null;
  saga?: SagaId | null;
  discover?: DiscoverId | null;
  countdown?: CountdownId | null;
  defend?: DefendId | null;
  names?: string[];
  rosterIds?: number[] | null;
};

function TitlesPlate({ soldiers, duration, day = 0, skipCommander = false, cinema = false, roster = null, saga = null, discover = null, countdown = null, defend = null, names = [], rosterIds = null }: ReelTitlesProps) {
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
    const scale = cinemaScale(duration);
    const ctaLen = cinema ? 1.6 * scale : Math.min(1.4, Math.max(0.9, duration * 0.18));
    const ctaAt = duration - ctaLen;
    const armyAt = cinema ? 15 * scale : cmd + turn * 0.22;
    const armyEnd = cinema ? 19.2 * scale : pullStart + 1.25;
    type Phase =
      | "hook"
      | "army"
      | "cta"
      | "none"
      | "huntHook"
      | "huntArmy"
      | "huntPack"
      | "huntCta"
      | "sagaArmy"
      | "sagaWall"
      | "sagaVolley"
      | "sagaGate"
      | "sagaFight"
      | "sagaCta"
      | "discHook"
      | "discProof"
      | "discHold"
      | "discStorm"
      | "discNext"
      | "trailTitle"
      | "trailArmy"
      | "trailVolley"
      | "trailWall"
      | "trailGate"
      | "trailFight"
      | "trailCta"
      | "shelfHook"
      | "shelfArmy"
      | "shelfShare"
      | "shelfCta"
      | "cdHook"
      | "cd3"
      | "cd2"
      | "cd1"
      | "cdFire"
      | "cdProof"
      | "cdYou"
      | "cdCta"
      | "defHook";
    let phase: Phase = "none";
    let alpha = 0;
    let packLabel = "";
    let packHead = "";
    const engage = isDiscoverEngage(discover);
    const join = isJoin(roster);
    if (defend) {
      const beat = defendBeat(recT, defend);
      const play = defendPlayhead(recT, defend);
      if (recT < 0 || beat !== "hook") {
        phase = "none";
        alpha = 0;
      } else {
        phase = "defHook";
        alpha = recT < 0.12 ? recT / 0.12 : 1;
        const left = DEFEND_HOOK_END - play;
        if (left < 0.14) alpha = Math.max(0, left / 0.14);
      }
    } else if (countdown) {
      const beat = countdownBeat(recT);
      if (recT < 0) {
        phase = "none";
        alpha = 0;
      } else {
        phase =
          beat === "hook"
            ? "cdHook"
            : beat === "count3"
              ? "cd3"
              : beat === "count2"
                ? "cd2"
                : beat === "count1"
                  ? "cd1"
                  : beat === "fire"
                    ? "cdFire"
                    : beat === "proof"
                      ? "cdProof"
                      : beat === "you"
                        ? "cdYou"
                        : "cdCta";
        alpha = recT < 0.1 ? recT / 0.1 : 1;
        if (beat === "hook") {
          const left = 1.2 - recT;
          if (left < 0.12) alpha = Math.max(0, left / 0.12);
        }
        if (beat === "count3" || beat === "count2" || beat === "count1") {
          const into = recT - (beat === "count3" ? 1.2 : beat === "count2" ? 2.4 : 3.6);
          if (into < 0.08) alpha = into / 0.08;
          const left = (beat === "count3" ? 2.4 : beat === "count2" ? 3.6 : 4.8) - recT;
          if (left < 0.1) alpha = Math.max(0, left / 0.1);
        }
        if (beat === "fire") {
          const into = recT - 4.8;
          if (into < 0.1) alpha = into / 0.1;
        }
        if (beat === "cta" && recT > 13.5) alpha = Math.max(0, (14 - recT) / 0.5);
      }
    } else if (isDiscoverTrailer(discover)) {
      const beat = trailerBeat(recT);
      if (recT < 0) {
        phase = "none";
        alpha = 0;
      } else {
        phase =
          beat === "title"
            ? "trailTitle"
            : beat === "army"
              ? "trailArmy"
              : beat === "volley"
                ? "trailVolley"
                : beat === "wall"
                  ? "trailWall"
                  : beat === "gate"
                    ? "trailGate"
                    : beat === "fight"
                      ? "trailFight"
                      : "trailCta";
        alpha = recT < 0.16 ? recT / 0.16 : 1;
        if (beat === "volley" || beat === "wall" || beat === "gate" || beat === "fight") {
          const into = recT - (beat === "volley" ? 8.4 : beat === "wall" ? 13.6 : beat === "gate" ? 19.2 : 25);
          const left =
            (beat === "volley" ? 13.6 : beat === "wall" ? 19.2 : beat === "gate" ? 25 : 32.4) - recT;
          if (into < 0.28) alpha = into / 0.28;
          else if (left < 0.32) alpha = Math.max(0, left / 0.32);
        }
      }
    } else if (isDiscoverShelf(discover)) {
      const beat = shelfBeat(recT);
      if (recT < 0) {
        phase = "none";
        alpha = 0;
      } else {
        phase =
          beat === "hook" ? "shelfHook" : beat === "army" ? "shelfArmy" : beat === "share" ? "shelfShare" : "shelfCta";
        alpha = recT < 0.12 ? recT / 0.12 : 1;
        if (beat === "hook" && recT > 1.88) alpha = Math.max(0.35, (2.2 - recT) / 0.32);
        if (beat === "share") {
          const into = recT - 6.8;
          if (into < 0.22) alpha = into / 0.22;
        }
        if (beat === "cta" && recT > 13.45) alpha = Math.max(0, (14 - recT) / 0.55);
      }
    } else if (discover) {
      const beat = discoverBeat(recT);
      if (recT < 0) {
        phase = "none";
        alpha = 0;
      } else if (beat === "hook") {
        phase = "discHook";
        alpha = recT < 0.14 ? recT / 0.14 : recT > DISCOVER_HOOK_END - 0.33 ? Math.max(0, (DISCOVER_HOOK_END - recT) / 0.33) : 1;
      } else if (beat === "proof") {
        phase = "discProof";
        alpha = 1;
      } else if (beat === "hold") {
        phase = "discHold";
        alpha = 1;
      } else if (beat === "storm") {
        phase = "discStorm";
        alpha = 1;
      } else if (beat === "next") {
        phase = "discNext";
        alpha = recT > 12.95 ? Math.max(0, (13.25 - recT) / 0.3) : 1;
      } else {
        phase = "none";
        alpha = 0;
      }
    } else if (saga) {
      const beat = sagaBeat(saga, recT, duration);
      phase =
        beat === "army"
          ? "sagaArmy"
          : beat === "wall"
            ? "sagaWall"
            : beat === "volley"
              ? "sagaVolley"
              : beat === "gate"
                ? "sagaGate"
                : beat === "fight"
                  ? "sagaFight"
                  : "sagaCta";
      alpha = recT < 0 ? 0 : recT < 0.12 ? recT / 0.12 : 1;
    } else if (roster) {
      const ids = rosterIds?.length ? rosterIds : rosterSoldierIds(names, soldiers);
      const beat = rosterBeat(roster, recT, duration, ids);
      const tl = rosterTimeline(roster, ids.length, duration);
      if (beat.id === "hook") {
        phase = "huntHook";
        alpha = recT < 0.1 ? recT / 0.1 : recT > tl.hook - 0.32 ? Math.max(0, (tl.hook - recT) / 0.32) : 1;
      } else if (beat.id === "overview") {
        phase = "huntArmy";
        alpha = 1;
      } else if (beat.id === "pack") {
        phase = "huntPack";
        const lastPack = beat.pack >= beat.packs - 1;
        packLabel = lastPack ? `SON · ${beat.pack + 1}/${beat.packs}` : `${beat.pack + 1} / ${beat.packs}`;
        packHead = join
          ? lastPack
            ? "SEN DE KATIL"
            : "YENİ ASKERLER"
          : lastPack
            ? "SEN YOKSUN?"
            : beat.pack % 3 === 1
              ? "BU HESAPLAR GERÇEK"
              : beat.pack % 3 === 2
                ? "SIRADAKİ SEN OL"
                : "TANIDIĞIN VAR MI?";
        alpha = beat.outgoing.length || beat.u < 0.16 ? 1 : 0.92;
      } else {
        phase = "huntCta";
        alpha = 1;
      }
      if (recT < 0) {
        phase = "none";
        alpha = 0;
      }
    } else if (recT >= 0 && recT < 2.15) {
      phase = "hook";
      if (recT < 0.12) alpha = recT / 0.12;
      else if (recT > 1.75) alpha = Math.max(0, (2.15 - recT) / 0.4);
      else alpha = 1;
    } else if (recT >= armyAt && recT < armyEnd) {
      phase = "army";
      const into = recT - armyAt;
      const left = armyEnd - recT;
      if (into < 0.35) alpha = into / 0.35;
      else if (left < 0.35) alpha = Math.max(0, left / 0.35);
      else alpha = 1;
    } else if (recT >= ctaAt && recT <= duration + 0.2) {
      phase = "cta";
      const into = recT - ctaAt;
      if (into < 0.3) alpha = into / 0.3;
      else alpha = 1;
    }
    const key = `${phase}:${soldiers}:${day}:${packLabel}:${packHead}:${engage}:${join}`;
    if (last.current !== key) {
      last.current = key;
      drawTitles(canvas, phase, soldiers, day, packLabel, packHead, engage, join);
      tex.needsUpdate = true;
    }
    if (mat.current) mat.current.opacity = alpha;
    if (mesh.current) {
      mesh.current.scale.set(1, 1, 1);
      if (phase === "cdHook") {
        mesh.current.position.y = size.height * 0.325;
        mesh.current.scale.set(1, 0.82, 1);
      } else if (
        phase === "hook" ||
        phase === "huntHook" ||
        phase === "huntArmy" ||
        phase.startsWith("saga") ||
        phase.startsWith("disc") ||
        phase.startsWith("trail") ||
        phase.startsWith("shelf") ||
        phase.startsWith("cd") ||
        phase.startsWith("def")
      ) {
        mesh.current.position.y = size.height * 0.3;
      } else if (phase === "army") {
        mesh.current.position.y = size.height * 0.28;
      } else if (phase === "huntPack") {
        mesh.current.position.y = size.height * 0.38;
      } else if (phase === "cta" || phase === "huntCta") {
        const hpH = Math.max(64, size.height * 0.1);
        const hpY = size.height / 2 - hpH / 2 - Math.max(12, size.height * 0.02);
        const hpBottom = hpY - hpH / 2;
        const hookH = Math.max(160, size.height * 0.32);
        mesh.current.position.y = roster ? size.height * 0.28 : hpBottom - Math.max(8, size.height * 0.01) - hookH / 2;
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

function CountdownFlashPlate() {
  const size = useThree((s) => s.size);
  const mat = useRef<THREE.MeshBasicMaterial>(null);

  useFrame(({ clock }) => {
    const recT = clock.elapsedTime - REEL_HOLD;
    const a = countdownFlash(recT);
    if (mat.current) {
      mat.current.opacity = a;
      mat.current.color.setRGB(1, 0.92 + a * 0.06, 0.82 + a * 0.12);
    }
  });

  return (
    <mesh position={[0, 0, 3]} renderOrder={90}>
      <planeGeometry args={[size.width * 2, size.height * 2]} />
      <meshBasicMaterial ref={mat} color="#fff0d0" transparent opacity={0} depthTest={false} toneMapped={false} />
    </mesh>
  );
}

export function CountdownFlash() {
  return (
    <Hud renderPriority={4}>
      <OrthographicCamera makeDefault position={[0, 0, 10]} />
      <CountdownFlashPlate />
    </Hud>
  );
}

function New2RatioPlate({ soldiers, drop = 0, bridge = false }: { soldiers: number; drop?: number; bridge?: boolean }) {
  const size = useThree((s) => s.size);
  const tex = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 248;
    const map = new THREE.CanvasTexture(canvas);
    map.colorSpace = THREE.SRGBColorSpace;
    return map;
  }, []);
  const seen = useRef("");

  useFrame(({ clock }) => {
    const recT = Math.max(0, clock.elapsedTime - REEL_HOLD);
    const { friends, foes } = bridge ? new5AliveCounts(soldiers, recT) : new2AliveCounts(soldiers, recT);
    const key = `${friends}:${foes}`;
    const canvas = tex.image as HTMLCanvasElement;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    if (key !== seen.current) {
      seen.current = key;
      ctx.clearRect(0, 0, 1024, 150);
      const total = Math.max(1, friends + foes);
      const innerX = 28;
      const innerY = 22;
      const innerW = 968;
      const innerH = 92;
      const blueW = (friends / total) * innerW;
      ctx.fillStyle = "#1a56e8";
      ctx.fillRect(innerX, innerY, Math.max(0, blueW), innerH);
      ctx.fillStyle = "#d31c1c";
      ctx.fillRect(innerX + blueW, innerY, Math.max(0, innerW - blueW), innerH);
      ctx.strokeStyle = "#ffe14a";
      ctx.lineWidth = 14;
      ctx.strokeRect(innerX - 8, innerY - 8, innerW + 16, innerH + 16);
      ctx.font = "900 48px Inter, sans-serif";
      ctx.textBaseline = "middle";
      ctx.lineWidth = 8;
      ctx.strokeStyle = "rgba(0,0,0,0.72)";
      ctx.fillStyle = "#ffffff";
      ctx.textAlign = "left";
      ctx.strokeText(formatCount(friends), 46, innerY + innerH / 2);
      ctx.fillText(formatCount(friends), 46, innerY + innerH / 2);
      ctx.textAlign = "right";
      ctx.strokeText(formatCount(foes), 978, innerY + innerH / 2);
      ctx.fillText(formatCount(foes), 978, innerY + innerH / 2);
    }
    const pulse = 0.55 + 0.45 * Math.abs(Math.sin(recT * 5.2));
    ctx.clearRect(0, 150, 1024, 98);
    ctx.font = "900 90px Inter, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineWidth = 12;
    ctx.strokeStyle = `rgba(0,0,0,${0.55 + pulse * 0.35})`;
    ctx.fillStyle = `rgb(255, ${Math.round(18 + (1 - pulse) * 40)}, ${Math.round(12 + (1 - pulse) * 18)})`;
    ctx.strokeText("DUR", 512, 186);
    ctx.fillText("DUR", 512, 186);
    tex.needsUpdate = true;
  });

  const w = size.width * 0.88;
  const h = w * (248 / 1024);
  return (
    <mesh position={[0, size.height / 2 - h * 0.62 - 36 - drop, 4]} renderOrder={30}>
      <planeGeometry args={[w, h]} />
      <meshBasicMaterial map={tex} transparent depthTest={false} toneMapped={false} />
    </mesh>
  );
}

export function New2RatioBar({ soldiers, drop = 0, bridge = false }: { soldiers: number; drop?: number; bridge?: boolean }) {
  return (
    <Hud renderPriority={3}>
      <OrthographicCamera makeDefault position={[0, 0, 10]} />
      <New2RatioPlate soldiers={soldiers} drop={drop} bridge={bridge} />
    </Hud>
  );
}

