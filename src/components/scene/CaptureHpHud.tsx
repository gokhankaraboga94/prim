import { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Hud, OrthographicCamera } from "@react-three/drei";
import * as THREE from "three";
import { DPS_PER_SOLDIER, formatCount } from "../../game";
import { REEL_FADE_HOLD, REEL_HOLD, reelBeats, reelFade } from "../../recordCanvas";
import { cinemaScale } from "../../shotModes";
import { rosterBeat, rosterSoldierIds, rosterTimeline, type PlanBId } from "../../rosterReel";

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
};

function HpPlate({ hp, maxHp, soldiers, duration = 8, skipCommander = false, cinema = false, roster = null }: CaptureHpHudProps) {
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
    if (roster) {
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
  const y = roster
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
  phase: "hook" | "army" | "cta" | "none" | "huntHook" | "huntArmy" | "huntPack" | "huntCta",
  soldiers: number,
  day: number,
  packLabel = "",
  packHead = ""
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
    ctx.font = "800 72px Outfit, system-ui, sans-serif";
    strokeFill(ctx, "BU İSİMLER", w / 2, 108, 20);
    ctx.font = "800 72px Outfit, system-ui, sans-serif";
    strokeFill(ctx, "KALEYİ YIKIYOR", w / 2, 188, 20);
    ctx.font = "800 40px Outfit, system-ui, sans-serif";
    strokeFill(ctx, "takip etmezsen kale duruyor", w / 2, 268, 13);
  } else if (phase === "huntArmy") {
    const count = formatCount(soldiers);
    ctx.font = "800 150px Outfit, system-ui, sans-serif";
    strokeFill(ctx, count, w / 2, 140, 26);
    ctx.font = "800 42px Outfit, system-ui, sans-serif";
    strokeFill(ctx, "HEPSİ GERÇEK HESAP", w / 2, 260, 14);
  } else if (phase === "huntPack") {
    ctx.font = "800 56px Outfit, system-ui, sans-serif";
    strokeFill(ctx, packHead || "TANIDIĞIN VAR MI?", w / 2, 58, 16);
    ctx.font = "800 40px Outfit, system-ui, sans-serif";
    strokeFill(ctx, packLabel || "GRUP", w / 2, 128, 12);
  } else if (phase === "huntCta") {
    ctx.font = "800 62px Outfit, system-ui, sans-serif";
    strokeFill(ctx, "ADIN YOKSA TAKİP ET", w / 2, 118, 18);
    ctx.font = "800 40px Outfit, system-ui, sans-serif";
    strokeFill(ctx, "sonraki reelde asker olursun", w / 2, 198, 13);
    ctx.font = "800 44px Outfit, system-ui, sans-serif";
    strokeFill(ctx, "@wargame2028", w / 2, 268, 14);
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
  names?: string[];
};

function TitlesPlate({ soldiers, duration, day = 0, skipCommander = false, cinema = false, roster = null, names = [] }: ReelTitlesProps) {
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
    type Phase = "hook" | "army" | "cta" | "none" | "huntHook" | "huntArmy" | "huntPack" | "huntCta";
    let phase: Phase = "none";
    let alpha = 0;
    let packLabel = "";
    let packHead = "";
    if (roster) {
      const ids = rosterSoldierIds(names, soldiers);
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
        packHead = lastPack
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
    const key = `${phase}:${soldiers}:${day}:${packLabel}:${packHead}`;
    if (last.current !== key) {
      last.current = key;
      drawTitles(canvas, phase, soldiers, day, packLabel, packHead);
      tex.needsUpdate = true;
    }
    if (mat.current) mat.current.opacity = alpha;
    if (mesh.current) {
      if (phase === "hook" || phase === "huntHook" || phase === "huntArmy") {
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
