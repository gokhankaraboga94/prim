export type CharacterDef = {
  id: string;
  label: string;
  url: string;
  height: number;
  /** Added to atan2(dx, dz) so the model's face points at the target. */
  yaw: number;
  /** Already simplified offline (models/arena3); skip the runtime vertex merge. */
  packed?: boolean;
  /** Full-size file. On a phone it waits until the roster is opened. */
  heavy?: boolean;
  kind?: "man" | "car";
  /** Ateşli silah + mermi (mafya). */
  gun?: boolean;
};

/**
 * Heroes come from the packed arena3 copies: 2–5 MB each instead of 30–60 MB,
 * which is what lets the roster open in seconds on a phone. Hulk, Tripo, Ork,
 * İblis, Kong and Colossus have no packed copy yet and load in full.
 */
export const CHARACTERS: CharacterDef[] = [
  { id: "knight", label: "Şövalye", url: "/models/knight.glb", height: 1.72, yaw: 0 },
  { id: "savaci", label: "Savaşçı", url: "/models/savaci.glb", height: 1.82, yaw: 0 },
  { id: "mavi-knight", label: "Mavi püsküllü", url: "/models/arena3/mavi.glb", height: 1.8, yaw: 0, packed: true },
  { id: "hero-1", label: "Kahraman 1", url: "/models/arena3/1.glb", height: 1.8, yaw: 0, packed: true },
  { id: "hero-2", label: "Kahraman 2", url: "/models/arena3/2.glb", height: 1.8, yaw: 0, packed: true },
  { id: "hero-3", label: "Kahraman 3", url: "/models/arena3/3.glb", height: 1.8, yaw: 0, packed: true },
  { id: "hulk", label: "Hulk", url: "/models/hulk+3d+model.glb", height: 15.6, yaw: 0, heavy: true },
  { id: "roman", label: "Roman", url: "/models/roman.glb", height: 1.66, yaw: -Math.PI / 2 },
  { id: "armored", label: "Zırhlı", url: "/models/arena3/armored.glb", height: 1.8, yaw: 0, packed: true },
  { id: "fantasy-a", label: "Fantazi A", url: "/models/arena3/fantasy-a.glb", height: 1.8, yaw: 0, packed: true },
  { id: "fantasy-b", label: "Fantazi B", url: "/models/arena3/fantasy-b.glb", height: 1.8, yaw: 0, packed: true },
  { id: "fantasy", label: "Fantazi", url: "/models/arena3/fantasy.glb", height: 1.8, yaw: 0, packed: true },
  { id: "medieval", label: "Ortaçağ", url: "/models/arena3/medieval.glb", height: 1.8, yaw: 0, packed: true },
  { id: "tripo", label: "Tripo", url: "/models/tripo.glb", height: 2.4, yaw: 0 },
  { id: "orc", label: "Ork", url: "/models/orc.glb", height: 15.6 * 0.7, yaw: 0, heavy: true },
  { id: "demon", label: "İblis", url: "/models/demon.glb", height: 15.6 * 0.85, yaw: 0, heavy: true },
  { id: "kong", label: "Kong", url: "/models/bigfoot.glb", height: 15.6, yaw: 0, heavy: true },
  { id: "colossus", label: "Colossus", url: "/models/colossus.glb", height: 15.6, yaw: 0, heavy: true },
];

/** Mafya reel modelleri — burnu −X → edit face + π/2. */
const MAFYA_YAW = Math.PI / 2;

export const CHARACTERS2: CharacterDef[] = [
  { id: "mafya-1", label: "Mafya 1 (lider)", url: "/models/mafya/m01.glb", height: 1.78, yaw: MAFYA_YAW, kind: "man", gun: true, heavy: true },
  { id: "mafya-2", label: "Mafya 2", url: "/models/mafya/m02.glb", height: 1.78, yaw: MAFYA_YAW, kind: "man", gun: true, heavy: true },
  { id: "mafya-3", label: "Mafya 3", url: "/models/mafya/m03.glb", height: 1.78, yaw: MAFYA_YAW, kind: "man", gun: true, heavy: true },
  { id: "mafya-4", label: "Mafya 4", url: "/models/mafya/m04.glb", height: 1.78, yaw: MAFYA_YAW, kind: "man", gun: true, heavy: true },
  { id: "mafya-5", label: "Mafya 5", url: "/models/mafya/m05.glb", height: 1.78, yaw: MAFYA_YAW, kind: "man", gun: true, heavy: true },
  { id: "mafya-6", label: "Mafya 6 (lider)", url: "/models/mafya/m06.glb", height: 1.78, yaw: MAFYA_YAW, kind: "man", gun: true, heavy: true },
  { id: "mafya-7", label: "Mafya 7", url: "/models/mafya/m07.glb", height: 1.78, yaw: MAFYA_YAW, kind: "man", gun: true, heavy: true },
  { id: "mafya-8", label: "Mafya 8", url: "/models/mafya/m08.glb", height: 1.78, yaw: MAFYA_YAW, kind: "man", gun: true, heavy: true },
  { id: "mafya-9", label: "Mafya 9", url: "/models/mafya/m09.glb", height: 1.78, yaw: MAFYA_YAW, kind: "man", gun: true, heavy: true },
  { id: "mafya-10", label: "Araç 10", url: "/models/mafya/c01.glb", height: 1.35, yaw: 0, kind: "car", heavy: true },
  { id: "mafya-11", label: "Araç 11", url: "/models/mafya/c02.glb", height: 1.35, yaw: 0, kind: "car", heavy: true },
  { id: "mafya-12", label: "Araç 12", url: "/models/mafya/c03.glb", height: 1.35, yaw: 0, kind: "car", heavy: true },
];

export const ALL_CHARACTERS: CharacterDef[] = [...CHARACTERS, ...CHARACTERS2];

export type GroundId = "grass" | "asphalt" | "dirt" | "stone";

export const GROUNDS: { id: GroundId; label: string; color: string }[] = [
  { id: "grass", label: "Çimen", color: "#9ad86a" },
  { id: "asphalt", label: "Asfalt", color: "#9aa4b0" },
  { id: "dirt", label: "Toprak", color: "#c8a06a" },
  { id: "stone", label: "Taş", color: "#b8c0c8" },
];

export const TEAMS = [
  { id: 1, label: "Kırmızı", color: "#e10600" },
  { id: 2, label: "Mavi", color: "#1a56e8" },
  { id: 3, label: "Altın", color: "#e8c36a" },
  { id: 4, label: "Yeşil", color: "#2f9e44" },
] as const;

export const MAX_PER_MODEL = 200;
export const MAX_UNITS = 1_000_000;

export function characterById(id: string) {
  return ALL_CHARACTERS.find((item) => item.id === id) ?? null;
}
