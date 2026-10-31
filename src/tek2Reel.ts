import { TEK_HERO, TEK_RED } from "./tekReel";

export const TEK2_ID = "tek2" as const;
export type Tek2Id = typeof TEK2_ID;
export const TEK2_MODE = { id: TEK2_ID, label: "tek2" } as const;
export const TEK2_SECONDS = 18;
export const TEK2_ARENA = "/models/island-arena.glb";
/** Local deck height of the island, so the fight stands on the stone. */
export const TEK2_FLOOR = 0.165;
/** Wide enough that the close camera stays over the flat center. */
export const TEK2_SCALE = 36;
export const TEK2_URLS = [TEK_HERO, TEK_RED, TEK2_ARENA] as const;

let playAt = 0;
let ready = false;
const waiters: Array<() => void> = [];

export function tek2MarkReady() {
  if (ready) return;
  ready = true;
  for (const fn of waiters.splice(0)) fn();
}

export function tek2IsReady() {
  return ready;
}

export function tek2WhenReady() {
  if (ready) return Promise.resolve();
  return new Promise<void>((ok) => waiters.push(ok));
}

export function tek2Hold() {
  playAt = 0;
}

export function tek2Start() {
  playAt = performance.now() / 1000;
}

export function tek2T() {
  if (!playAt) return 0;
  return Math.max(0, performance.now() / 1000 - playAt);
}

export function tek2Reset() {
  ready = false;
  playAt = 0;
}

export function isTek2(id: string | null | undefined): id is Tek2Id {
  return id === TEK2_ID;
}
