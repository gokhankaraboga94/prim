export const KARSI_ID = "karsi" as const;
export type KarsiId = typeof KARSI_ID;
export const KARSI_MODE = { id: KARSI_ID, label: "karşı takipçi" } as const;
export const KARSI_SECONDS = 20;
export const KARSI0_ID = "karsi0" as const;
export type Karsi0Id = typeof KARSI0_ID;
export const KARSI0_MODE = { id: KARSI0_ID, label: "karşıtakipçi0" } as const;
export const KARSI0_SECONDS = 16;
export const KARSI2_ID = "karsi2" as const;
export type Karsi2Id = typeof KARSI2_ID;
export const KARSI2_MODE = { id: KARSI2_ID, label: "karşı takipçi2" } as const;
export const KARSI2_SECONDS = KARSI_SECONDS;
export const KARSI_ME = "wargame2028";
export const KARSI_HERO_ME = "/models/arena3/armored.glb";
export const KARSI_HERO_FOE = "/models/arena3/2.glb";

/** Rival account and its follower count, asked when the button is pressed. */
export type Rival = { name: string; foes: number; invite?: boolean; foeNames?: string[] };

/** karşıtakipçi0: no rival yet, only our army on the field. */
export const KARSI0_RIVAL: Rival = { name: "", foes: 0, invite: true };

/** Instanced bodies drawn per side; the score plate always shows the real counts. */
const SHOW_FRIENDS = 2000;
const SHOW_FOES = 4000;
const SHOW_MOBILE = 480;

function bodyCap(high: number) {
  if (typeof window === "undefined") return high;
  try {
    if (window.matchMedia("(pointer: coarse)").matches || window.innerWidth <= 900) return Math.min(high, SHOW_MOBILE);
  } catch {
    /* ignore */
  }
  return high;
}

const PITCH_US = 2.22;
const PITCH_FOE = 3.0;
const LANE_US = 1.62;
const LANE_FOE = 1.85;
const T_CHARGE = 3.2;
const T_MEET = 6.4;
const T_END = 15.5;
const START_GAP = 30;
const CONTACT = 1.1;
const PUSH = 5;
const FALL = 0.75;

export function isKarsi(id: string | null | undefined): id is KarsiId {
  return id === KARSI_ID;
}

export function isKarsi0(id: string | null | undefined): id is Karsi0Id {
  return id === KARSI0_ID;
}

export function isKarsi2(id: string | null | undefined): id is Karsi2Id {
  return id === KARSI2_ID;
}

export function isKarsiMode(id: string | null | undefined): id is KarsiId | Karsi0Id | Karsi2Id {
  return id === KARSI_ID || id === KARSI0_ID || id === KARSI2_ID;
}

export function cleanRival(name: string) {
  return String(name || "").trim().replace(/^@+/, "").replace(/\s+/g, "");
}

/** Admin button: ask for the rival account, then its follower count. Cancel returns null. */
export function askRivalName(saved = "") {
  return cleanRival(window.prompt("Karşı taraf kimin hesabı? Düşman komutan bu olacak.", saved) || "");
}

export function sameRival(a: string, b: string) {
  return cleanRival(a).toLowerCase() === cleanRival(b).toLowerCase();
}

export function askRival(): Rival | null {
  const name = askRivalName();
  if (!name) return null;
  const foes = parseFollowers(window.prompt(`${name} kaç takipçi? O kadar düşman askeri gelir.`, "") || "");
  if (foes <= 0) return null;
  return { name, foes };
}

/** "15.000", "15000", "15k", "1,2m" → integer follower count. */
export function parseFollowers(raw: string) {
  const text = String(raw || "").trim().toLowerCase().replace(/\s+/g, "");
  const unit = text.endsWith("m") ? 1e6 : text.endsWith("k") || text.endsWith("b") ? 1e3 : 1;
  const body = unit > 1 ? text.slice(0, -1) : text;
  const value = unit > 1 ? Number(body.replace(",", ".")) : Number(body.replace(/[.,]/g, ""));
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.round(value * unit);
}

function clamp01(u: number) {
  return Math.max(0, Math.min(1, u));
}

function ease(u: number) {
  const x = clamp01(u);
  return x * x * (3 - 2 * x);
}

function hash(i: number, salt: number) {
  let n = Math.imul(i + 1, 374761393) + Math.imul(salt, 668265263);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

export type KarsiSide = {
  real: number;
  n: number;
  cols: number;
  rows: number;
  pitch: number;
  x: Float32Array;
  row: Uint16Array;
  phase: Float32Array;
  die: Float32Array;
  loss: number;
  depth: number;
};

export type KarsiLayout = {
  us: KarsiSide;
  them: KarsiSide;
  weWin: boolean;
  invite: boolean;
  width: number;
  depth: number;
  liveX: Float32Array;
  liveZ: Float32Array;
  liveFall: Float32Array;
  foeX: Float32Array;
  foeZ: Float32Array;
  foeFall: Float32Array;
};

/** Deep, narrow blocks so both armies fit a portrait frame. */
function makeSide(real: number, cap: number, lossFrac: number, salt: number, pitch: number, lane: number): KarsiSide {
  const n = Math.max(0, Math.min(cap, Math.floor(real)));
  const cols = Math.max(1, Math.ceil(Math.sqrt(n / 1.6)));
  const rows = Math.max(1, Math.ceil(n / cols));
  const side: KarsiSide = {
    real,
    n,
    cols,
    rows,
    pitch,
    x: new Float32Array(n),
    row: new Uint16Array(n),
    phase: new Float32Array(n),
    die: new Float32Array(n).fill(1e9),
    loss: Math.min(n, Math.round(n * lossFrac)),
    depth: Math.max(0, rows - 1) * pitch,
  };
  for (let i = 0; i < n; i++) {
    const row = Math.floor(i / cols);
    const col = i % cols;
    const inRow = row === rows - 1 ? n - row * cols : cols;
    const off = (col - (inRow - 1) / 2) * pitch;
    side.x[i] = off + Math.sign(off || (col % 2 ? 1 : -1)) * lane;
    side.row[i] = row;
    side.phase[i] = hash(i, salt) * 1.1;
  }
  const order = Array.from({ length: n }, (_, i) => i);
  order.sort((a, b) => side.row[a] - side.row[b] || hash(a, salt + 7) - hash(b, salt + 7));
  const t0 = T_MEET + 0.35;
  for (let k = 0; k < side.loss; k++) {
    side.die[order[k]] = t0 + (T_END - t0) * (side.loss <= 1 ? 0 : k / (side.loss - 1));
  }
  return side;
}

/**
 * The larger army wins. Winner losses follow the square law, so a close fight is
 * bloody and a lopsided one barely scratches the winner. A tie keeps a handful alive.
 */
export function makeKarsiLayout(friends: number, foes: number, invite = false): KarsiLayout {
  const a = Math.max(0, Math.floor(friends));
  const b = invite ? 0 : Math.max(0, Math.floor(foes));
  const weWin = a >= b;
  const big = Math.max(1, weWin ? a : b);
  const small = weWin ? b : a;
  const winLoss = invite ? 0 : Math.min(0.97, 1 - Math.sqrt(Math.max(0, 1 - (small / big) ** 2)));
  const us = makeSide(a, bodyCap(SHOW_FRIENDS), invite ? 0 : weWin ? winLoss : 1, 3, PITCH_US, LANE_US);
  const them = makeSide(b, bodyCap(SHOW_FOES), invite ? 0 : weWin ? 1 : winLoss, 11, PITCH_FOE, LANE_FOE);
  const width = Math.max(us.cols * us.pitch, Math.max(1, them.cols) * them.pitch) + Math.max(LANE_US, LANE_FOE) * 2;
  return {
    us,
    them,
    weWin,
    invite,
    width,
    depth: us.depth + (invite ? START_GAP + 24 : them.depth + START_GAP),
    liveX: new Float32Array(us.n),
    liveZ: new Float32Array(us.n),
    liveFall: new Float32Array(us.n),
    foeX: new Float32Array(them.n),
    foeZ: new Float32Array(them.n),
    foeFall: new Float32Array(them.n),
  };
}

/** Front line: armies charge to it, then it drifts toward the losing side. */
export function karsiMeet(layout: KarsiLayout, t: number) {
  if (layout.invite) return 0;
  return (layout.weWin ? 1 : -1) * PUSH * ease((t - T_MEET) / (T_END - T_MEET));
}

function front(layout: KarsiLayout, t: number, sign: number) {
  const start = START_GAP / 2;
  if (layout.invite) return sign * start;
  const march = ease((t - T_CHARGE) / (T_MEET - T_CHARGE));
  return karsiMeet(layout, t) + sign * (start + (CONTACT - start) * march);
}

function deadRows(side: KarsiSide, t: number) {
  const t0 = T_MEET + 0.35;
  const dead = side.loss * clamp01((t - t0) / (T_END - t0));
  return dead / side.cols;
}

export type KarsiPose = { x: number; z: number; yaw: number; fall: number; lift: number; chop: number };

/** Arm only: windup, chop, recover. The body stays planted. */
function swing(t: number, phase: number) {
  const u = ((t + phase) % 1.1) / 1.1;
  if (u < 0.42) {
    const k = Math.sin((u / 0.42) * Math.PI * 0.5);
    return { lift: k, chop: 0 };
  }
  if (u < 0.56) {
    const k = (u - 0.42) / 0.14;
    return { lift: 1 - k, chop: k };
  }
  return { lift: 0, chop: Math.max(0, 1 - (u - 0.56) / 0.4) };
}

function sidePose(layout: KarsiLayout, side: KarsiSide, i: number, t: number, sign: number, out: KarsiPose) {
  if (layout.invite) {
    out.x = side.x[i];
    out.z = front(layout, t, sign) + sign * side.row[i] * side.pitch;
    out.yaw = 0;
    out.fall = 0;
    out.lift = 0;
    out.chop = 0;
    return out;
  }
  const die = side.die[i];
  const at = Math.min(t, die);
  const lag = Math.max(0, side.row[i] - deadRows(side, at));
  out.x = side.x[i];
  out.z = front(layout, at, sign) + sign * lag * side.pitch;
  out.yaw = 0;
  out.fall = t > die ? ease((t - die) / FALL) : 0;
  out.lift = 0;
  out.chop = 0;
  if (out.fall > 0) return out;
  const winner = (sign < 0) === layout.weWin;
  if (t > T_END + 0.4 && winner) {
    out.lift = 0.95 * ease((t - T_END - 0.4) / 0.5);
    return out;
  }
  if (t > T_MEET - 0.4 && t < T_END + 0.4 && lag < 1.4) {
    const hit = swing(t, side.phase[i]);
    out.lift = hit.lift;
    out.chop = hit.chop;
  }
  return out;
}

export function karsiFriend(layout: KarsiLayout, i: number, t: number, out: KarsiPose) {
  return sidePose(layout, layout.us, i, t, -1, out);
}

export function karsiFoe(layout: KarsiLayout, i: number, t: number, out: KarsiPose) {
  return sidePose(layout, layout.them, i, t, 1, out);
}

export type KarsiChief = { x: number; z: number; yaw: number; kneel: number; lift: number; chop: number };

/** Commanders lead the charge, duel in the centre lane; the loser kneels at the end. */
export function karsiChief(layout: KarsiLayout, mine: boolean, t: number, out: KarsiChief) {
  const sign = mine ? -1 : 1;
  if (layout.invite) {
    out.x = 0;
    out.z = front(layout, t, sign) - sign * 2.4;
    out.yaw = 0;
    out.kneel = 0;
    out.chop = 0;
    out.lift = t > 12.2 ? ease((t - 12.2) / 0.55) : 0;
    return out;
  }
  const ahead = 2.4 * (1 - ease((t - T_CHARGE) / (T_MEET - T_CHARGE)));
  out.x = 0;
  out.z = front(layout, t, sign) - sign * ahead;
  out.yaw = mine ? 0 : Math.PI;
  const lost = mine !== layout.weWin;
  out.kneel = lost ? ease((t - T_END) / 0.9) : 0;
  out.lift = 0;
  out.chop = 0;
  if (out.kneel > 0) return out;
  if (!lost && t > T_END + 0.4) {
    out.lift = ease((t - T_END - 0.4) / 0.5);
    return out;
  }
  if (t > T_MEET - 0.5 && t < T_END) {
    const hit = swing(t, mine ? 0 : 0.55);
    out.lift = hit.lift;
    out.chop = hit.chop;
  }
  return out;
}

export function karsiEndAt(invite = false) {
  return invite ? 12.6 : T_END;
}

type Cam = { x: number; y: number; z: number; lx: number; ly: number; lz: number; fov: number };

function orbit(lx: number, ly: number, lz: number, dist: number, elev: number, yaw: number, fov: number): Cam {
  const e = (elev * Math.PI) / 180;
  const ring = Math.cos(e) * dist;
  return { x: lx + Math.sin(yaw) * ring, y: ly + Math.sin(e) * dist, z: lz - Math.cos(yaw) * ring, lx, ly, lz, fov };
}

function mixCam(a: Cam, b: Cam, u: number): Cam {
  const k = ease(u);
  return {
    x: a.x + (b.x - a.x) * k,
    y: a.y + (b.y - a.y) * k,
    z: a.z + (b.z - a.z) * k,
    lx: a.lx + (b.lx - a.lx) * k,
    ly: a.ly + (b.ly - a.ly) * k,
    lz: a.lz + (b.lz - a.lz) * k,
    fov: a.fov + (b.fov - a.fov) * k,
  };
}

/** Portrait half-width at distance d for a 50° vertical fov: tan(14.7°). */
const HALF_W = 0.262;

function wideDist(layout: KarsiLayout) {
  return Math.max(36, (layout.width * 0.55) / HALF_W);
}

/**
 * Close on both commanders, pull out to show both armies whole, settle on the front
 * line for the fight, then swing round to the winning commander.
 */
function look(x: number, y: number, z: number, lx: number, ly: number, lz: number, fov: number): Cam {
  return { x, y, z, lx, ly, lz, fov };
}

/**
 * Invite reel. First 3 s stay tight: over the commander's shoulder, looking at the
 * empty grass where a rival army would stand. Then the whole army, then that vacant
 * field, then back to the commander.
 */
function karsiInviteCam(layout: KarsiLayout, t: number): Cam {
  const line = -START_GAP / 2;
  const chiefZ = line + 2.4;
  const armyMid = line - layout.us.depth * 0.42;
  const empty = START_GAP / 2 + 10;
  const open = look(3.2, 1.78, chiefZ - 4.6, 0.15, 1.48, empty * 0.22, 40);
  const hold = look(2.4, 1.92, chiefZ - 6.4, 0.1, 1.42, 7.2, 42);
  const whole = orbit(0, 0.6, armyMid, Math.max(32, layout.width * 0.82), 38, 0.06, 48);
  const vacant = look(10, 7.4, 2, 0, 0.35, empty, 46);
  const close = look(-4.6, 2.15, chiefZ - 8.2, 0, 1.85, chiefZ + 2.2, 44);
  if (t < 3) return mixCam(open, hold, t / 3);
  if (t < 7) return mixCam(hold, whole, (t - 3) / 4);
  if (t < 11) return mixCam(whole, vacant, (t - 7) / 4);
  return mixCam(vacant, close, Math.min(1, (t - 11) / 3.6));
}

export function karsiCam(layout: KarsiLayout, t: number): Cam {
  if (layout.invite) return karsiInviteCam(layout, t);
  const meet = karsiMeet(layout, t);
  const close = orbit(0, 1.8, front(layout, t, -1) + 1.4, 17, 20, 0, 46);
  const midZ = (layout.them.depth - layout.us.depth) * 0.5;
  const wide = orbit(0, 0, midZ, wideDist(layout), 46, 0, 50);
  const mid = orbit(0, 1.2, meet, Math.min(wideDist(layout) * 0.6, Math.max(30, layout.width * 0.9)), 36, Math.sin(t * 0.18) * 0.12, 48);
  const win = karsiChief(layout, layout.weWin, t, { x: 0, z: 0, yaw: 0, kneel: 0, lift: 0, chop: 0 });
  const end = orbit(win.x, 2.4, win.z, 15, 16, layout.weWin ? Math.PI * 0.78 : Math.PI * 0.22, 44);
  if (t < 2.6) return close;
  if (t < 5.4) return mixCam(close, wide, (t - 2.6) / 2.8);
  if (t < 7.8) return mixCam(wide, mid, (t - 5.4) / 2.4);
  if (t < T_END + 0.3) return mid;
  return mixCam(mid, end, (t - T_END - 0.3) / 2.4);
}

export function karsiFar(layout: KarsiLayout) {
  return Math.max(700, wideDist(layout) * 4 + layout.depth * 2);
}

export function karsiHaze(layout: KarsiLayout) {
  return { near: Math.max(80, wideDist(layout) * 0.9), far: Math.max(520, wideDist(layout) * 3.2 + layout.depth * 1.5) };
}

export function karsiField(friends: number, foes: number, invite = false) {
  const layout = makeKarsiLayout(friends, foes, invite);
  return { width: layout.width, depth: layout.depth };
}
