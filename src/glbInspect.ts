/** Red's 66 joints. A clip binds only when these names exist on the mesh. */
export const RED_JOINTS = [
  "root",
  "pelvis",
  "spine_01",
  "spine_02",
  "spine_03",
  "neck_01",
  "head",
  "head_leaf",
  "clavicle_l",
  "upperarm_l",
  "lowerarm_l",
  "hand_l",
  "index_01_l",
  "index_02_l",
  "index_03_l",
  "index_04_leaf_l",
  "middle_01_l",
  "middle_02_l",
  "middle_03_l",
  "middle_04_leaf_l",
  "pinky_01_l",
  "pinky_02_l",
  "pinky_03_l",
  "pinky_04_leaf_l",
  "ring_01_l",
  "ring_02_l",
  "ring_03_l",
  "ring_04_leaf_l",
  "thumb_01_l",
  "thumb_02_l",
  "thumb_03_l",
  "thumb_04_leaf_l",
  "clavicle_r",
  "upperarm_r",
  "lowerarm_r",
  "hand_r",
  "index_01_r",
  "index_02_r",
  "index_03_r",
  "index_04_leaf_r",
  "middle_01_r",
  "middle_02_r",
  "middle_03_r",
  "middle_04_leaf_r",
  "pinky_01_r",
  "pinky_02_r",
  "pinky_03_r",
  "pinky_04_leaf_r",
  "ring_01_r",
  "ring_02_r",
  "ring_03_r",
  "ring_04_leaf_r",
  "thumb_01_r",
  "thumb_02_r",
  "thumb_03_r",
  "thumb_04_leaf_r",
  "thigh_l",
  "calf_l",
  "foot_l",
  "ball_l",
  "ball_leaf_l",
  "thigh_r",
  "calf_r",
  "foot_r",
  "ball_r",
  "ball_leaf_r",
] as const;

export type GlbVerdict = "match" | "partial" | "none" | "other";

export type GlbReport = {
  name: string;
  bytes: number;
  meshes: number;
  verts: number;
  skins: number;
  joints: string[];
  anims: string[];
  matched: number;
  missing: string[];
  verdict: GlbVerdict;
};

type GltfJson = {
  nodes?: Array<{ name?: string; mesh?: number; skin?: number }>;
  meshes?: Array<{ primitives?: Array<{ attributes?: { POSITION?: number } }> }>;
  skins?: Array<{ joints?: number[] }>;
  animations?: Array<{ name?: string }>;
  accessors?: Array<{ count?: number }>;
};

export function inspectGlb(name: string, buf: ArrayBuffer): GlbReport {
  const json = readGlbJson(buf);
  const accessors = json.accessors ?? [];
  let verts = 0;
  let meshes = 0;
  for (const mesh of json.meshes ?? []) {
    meshes += 1;
    for (const prim of mesh.primitives ?? []) {
      const index = prim.attributes?.POSITION;
      if (index == null) continue;
      verts += accessors[index]?.count ?? 0;
    }
  }
  const nodes = json.nodes ?? [];
  const jointNames: string[] = [];
  const seen = new Set<string>();
  for (const skin of json.skins ?? []) {
    for (const joint of skin.joints ?? []) {
      const jointName = nodes[joint]?.name ?? "";
      if (!jointName || seen.has(jointName)) continue;
      seen.add(jointName);
      jointNames.push(jointName);
    }
  }
  const missing = RED_JOINTS.filter((bone) => !seen.has(bone));
  const matched = RED_JOINTS.length - missing.length;
  const skins = json.skins?.length ?? 0;
  let verdict: GlbVerdict = "other";
  if (skins === 0 || jointNames.length === 0) verdict = "none";
  else if (missing.length === 0) verdict = "match";
  else if (matched > 0) verdict = "partial";
  return {
    name,
    bytes: buf.byteLength,
    meshes,
    verts,
    skins,
    joints: jointNames,
    anims: (json.animations ?? []).map((clip, i) => clip.name || `klip ${i + 1}`),
    matched,
    missing: [...missing],
    verdict,
  };
}

function readGlbJson(buf: ArrayBuffer): GltfJson {
  if (buf.byteLength < 20) throw new Error("Dosya glb değil.");
  const view = new DataView(buf);
  const magic = view.getUint32(0, true);
  if (magic !== 0x46546c67) throw new Error("Dosya glb değil.");
  const chunkLength = view.getUint32(12, true);
  const chunkType = view.getUint32(16, true);
  if (chunkType !== 0x4e4f534a) throw new Error("glb içinde json yok.");
  const end = Math.min(buf.byteLength, 20 + chunkLength);
  const text = new TextDecoder().decode(new Uint8Array(buf, 20, end - 20));
  return JSON.parse(text) as GltfJson;
}

export function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
