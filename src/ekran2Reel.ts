export const EKRAN2_ID = "ekran2" as const;
export type Ekran2Id = typeof EKRAN2_ID;
export const EKRAN2_MODE = { id: EKRAN2_ID, label: "ekran2" } as const;
export const EKRAN2_SECONDS = 12;

export function isEkran2(id: string | null | undefined): id is Ekran2Id {
  return id === EKRAN2_ID;
}

let playAt = 0;
let ready = false;
const waiters: Array<() => void> = [];

export function ekran2MarkReady() {
  if (ready) return;
  ready = true;
  for (const fn of waiters.splice(0)) fn();
}

export function ekran2IsReady() {
  return ready;
}

export function ekran2WhenReady() {
  if (ready) return Promise.resolve();
  return new Promise<void>((ok) => waiters.push(ok));
}

export function ekran2Hold() {
  playAt = 0;
}

export function ekran2Start() {
  playAt = performance.now() / 1000;
}

export function ekran2T() {
  if (!playAt) return 0;
  return Math.max(0, performance.now() / 1000 - playAt);
}

export function ekran2Reset() {
  playAt = 0;
  ready = false;
  waiters.length = 0;
}
