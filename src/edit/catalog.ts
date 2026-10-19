export type CharacterDef = {
  id: string;
  label: string;
  url: string;
  height: number;
  /** Added to atan2(dx, dz) so the model's face points at the target. */
  yaw: number;
};

export const CHARACTERS: CharacterDef[] = [
  { id: "knight", label: "Şövalye", url: "/models/knight.glb", height: 1.72, yaw: 0 },
  { id: "mavi-knight", label: "Mavi püsküllü", url: "/models/mavi_püsküllü_knight.glb", height: 1.8, yaw: 0 },
  { id: "hulk", label: "Hulk", url: "/models/hulk+3d+model.glb", height: 15.6, yaw: 0 },
  { id: "roman", label: "Roman", url: "/models/roman.glb", height: 1.66, yaw: -Math.PI / 2 },
  { id: "armored", label: "Zırhlı", url: "/models/heroes/armored.glb", height: 1.8, yaw: 0 },
  { id: "fantasy-a", label: "Fantazi A", url: "/models/heroes/fantasy-a.glb", height: 1.8, yaw: 0 },
  { id: "fantasy-b", label: "Fantazi B", url: "/models/heroes/fantasy-b.glb", height: 1.8, yaw: 0 },
  { id: "fantasy", label: "Fantazi", url: "/models/heroes/fantasy.glb", height: 1.8, yaw: 0 },
  { id: "medieval", label: "Ortaçağ", url: "/models/heroes/medieval.glb", height: 1.8, yaw: 0 },
  { id: "tripo", label: "Tripo", url: "/models/tripo.glb", height: 2.4, yaw: 0 },
  { id: "orc", label: "Ork", url: "/models/orc.glb", height: 15.6 * 0.7, yaw: 0 },
  { id: "demon", label: "İblis", url: "/models/demon.glb", height: 15.6 * 0.85, yaw: 0 },
  { id: "kong", label: "Kong", url: "/models/bigfoot.glb", height: 15.6, yaw: 0 },
  { id: "colossus", label: "Colossus", url: "/models/colossus.glb", height: 15.6, yaw: 0 },
];

export const TEAMS = [
  { id: 1, label: "Kırmızı", color: "#e10600" },
  { id: 2, label: "Mavi", color: "#1a56e8" },
  { id: 3, label: "Altın", color: "#e8c36a" },
  { id: 4, label: "Yeşil", color: "#2f9e44" },
] as const;

export const MAX_PER_MODEL = 48;
export const MAX_UNITS = 180;

export function characterById(id: string) {
  return CHARACTERS.find((item) => item.id === id) ?? null;
}
