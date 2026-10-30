import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { REEL_HOLD } from "../../recordCanvas";
import { devKick, type KickModel } from "../../devReel";
import { simplifySkinned } from "../../knightSoldier";
import { dropGroundSlab } from "../../groundSlab";

const HEIGHT = 15.6;
const AXIS = new THREE.Vector3(1, 0, 0);

type LegWeights = { hip: number; knee: number; ankle: number };

/** Joints and the kicking-leg cut, in the model's own units (both models face +z, about 1 unit tall). */
type KickRig = {
  url: string;
  hip: THREE.Vector3;
  knee: THREE.Vector3;
  ankle: THREE.Vector3;
  /** Grid cell for the runtime merge; 0 when the file is already packed offline. */
  cell: number;
  /** Bake node transforms and strip a ground slab before cutting (Tripo exports). */
  bake: boolean;
  leg: (x: number, y: number, z: number) => LegWeights | null;
};

const HULK_RIG: KickRig = {
  url: "/models/hulk+3d+model.glb",
  hip: new THREE.Vector3(-0.155, 0.43, 0.02),
  knee: new THREE.Vector3(-0.145, 0.25, 0.005),
  ankle: new THREE.Vector3(-0.17, 0.09, -0.04),
  cell: 0.006,
  bake: false,
  leg: (x, y) => {
    if (x > -0.04 || y > 0.5 || (y > 0.33 && x < -0.235)) return null;
    const hip = fade(0.48, 0.37, y) * fade(-0.04, -0.1, x);
    if (hip <= 0) return null;
    const knee = hip > 0.85 ? fade(0.3, 0.2, y) : 0;
    const ankle = knee > 0.9 ? fade(0.13, 0.05, y) : 0;
    return { hip, knee, ankle };
  },
};

/**
 * Alien kicks with its rear (+x) leg. Measured on the mesh: that foot sits at
 * z −0.21, knee near (0.1, 0.45, −0.04), hip joint near (0.09, 0.6, −0.11). The
 * +x arm hangs beside it but always at z > 0.03, so z < 0 cleanly separates leg
 * from arm; the front (−x) leg never crosses x 0.02.
 */
const ALIEN_LEG: KickRig["leg"] = (x, y, z) => {
  if (x < 0.02 || y > 0.66 || z > 0.03) return null;
  const hip = fade(0.66, 0.55, y) * fade(0.02, 0.05, x) * fade(0.03, -0.005, z);
  if (hip <= 0) return null;
  const knee = hip > 0.85 ? fade(0.5, 0.4, y) : 0;
  const ankle = knee > 0.9 ? fade(0.11, 0.04, y) : 0;
  return { hip, knee, ankle };
};

const ALIEN_RIG: KickRig = {
  url: "/models/alien.glb",
  hip: new THREE.Vector3(0.09, 0.6, -0.11),
  knee: new THREE.Vector3(0.1, 0.45, -0.04),
  ankle: new THREE.Vector3(0.12, 0.07, -0.2),
  cell: 0.006,
  bake: true,
  leg: ALIEN_LEG,
};

/** Same rig on the offline-packed copy (59 MB → 4.4 MB, 92k vertices): what a phone can load. */
const ALIEN_LITE_RIG: KickRig = { ...ALIEN_RIG, url: "/models/dev13/alien.glb", cell: 0 };

/**
 * Red monster (25k vertices, 1.5 MB: loads on a phone as is). Legs stand at x ±0.18 and only
 * part below y 0.15; above that the skirt covers both thighs. The +x side kicks, and the x
 * fade runs from the centre line to 0.12 so that skirt half bends with the thigh instead of tearing.
 */
const MONSTER_RIG: KickRig = {
  url: "/models/dev14/red-monster.glb",
  hip: new THREE.Vector3(0.18, 0.3, 0.02),
  knee: new THREE.Vector3(0.18, 0.15, 0.02),
  ankle: new THREE.Vector3(0.18, 0.04, 0),
  cell: 0,
  bake: true,
  leg: (x, y) => {
    if (x < 0 || y > 0.36) return null;
    const hip = fade(0.36, 0.22, y) * fade(0, 0.12, x);
    if (hip <= 0) return null;
    const knee = hip > 0.85 ? fade(0.17, 0.11, y) : 0;
    const ankle = knee > 0.9 ? fade(0.07, 0.03, y) : 0;
    return { hip, knee, ankle };
  },
};

/** Godzilla stands facing +z. The kicking leg is the +x foot, in front of the body. */
const GODZILLA_RIG: KickRig = {
  url: "/models/godzilla.glb",
  hip: new THREE.Vector3(0.12, 0.3, 0.22),
  knee: new THREE.Vector3(0.12, 0.15, 0.22),
  ankle: new THREE.Vector3(0.13, 0.04, 0.24),
  cell: 0.016,
  bake: false,
  leg: (x, y, z) => {
    if (x < 0.05 || y > 0.34 || z < 0.08) return null;
    const hip = fade(0.34, 0.24, y) * fade(0.05, 0.1, x);
    if (hip <= 0) return null;
    const knee = hip > 0.85 ? fade(0.2, 0.12, y) : 0;
    const ankle = knee > 0.9 ? fade(0.08, 0.03, y) : 0;
    return { hip, knee, ankle };
  },
};

const RIGS: Record<KickModel, KickRig> = { hulk: HULK_RIG, alien: ALIEN_RIG, "alien-lite": ALIEN_LITE_RIG, "red-monster": MONSTER_RIG, godzilla: GODZILLA_RIG };
const qHip = new THREE.Quaternion();
const qKnee = new THREE.Quaternion();
const qAnkle = new THREE.Quaternion();
const tmp = new THREE.Vector3();
const relKnee = new THREE.Vector3();
const kneeNow = new THREE.Vector3();
const ankleNow = new THREE.Vector3();

function fade(edge0: number, edge1: number, value: number) {
  const t = Math.min(1, Math.max(0, (value - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

type Leg = {
  pos: THREE.BufferAttribute;
  nrm: THREE.BufferAttribute | null;
  rest: Float32Array;
  restN: Float32Array | null;
  hip: Float32Array;
  knee: Float32Array;
  ankle: Float32Array;
  ids: Uint32Array;
  posed: boolean;
};

function splitBody(src: THREE.BufferGeometry, rig: KickRig) {
  const srcP = src.getAttribute("position") as THREE.BufferAttribute;
  const srcN = src.getAttribute("normal") as THREE.BufferAttribute | null;
  const srcU = src.getAttribute("uv") as THREE.BufferAttribute | null;
  const index = src.getIndex();
  const count = srcP.count;
  const hip = new Float32Array(count);
  const knee = new Float32Array(count);
  const ankle = new Float32Array(count);
  const dyn = new Uint8Array(count);
  for (let i = 0; i < count; i++) {
    const w = rig.leg(srcP.getX(i), srcP.getY(i), srcP.getZ(i));
    if (!w) continue;
    hip[i] = w.hip;
    dyn[i] = 1;
    knee[i] = w.knee;
    ankle[i] = w.ankle;
  }
  const bodyTris: number[] = [];
  const legTris: number[] = [];
  const triCount = index ? index.count : count;
  const at = (i: number) => (index ? index.getX(i) : i);
  for (let i = 0; i < triCount; i += 3) {
    const a = at(i);
    const b = at(i + 1);
    const c = at(i + 2);
    const bag = dyn[a] || dyn[b] || dyn[c] ? legTris : bodyTris;
    bag.push(a, b, c);
  }
  const bake = (tris: number[], moving: boolean) => {
    const map = new Int32Array(count);
    map.fill(-1);
    const list: number[] = [];
    const remapped = new Uint32Array(tris.length);
    for (let i = 0; i < tris.length; i++) {
      const v = tris[i];
      let id = map[v];
      if (id < 0) {
        id = list.length;
        map[v] = id;
        list.push(v);
      }
      remapped[i] = id;
    }
    const positions = new Float32Array(list.length * 3);
    const normals = srcN ? new Float32Array(list.length * 3) : null;
    const uvs = srcU ? new Float32Array(list.length * 2) : null;
    const hipW = new Float32Array(list.length);
    const kneeW = new Float32Array(list.length);
    const ankleW = new Float32Array(list.length);
    const ids: number[] = [];
    for (let i = 0; i < list.length; i++) {
      const v = list[i];
      positions[i * 3] = srcP.getX(v);
      positions[i * 3 + 1] = srcP.getY(v);
      positions[i * 3 + 2] = srcP.getZ(v);
      if (normals && srcN) {
        normals[i * 3] = srcN.getX(v);
        normals[i * 3 + 1] = srcN.getY(v);
        normals[i * 3 + 2] = srcN.getZ(v);
      }
      if (uvs && srcU) {
        uvs[i * 2] = srcU.getX(v);
        uvs[i * 2 + 1] = srcU.getY(v);
      }
      if (!moving) continue;
      hipW[i] = hip[v];
      kneeW[i] = knee[v];
      ankleW[i] = ankle[v];
      if (hipW[i] > 0) ids.push(i);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    if (normals) geo.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
    if (uvs) geo.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
    geo.setIndex(new THREE.BufferAttribute(remapped, 1));
    return { geo, hipW, kneeW, ankleW, ids: new Uint32Array(ids), rest: positions.slice(), restN: normals ? normals.slice() : null };
  };
  return { body: bake(bodyTris, false).geo, leg: bake(legTris, true) };
}

export function HulkModel({ soldiers, model: kind = "hulk", fast = false }: { soldiers: number; model?: KickModel; fast?: boolean }) {
  const rig = useRef<THREE.Group>(null);
  const spec = RIGS[kind];
  const swing = useMemo(() => ({ leg: null as Leg | null }), []);
  useEffect(() => {
    const loader = new GLTFLoader();
    let drop = false;
    loader.load(spec.url, (gltf) => {
      const host = rig.current;
      if (drop || !host) return;
      const model = gltf.scene;
      model.updateMatrixWorld(true);
      let mesh: THREE.Mesh | null = null;
      model.traverse((obj) => {
        const item = obj as THREE.Mesh;
        if (item.isMesh && !mesh) mesh = item;
      });
      if (!mesh) return;
      const body = mesh as THREE.Mesh;
      const material = body.material;
      let source = body.geometry;
      if (spec.bake) {
        const baked = source.clone();
        baked.applyMatrix4(body.matrixWorld);
        source = dropGroundSlab(baked);
      }
      const reduced = spec.cell > 0 ? simplifySkinned(spec.bake ? source : source.clone(), spec.cell) : source;
      if (reduced !== source && source !== body.geometry) source.dispose();
      const parts = splitBody(reduced, spec);
      body.geometry.dispose();
      if (reduced !== body.geometry) reduced.dispose();
      const shell = new THREE.Mesh(parts.body, material);
      const kicking = new THREE.Mesh(parts.leg.geo, material);
      shell.frustumCulled = false;
      kicking.frustumCulled = false;
      const pos = parts.leg.geo.getAttribute("position") as THREE.BufferAttribute;
      const nrm = parts.leg.geo.getAttribute("normal") as THREE.BufferAttribute | null;
      swing.leg = {
        pos,
        nrm,
        rest: parts.leg.rest,
        restN: parts.leg.restN,
        hip: parts.leg.hipW,
        knee: parts.leg.kneeW,
        ankle: parts.leg.ankleW,
        ids: parts.leg.ids,
        posed: false,
      };
      model.remove(body);
      model.add(shell, kicking);
      model.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(model);
      const span = Math.max(0.001, box.max.y - box.min.y);
      const fit = HEIGHT / span;
      model.scale.setScalar(fit);
      model.position.set(-((box.min.x + box.max.x) / 2) * fit, -box.min.y * fit, -((box.min.z + box.max.z) / 2) * fit);
      host.add(model);
    });
    return () => {
      drop = true;
      swing.leg = null;
      const host = rig.current;
      if (!host) return;
      const seen = new Set<THREE.Material>();
      host.traverse((obj) => {
        const item = obj as THREE.Mesh;
        if (!item.isMesh) return;
        item.geometry?.dispose();
        const mats = Array.isArray(item.material) ? item.material : [item.material];
        for (const mat of mats) {
          if (seen.has(mat)) continue;
          seen.add(mat);
          const std = mat as THREE.MeshStandardMaterial;
          std.map?.dispose();
          std.normalMap?.dispose();
          std.roughnessMap?.dispose();
          std.metalnessMap?.dispose();
          mat.dispose();
        }
      });
      host.clear();
    };
  }, [swing, spec]);
  useFrame(({ clock }) => {
    const leg = swing.leg;
    if (!leg) return;
    const kick = devKick(Math.max(0, clock.elapsedTime - REEL_HOLD), soldiers, fast);
    const active = Math.abs(kick.hip) + Math.abs(kick.knee) + Math.abs(kick.ankle) > 0.001;
    const pos = leg.pos.array as Float32Array;
    const nrm = leg.nrm ? (leg.nrm.array as Float32Array) : null;
    if (!active) {
      if (!leg.posed) return;
      pos.set(leg.rest);
      if (nrm && leg.restN) nrm.set(leg.restN);
      leg.pos.needsUpdate = true;
      if (leg.nrm) leg.nrm.needsUpdate = true;
      leg.posed = false;
      return;
    }
    qHip.setFromAxisAngle(AXIS, kick.hip);
    qKnee.setFromAxisAngle(AXIS, kick.knee);
    qAnkle.setFromAxisAngle(AXIS, kick.ankle);
    const HIP = spec.hip;
    const KNEE = spec.knee;
    const ANKLE = spec.ankle;
    relKnee.copy(KNEE).sub(HIP).applyQuaternion(qHip);
    kneeNow.copy(relKnee).add(HIP);
    ankleNow.copy(ANKLE).sub(HIP).applyQuaternion(qHip).sub(relKnee).applyQuaternion(qKnee).add(relKnee).add(HIP);
    const ids = leg.ids;
    const rest = leg.rest;
    const restN = leg.restN;
    const hipW = leg.hip;
    const kneeW = leg.knee;
    const ankleW = leg.ankle;
    for (let k = 0; k < ids.length; k++) {
      const i = ids[k];
      const o = i * 3;
      const wh = hipW[i];
      const ox = rest[o];
      const oy = rest[o + 1];
      const oz = rest[o + 2];
      tmp.set(ox - HIP.x, oy - HIP.y, oz - HIP.z).applyQuaternion(qHip);
      let x = ox + (HIP.x + tmp.x - ox) * wh;
      let y = oy + (HIP.y + tmp.y - oy) * wh;
      let z = oz + (HIP.z + tmp.z - oz) * wh;
      const wk = kneeW[i];
      if (wk > 0) {
        tmp.set(x - kneeNow.x, y - kneeNow.y, z - kneeNow.z).applyQuaternion(qKnee);
        x += (kneeNow.x + tmp.x - x) * wk;
        y += (kneeNow.y + tmp.y - y) * wk;
        z += (kneeNow.z + tmp.z - z) * wk;
      }
      const wa = ankleW[i];
      if (wa > 0) {
        tmp.set(x - ankleNow.x, y - ankleNow.y, z - ankleNow.z).applyQuaternion(qAnkle);
        x += (ankleNow.x + tmp.x - x) * wa;
        y += (ankleNow.y + tmp.y - y) * wa;
        z += (ankleNow.z + tmp.z - z) * wa;
      }
      pos[o] = x;
      pos[o + 1] = y;
      pos[o + 2] = z;
      if (!nrm || !restN) continue;
      const nx = restN[o];
      const ny = restN[o + 1];
      const nz = restN[o + 2];
      tmp.set(nx, ny, nz).applyQuaternion(qHip);
      let rx = nx + (tmp.x - nx) * wh;
      let ry = ny + (tmp.y - ny) * wh;
      let rz = nz + (tmp.z - nz) * wh;
      if (wk > 0) {
        tmp.set(rx, ry, rz).applyQuaternion(qKnee);
        rx += (tmp.x - rx) * wk;
        ry += (tmp.y - ry) * wk;
        rz += (tmp.z - rz) * wk;
      }
      if (wa > 0) {
        tmp.set(rx, ry, rz).applyQuaternion(qAnkle);
        rx += (tmp.x - rx) * wa;
        ry += (tmp.y - ry) * wa;
        rz += (tmp.z - rz) * wa;
      }
      const len = Math.hypot(rx, ry, rz) || 1;
      nrm[o] = rx / len;
      nrm[o + 1] = ry / len;
      nrm[o + 2] = rz / len;
    }
    leg.pos.needsUpdate = true;
    if (leg.nrm) leg.nrm.needsUpdate = true;
    leg.posed = true;
  });
  return <group ref={rig} />;
}
