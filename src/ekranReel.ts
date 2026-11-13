export const EKRAN_ID = "ekran" as const;
export type EkranId = typeof EKRAN_ID;
export const EKRAN_MODE = { id: EKRAN_ID, label: "ekran" } as const;
/** Full green takeover lands around 12–15s. */
export const EKRAN_SECONDS = 15;

export function isEkran(id: string | null | undefined): id is EkranId {
  return id === EKRAN_ID;
}

let playAt = 0;
let ready = false;
const waiters: Array<() => void> = [];

export function ekranMarkReady() {
  if (ready) return;
  ready = true;
  for (const fn of waiters.splice(0)) fn();
}

export function ekranIsReady() {
  return ready;
}

export function ekranWhenReady() {
  if (ready) return Promise.resolve();
  return new Promise<void>((ok) => waiters.push(ok));
}

export function ekranHold() {
  playAt = 0;
}

export function ekranStart() {
  playAt = performance.now() / 1000;
}

export function ekranT() {
  if (!playAt) return 0;
  return Math.max(0, performance.now() / 1000 - playAt);
}

export function ekranReset() {
  playAt = 0;
  ready = false;
  waiters.length = 0;
}
