export const EKRAN4_ID = "ekran4" as const;
export type Ekran4Id = typeof EKRAN4_ID;
export const EKRAN4_MODE = { id: EKRAN4_ID, label: "ekran4" } as const;
export const EKRAN4_SECONDS = 12;

export function isEkran4(id: string | null | undefined): id is Ekran4Id {
  return id === EKRAN4_ID;
}

let playAt = 0;
let ready = false;
const waiters: Array<() => void> = [];

export function ekran4MarkReady() {
  if (ready) return;
  ready = true;
  for (const fn of waiters.splice(0)) fn();
}

export function ekran4IsReady() {
  return ready;
}

export function ekran4WhenReady() {
  if (ready) return Promise.resolve();
  return new Promise<void>((ok) => waiters.push(ok));
}

export function ekran4Hold() {
  playAt = 0;
}

export function ekran4Start() {
  playAt = performance.now() / 1000;
}

export function ekran4T() {
  if (!playAt) return 0;
  return Math.max(0, performance.now() / 1000 - playAt);
}

export function ekran4Reset() {
  playAt = 0;
  ready = false;
  waiters.length = 0;
}
