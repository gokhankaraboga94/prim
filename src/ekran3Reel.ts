export const EKRAN3_ID = "ekran3" as const;
export type Ekran3Id = typeof EKRAN3_ID;
export const EKRAN3_MODE = { id: EKRAN3_ID, label: "ekran3" } as const;
export const EKRAN3_SECONDS = 12;

export function isEkran3(id: string | null | undefined): id is Ekran3Id {
  return id === EKRAN3_ID;
}

let playAt = 0;
let ready = false;
const waiters: Array<() => void> = [];

export function ekran3MarkReady() {
  if (ready) return;
  ready = true;
  for (const fn of waiters.splice(0)) fn();
}

export function ekran3IsReady() {
  return ready;
}

export function ekran3WhenReady() {
  if (ready) return Promise.resolve();
  return new Promise<void>((ok) => waiters.push(ok));
}

export function ekran3Hold() {
  playAt = 0;
}

export function ekran3Start() {
  playAt = performance.now() / 1000;
}

export function ekran3T() {
  if (!playAt) return 0;
  return Math.max(0, performance.now() / 1000 - playAt);
}

export function ekran3Reset() {
  playAt = 0;
  ready = false;
  waiters.length = 0;
}
