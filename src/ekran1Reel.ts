export const EKRAN1_ID = "ekran1" as const;
export type Ekran1Id = typeof EKRAN1_ID;
export const EKRAN1_MODE = { id: EKRAN1_ID, label: "ekran1" } as const;
export const EKRAN1_SECONDS = 12;

export function isEkran1(id: string | null | undefined): id is Ekran1Id {
  return id === EKRAN1_ID;
}

let playAt = 0;
let ready = false;
const waiters: Array<() => void> = [];

export function ekran1MarkReady() {
  if (ready) return;
  ready = true;
  for (const fn of waiters.splice(0)) fn();
}

export function ekran1IsReady() {
  return ready;
}

export function ekran1WhenReady() {
  if (ready) return Promise.resolve();
  return new Promise<void>((ok) => waiters.push(ok));
}

export function ekran1Hold() {
  playAt = 0;
}

export function ekran1Start() {
  playAt = performance.now() / 1000;
}

export function ekran1T() {
  if (!playAt) return 0;
  return Math.max(0, performance.now() / 1000 - playAt);
}

export function ekran1Reset() {
  playAt = 0;
  ready = false;
  waiters.length = 0;
}
