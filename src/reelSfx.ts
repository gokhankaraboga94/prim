/** Real recorded longbow SFX mixed into cinematic reel capture. */

const DRAW_URLS = ["/sfx/bow-draw-1.mp3", "/sfx/bow-draw-2.mp3", "/sfx/bow-draw-3.mp3", "/sfx/bow-nock.mp3"];
const LOOSE_URLS = ["/sfx/arrow-1.mp3", "/sfx/arrow-2.mp3", "/sfx/arrow-3.mp3", "/sfx/arrow-sn-1.mp3", "/sfx/arrow-sn-2.mp3", "/sfx/arrow-sn-3.mp3"];

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let recDest: MediaStreamAudioDestinationNode | null = null;
let draws: AudioBuffer[] = [];
let looses: AudioBuffer[] = [];
let loadOnce: Promise<void> | null = null;
let lastDraw = -9;
let lastLoose = -9;
let voices = 0;
let drawI = 0;
let looseI = 0;

const MAX_VOICES = 16;

function getCtx() {
  if (typeof window === "undefined" || typeof AudioContext === "undefined") return null;
  if (!ctx) {
    ctx = new AudioContext();
    master = ctx.createGain();
    master.gain.value = 1.12;
    recDest = ctx.createMediaStreamDestination();
    master.connect(ctx.destination);
    master.connect(recDest);
  }
  return ctx;
}

async function decodeUrl(context: AudioContext, url: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(url);
  const raw = await res.arrayBuffer();
  return context.decodeAudioData(raw.slice(0));
}

async function loadSamples(context: AudioContext) {
  if (draws.length && looses.length) return;
  const [d, l] = await Promise.all([
    Promise.allSettled(DRAW_URLS.map((u) => decodeUrl(context, u))),
    Promise.allSettled(LOOSE_URLS.map((u) => decodeUrl(context, u))),
  ]);
  draws = d.filter((r): r is PromiseFulfilledResult<AudioBuffer> => r.status === "fulfilled").map((r) => r.value);
  looses = l.filter((r): r is PromiseFulfilledResult<AudioBuffer> => r.status === "fulfilled").map((r) => r.value);
}

function takeVoice(dur: number) {
  if (voices >= MAX_VOICES) return false;
  voices += 1;
  window.setTimeout(() => {
    voices = Math.max(0, voices - 1);
  }, dur * 1000 + 40);
  return true;
}

function playBuf(buf: AudioBuffer, gain: number, pan: number, rate: number) {
  const context = getCtx();
  if (!context || !master) return;
  const when = context.currentTime;
  const src = context.createBufferSource();
  src.buffer = buf;
  src.playbackRate.value = rate;
  const g = context.createGain();
  g.gain.value = gain;
  const p = context.createStereoPanner();
  p.pan.value = pan;
  src.connect(g);
  g.connect(p);
  p.connect(master);
  src.start(when);
  takeVoice(buf.duration / rate);
}

export async function unlockReelSfx() {
  const context = getCtx();
  if (!context) return;
  if (context.state === "suspended") await context.resume();
  if (!loadOnce) loadOnce = loadSamples(context).catch(() => {});
  await loadOnce;
}

export function reelSfxStream() {
  getCtx();
  return recDest?.stream ?? null;
}

export function sfxBowDraw(heavy = false) {
  const context = getCtx();
  if (!context || !draws.length) return;
  const now = context.currentTime;
  if (now - lastDraw < (heavy ? 0.28 : 0.16)) return;
  lastDraw = now;
  const buf = heavy ? draws[drawI % Math.max(1, draws.length - 1)] : draws[drawI % draws.length];
  drawI += 1;
  playBuf(buf, heavy ? 1 : 0.82, (Math.random() - 0.5) * 0.55, heavy ? 0.94 + Math.random() * 0.06 : 0.96 + Math.random() * 0.1);
}

export function sfxArrowLoose() {
  const context = getCtx();
  if (!context || !looses.length) return;
  const now = context.currentTime;
  if (now - lastLoose < 0.028) return;
  lastLoose = now;
  const whoosh = looses[looseI % Math.min(3, looses.length)];
  looseI += 1;
  playBuf(whoosh, 1.35, (Math.random() - 0.5) * 1.2, 1.22 + Math.random() * 0.28);
  if (looses.length > 3) {
    const snap = looses[3 + (looseI % Math.max(1, looses.length - 3))];
    playBuf(snap, 0.85, (Math.random() - 0.5) * 0.9, 1.35 + Math.random() * 0.22);
  }
}

export function sfxVolleyPeak() {
  sfxBowDraw(true);
  for (let i = 0; i < 8; i++) {
    window.setTimeout(() => sfxArrowLoose(), 18 + i * 28);
  }
}
