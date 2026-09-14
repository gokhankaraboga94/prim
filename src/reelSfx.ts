/** Bow-draw / arrow-loose SFX for cinematic reels. Mixed into MediaRecorder. */

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let recDest: MediaStreamAudioDestinationNode | null = null;
let brown: AudioBuffer | null = null;
let white: AudioBuffer | null = null;
let lastDraw = -9;
let lastLoose = -9;
let voices = 0;

const MAX_VOICES = 12;

function noise(context: AudioContext, seconds: number, color: "white" | "brown") {
  const n = Math.floor(context.sampleRate * seconds);
  const buf = context.createBuffer(1, n, context.sampleRate);
  const data = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < n; i++) {
    const w = Math.random() * 2 - 1;
    if (color === "brown") {
      last += 0.02 * w;
      last *= 0.98;
      data[i] = last * 3.2;
    } else {
      data[i] = w;
    }
  }
  return buf;
}

function getCtx() {
  if (typeof window === "undefined" || typeof AudioContext === "undefined") return null;
  if (!ctx) {
    ctx = new AudioContext();
    master = ctx.createGain();
    master.gain.value = 0.78;
    recDest = ctx.createMediaStreamDestination();
    master.connect(ctx.destination);
    master.connect(recDest);
    brown = noise(ctx, 2.2, "brown");
    white = noise(ctx, 1.4, "white");
  }
  return ctx;
}

function takeVoice(dur: number) {
  if (voices >= MAX_VOICES) return false;
  voices += 1;
  window.setTimeout(() => {
    voices = Math.max(0, voices - 1);
  }, dur * 1000 + 40);
  return true;
}

function noiseSrc(context: AudioContext, buf: AudioBuffer, when: number, rate = 1) {
  const src = context.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  src.playbackRate.value = rate;
  src.start(when);
  return src;
}

function envGain(context: AudioContext, when: number, peak: number, attack: number, hold: number, release: number) {
  const g = context.createGain();
  g.gain.setValueAtTime(0.0001, when);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), when + attack);
  g.gain.setValueAtTime(Math.max(0.0002, peak), when + attack + hold);
  g.gain.exponentialRampToValueAtTime(0.0001, when + attack + hold + release);
  return g;
}

export async function unlockReelSfx() {
  const context = getCtx();
  if (!context) return;
  if (context.state === "suspended") await context.resume();
}

export function reelSfxStream() {
  getCtx();
  return recDest?.stream ?? null;
}

export function sfxBowDraw(heavy = false) {
  const context = getCtx();
  if (!context || !master || !brown || !white) return;
  const now = context.currentTime;
  if (now - lastDraw < (heavy ? 0.22 : 0.09)) return;
  if (!takeVoice(0.55)) return;
  lastDraw = now;
  const when = now;
  const dur = heavy ? 0.62 : 0.42;
  const creak = noiseSrc(context, brown, when, 0.72 + Math.random() * 0.18);
  const bp = context.createBiquadFilter();
  bp.type = "bandpass";
  bp.Q.value = 3.6;
  bp.frequency.setValueAtTime(190, when);
  bp.frequency.exponentialRampToValueAtTime(heavy ? 640 : 820, when + dur);
  const g = envGain(context, when, heavy ? 0.28 : 0.2, 0.09, dur * 0.45, dur * 0.42);
  const wood = context.createOscillator();
  wood.type = "triangle";
  wood.frequency.setValueAtTime(62, when);
  wood.frequency.exponentialRampToValueAtTime(96, when + dur);
  const lp = context.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 420;
  const wg = envGain(context, when, 0.05, 0.06, dur * 0.5, dur * 0.4);
  const pan = context.createStereoPanner();
  pan.pan.value = (Math.random() - 0.5) * 0.7;
  creak.connect(bp);
  bp.connect(g);
  g.connect(pan);
  wood.connect(lp);
  lp.connect(wg);
  wg.connect(pan);
  pan.connect(master);
  creak.stop(when + dur + 0.05);
  wood.start(when);
  wood.stop(when + dur + 0.05);
}

export function sfxArrowLoose() {
  const context = getCtx();
  if (!context || !master || !white) return;
  const now = context.currentTime;
  if (now - lastLoose < 0.042) return;
  if (!takeVoice(0.28)) return;
  lastLoose = now;
  const when = now;
  const rate = 0.86 + Math.random() * 0.32;
  const snap = noiseSrc(context, white, when, 1.4 * rate);
  const hp = context.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 900;
  const sg = envGain(context, when, 0.22, 0.004, 0.018, 0.06);
  const whoosh = noiseSrc(context, white, when, 0.9 * rate);
  const bp = context.createBiquadFilter();
  bp.type = "bandpass";
  bp.Q.value = 1.8;
  bp.frequency.setValueAtTime(2400 * rate, when);
  bp.frequency.exponentialRampToValueAtTime(420 * rate, when + 0.16);
  const wg = envGain(context, when, 0.18, 0.01, 0.03, 0.14);
  const twang = context.createOscillator();
  twang.type = "triangle";
  twang.frequency.setValueAtTime(980 * rate, when);
  twang.frequency.exponentialRampToValueAtTime(160 * rate, when + 0.09);
  const tg = envGain(context, when, 0.11, 0.003, 0.012, 0.08);
  const pan = context.createStereoPanner();
  pan.pan.value = (Math.random() - 0.5) * 1.2;
  snap.connect(hp);
  hp.connect(sg);
  sg.connect(pan);
  whoosh.connect(bp);
  bp.connect(wg);
  wg.connect(pan);
  twang.connect(tg);
  tg.connect(pan);
  pan.connect(master);
  twang.start(when);
  snap.stop(when + 0.22);
  whoosh.stop(when + 0.22);
  twang.stop(when + 0.12);
}

/** ATEŞ: denser volley hit. */
export function sfxVolleyPeak() {
  const context = getCtx();
  if (!context || !master) return;
  const when = context.currentTime;
  const boom = context.createOscillator();
  boom.type = "sine";
  boom.frequency.setValueAtTime(78, when);
  boom.frequency.exponentialRampToValueAtTime(36, when + 0.32);
  const bg = envGain(context, when, 0.2, 0.01, 0.05, 0.28);
  boom.connect(bg);
  bg.connect(master);
  boom.start(when);
  boom.stop(when + 0.4);
  sfxBowDraw(true);
  for (let i = 0; i < 6; i++) {
    window.setTimeout(() => sfxArrowLoose(), i * 38);
  }
}
