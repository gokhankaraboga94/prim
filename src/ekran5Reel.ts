export const EKRAN5_ID = "ekran5" as const;
export type Ekran5Id = typeof EKRAN5_ID;
export const EKRAN5_MODE = { id: EKRAN5_ID, label: "ekran5" } as const;
export const EKRAN5_SECONDS = 12;

export function isEkran5(id: string | null | undefined): id is Ekran5Id {
  return id === EKRAN5_ID;
}

let playAt = 0;
let ready = false;
const waiters: Array<() => void> = [];

export function ekran5MarkReady() {
  if (ready) return;
  ready = true;
  for (const fn of waiters.splice(0)) fn();
}

export function ekran5IsReady() {
  return ready;
}

export function ekran5WhenReady() {
  if (ready) return Promise.resolve();
  return new Promise<void>((ok) => waiters.push(ok));
}

export function ekran5Hold() {
  playAt = 0;
}

export function ekran5Start() {
  playAt = performance.now() / 1000;
}

export function ekran5T() {
  if (!playAt) return 0;
  return Math.max(0, performance.now() / 1000 - playAt);
}

export function ekran5Reset() {
  playAt = 0;
  ready = false;
  waiters.length = 0;
}
