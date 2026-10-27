import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import * as THREE from "three";
import { REEL_HOLD } from "../../recordCanvas";
import { buildNameAtlas, type NameAtlas, type NameCell } from "../../nameAtlas";
import { dropGroundSlab } from "../../groundSlab";
import { preloadedGlb } from "../../arenaPreload";
import { simplifySkinned } from "../../knightSoldier";
import { HERO_YAW } from "../../heroReel";
import {
  ARENA_FOES,
  ARENA_HERO_URLS,
  ARENA_HEROES,
  arenaCam,
  arenaFoe,
  arenaFoeStrike,
  arenaHero,
  arenaHeroNames,
  arenaHeroStrike,
  type ArenaPose,
  type ArmStrike,
} from "../../arenaReel";

const ARENA_URL = "/models/arena.glb";
const ARENA_SCALE = 17;
const ARENA_FLOOR_Y = 0.025;

const HERO_H = 1.58;
const FOE_H = 1.22;

type Gltf = Parameters<Parameters<GLTFLoader["load"]>[1]>[0];

/** Parses a preloaded buffer when arena3 fetched it ahead; otherwise streams the file. */
function loadGlb(loader: GLTFLoader, url: string, ok: (gltf: Gltf) => void, fail: (err: unknown) => void) {
  const buf = preloadedGlb(url);
  if (buf) loader.parse(buf.slice(0), "", ok, fail);
  else loader.load(url, ok, undefined, fail);
}
const dummy = new THREE.Object3D();
const pose: ArenaPose = { x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0, s: 1 };

function romanColor(src: THREE.Material) {
  const c = (src as THREE.MeshStandardMaterial).color;
  const max = Math.max(c.r, c.g, c.b);
  const min = Math.min(c.r, c.g, c.b);
  const sat = max < 0.02 ? 0 : (max - min) / max;
  const skin = sat > 0.4 && c.r > 0.75 && c.g > 0.4 && c.b > 0.15 && c.b < 0.5;
  const leather = c.r > c.g && c.g > c.b && c.r < 0.45 && sat > 0.45;
  const steel = sat < 0.22 && max > 0.55 && max < 0.9 && min > 0.45;
  if (skin || leather || steel) return c.clone();
  return new THREE.Color("#c41c16");
}

function paintRoman(geo: THREE.BufferGeometry, color: THREE.Color) {
  const src = geo.getIndex() ? geo.toNonIndexed() : geo;
  const pos = src.getAttribute("position");
  const next = new THREE.BufferGeometry();
  next.setAttribute("position", pos.clone());
  const norm = src.getAttribute("normal");
  if (norm) next.setAttribute("normal", norm.clone());
  const colors = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }
  next.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  if (!norm) next.computeVertexNormals();
  if (src !== geo) src.dispose();
  return next;
}

function withoutFootBase(geo: THREE.BufferGeometry) {
  const srcPos = geo.getAttribute("position");
  const srcNorm = geo.getAttribute("normal");
  const index = geo.getIndex();
  if (!srcPos) return geo;
  geo.computeBoundingBox();
  const bounds = geo.boundingBox;
  if (!bounds) return geo;
  const height = bounds.max.y - bounds.min.y;
  const wide = bounds.max.x - bounds.min.x > 0.22 && bounds.max.z - bounds.min.z > 0.22;
  if (wide && height < 0.05 && bounds.max.y < -0.15) return null;
  const hasBase = bounds.min.y < -0.3 && bounds.max.y > 0;
  if (!hasBase) return geo;
  const kept: number[] = [];
  const pushTri = (a: number, b: number, c: number) => {
    const top = Math.max(srcPos.getY(a), srcPos.getY(b), srcPos.getY(c));
    if (top < 0) return;
    kept.push(a, b, c);
  };
  if (index) {
    for (let i = 0; i < index.count; i += 3) pushTri(index.getX(i), index.getX(i + 1), index.getX(i + 2));
  } else {
    for (let i = 0; i < srcPos.count; i += 3) pushTri(i, i + 1, i + 2);
  }
  if (!kept.length) return null;
  if (kept.length === (index ? index.count : srcPos.count)) return geo;
  const next = new THREE.BufferGeometry();
  const positions = new Float32Array(kept.length * 3);
  const normals = srcNorm ? new Float32Array(kept.length * 3) : null;
  for (let i = 0; i < kept.length; i++) {
    const v = kept[i];
    positions[i * 3] = srcPos.getX(v);
    positions[i * 3 + 1] = srcPos.getY(v);
    positions[i * 3 + 2] = srcPos.getZ(v);
    if (normals && srcNorm) {
      normals[i * 3] = srcNorm.getX(v);
      normals[i * 3 + 1] = srcNorm.getY(v);
      normals[i * 3 + 2] = srcNorm.getZ(v);
    }
  }
  next.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  if (normals) next.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
  geo.dispose();
  return next;
}

export function buildFoe(root: THREE.Object3D) {
  root.updateMatrixWorld(true);
  const pieces: THREE.BufferGeometry[] = [];
  const box = new THREE.Box3();
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    const cloned = mesh.geometry.clone();
    cloned.applyMatrix4(mesh.matrixWorld);
    const geo = withoutFootBase(cloned);
    if (!geo) {
      cloned.dispose();
      return;
    }
    geo.computeBoundingBox();
    if (geo.boundingBox) box.union(geo.boundingBox);
    const src = mesh.material;
    pieces.push(paintRoman(geo, romanColor(Array.isArray(src) ? src[0] : src)));
    geo.dispose();
  });
  if (!pieces.length || box.isEmpty()) return null;
  const merged = mergeGeometries(pieces, false);
  for (const piece of pieces) piece.dispose();
  if (!merged) return null;
  const height = Math.max(0.001, box.max.y - box.min.y);
  const s = FOE_H / height;
  const cx = (box.min.x + box.max.x) / 2;
  const cz = (box.min.z + box.max.z) / 2;
  merged.applyMatrix4(new THREE.Matrix4().makeScale(s, s, s).multiply(new THREE.Matrix4().makeTranslation(-cx, -box.min.y, -cz)));
  return merged;
}

function cheapMaterial(src: THREE.Material) {
  const mat = (Array.isArray(src) ? src[0] : src) as THREE.MeshStandardMaterial;
  const next = new THREE.MeshLambertMaterial({
    map: mat.map ?? null,
    color: mat.color ? mat.color.clone() : "#ffffff",
    side: mat.side,
  });
  mat.map = null;
  mat.normalMap?.dispose();
  mat.roughnessMap?.dispose();
  mat.metalnessMap?.dispose();
  mat.dispose();
  return next;
}

/** cellFrac 0 keeps the geometry (already packed offline) and only swaps the material. */
function lightenMesh(mesh: THREE.Mesh, cellFrac: number) {
  if (cellFrac > 0) {
    const geo = mesh.geometry;
    geo.computeBoundingBox();
    const box = geo.boundingBox;
    const span = box ? Math.max(box.max.x - box.min.x, box.max.y - box.min.y, box.max.z - box.min.z) : 1;
    const next = simplifySkinned(geo, Math.max(1e-4, span * cellFrac));
    mesh.geometry = next;
    geo.dispose();
  }
  mesh.material = cheapMaterial(Array.isArray(mesh.material) ? mesh.material[0] : mesh.material);
  mesh.frustumCulled = false;
  mesh.castShadow = false;
  mesh.receiveShadow = false;
}

/**
 * Arm cut, in body heights. Measured on the arena models: legs, skirts and capes
 * reach 0.20–0.33 wide below 0.35h, the hanging hand sits near 0.45h, the shoulder
 * top near 0.80h, torso half-width about 0.11h. So the arm is: above 0.40h, below
 * 0.88h, further out than 0.11h. Everything else keeps its rest position.
 */
const ARM_Y_LO = 0.4;
const ARM_Y_IN = 0.47;
const ARM_Y_FADE = 0.8;
const ARM_Y_HI = 0.88;
const ARM_GATE = 0.11;
const ARM_FULL = 0.18;
const ARM_PIVOT_Y = 0.8;
const ARM_PIVOT_X = 0.14;
/** Elbow sits 0.17h below the shoulder; vertices under it are forearm and hand. */
const ARM_ELBOW_DROP = 0.17;
const ARM_ELBOW_Y = ARM_PIVOT_Y - ARM_ELBOW_DROP;

function smooth01(a: number, b: number, v: number) {
  const k = Math.max(0, Math.min(1, (v - a) / (b - a)));
  return k * k * (3 - 2 * k);
}

function armWeight(yN: number, latN: number) {
  if (yN < ARM_Y_LO || yN > ARM_Y_HI || latN < ARM_GATE) return 0;
  return smooth01(ARM_GATE, ARM_FULL, latN) * smooth01(ARM_Y_LO, ARM_Y_IN, yN) * (1 - smooth01(ARM_Y_FADE, ARM_Y_HI, yN));
}

function forearmWeight(yN: number) {
  return 1 - smooth01(ARM_ELBOW_Y - 0.03, ARM_ELBOW_Y + 0.03, yN);
}

/**
 * The strike runs on the GPU. Per vertex: armW (whole arm) and armE (forearm);
 * per draw: lift/chop. Hero frame is (lateral toward the weapon side, up,
 * forward); armSwap=1 maps the roman, which faces +X, into that frame.
 * Windup: elbow flexes and the shoulder cocks the arm out and back. Chop: the
 * shoulder sweeps forward over the outside while the elbow extends, and the
 * hand reaches. Recovery scales both inputs together, so the arm returns straight.
 */
const ARM_GLSL = `
  attribute float armW;
  attribute float armE;
  uniform float armSide;
  uniform float armSwap;
  uniform vec3 armPivot;
  uniform float armElbow;
  vec3 armFrame(vec3 v) { return mix(v, v.zyx, armSwap); }
  vec3 armRotX(vec3 v, float a) { float c = cos(a); float s = sin(a); return vec3(v.x, v.y * c - v.z * s, v.y * s + v.z * c); }
  vec3 armRotZ(vec3 v, float a) { float c = cos(a); float s = sin(a); return vec3(v.x * c - v.y * s, v.x * s + v.y * c, v.z); }
  vec3 armSwing(vec3 rel, float wE, float lift, float chop, float reach) {
    vec3 h = armFrame(rel);
    float bend = -(lift * 1.15 - chop * 0.8);
    vec3 elbow = vec3(0.0, -armElbow, 0.0);
    vec3 fore = armRotX(h - elbow, bend) + elbow;
    h = mix(h, fore, wE);
    h = armRotZ(h, armSide * (lift * 0.9 - chop * 0.5));
    h = armRotX(h, lift * 0.9 - chop * 2.0);
    h.z += reach;
    return armFrame(h);
  }
  vec3 armSwingNormal(vec3 n, float wE, float lift, float chop) {
    vec3 h = armFrame(n);
    float bend = -(lift * 1.15 - chop * 0.8);
    h = mix(h, armRotX(h, bend), wE);
    h = armRotZ(h, armSide * (lift * 0.9 - chop * 0.5));
    h = armRotX(h, lift * 0.9 - chop * 2.0);
    return armFrame(h);
  }
`;

type ArmUniforms = {
  uStrike: { value: THREE.Vector2 };
  armSide: { value: number };
  armSwap: { value: number };
  armPivot: { value: THREE.Vector3 };
  armElbow: { value: number };
  uGait?: { value: THREE.Vector2 };
  uMinY?: { value: number };
  uHeight?: { value: number };
};

/** Writes armW/armE onto the geometry and returns the weapon side. `preferSide` forces the weapon hand (-1 is -X, the right hand when the figure faces +Z). */
export function paintArmWeights(geo: THREE.BufferGeometry, forwardX: boolean, preferSide?: number) {
  const pos = geo.getAttribute("position") as THREE.BufferAttribute;
  geo.computeBoundingBox();
  const box = geo.boundingBox;
  if (!pos || !box) return null;
  const minY = box.min.y;
  const height = Math.max(0.001, box.max.y - minY);
  const lat = (i: number) => (forwardX ? pos.getZ(i) : pos.getX(i));
  const picked = armSide(lat, (i) => pos.getY(i), pos.count, minY, height);
  const side = preferSide === 1 || preferSide === -1 ? preferSide : picked;
  const armW = new Float32Array(pos.count);
  const armE = new Float32Array(pos.count);
  for (let i = 0; i < pos.count; i++) {
    const yN = (pos.getY(i) - minY) / height;
    armW[i] = armWeight(yN, (lat(i) * side) / height);
    armE[i] = armW[i] > 0 ? forearmWeight(yN) : 0;
  }
  geo.setAttribute("armW", new THREE.BufferAttribute(armW, 1));
  geo.setAttribute("armE", new THREE.BufferAttribute(armE, 1));
  const pivot = forwardX
    ? new THREE.Vector3(height * 0.04, minY + height * ARM_PIVOT_Y, side * height * ARM_PIVOT_X)
    : new THREE.Vector3(side * height * ARM_PIVOT_X, minY + height * ARM_PIVOT_Y, 0);
  return { side, pivot, elbow: height * ARM_ELBOW_DROP, minY, height };
}

/** The hanging blade sits below the arm band, so the shoulder swing never reaches it. Pull those vertices into the weapon hand. */
function weightBlade(geo: THREE.BufferGeometry, side: number) {
  const pos = geo.getAttribute("position") as THREE.BufferAttribute;
  const armW = geo.getAttribute("armW") as THREE.BufferAttribute;
  const armE = geo.getAttribute("armE") as THREE.BufferAttribute;
  if (!pos || !armW || !armE) return;
  geo.computeBoundingBox();
  const box = geo.boundingBox;
  if (!box) return;
  const minY = box.min.y;
  const height = Math.max(0.001, box.max.y - minY);
  const chest: number[] = [];
  for (let i = 0; i < pos.count; i++) {
    const yn = (pos.getY(i) - minY) / height;
    if (yn < 0.5 || yn > 0.72) continue;
    chest.push(pos.getX(i));
  }
  if (chest.length < 30) return;
  chest.sort((a, b) => a - b);
  const cx = chest[chest.length >> 1];
  for (let i = 0; i < pos.count; i++) {
    const yn = (pos.getY(i) - minY) / height;
    if (yn > 0.7) continue;
    const lat = ((pos.getX(i) - cx) * side) / height;
    if (lat < 0.2) continue;
    armW.setX(i, 1);
    armE.setX(i, 1);
  }
  armW.needsUpdate = true;
  armE.needsUpdate = true;
}

export function armUniforms(side: number, pivot: THREE.Vector3, elbow: number, forwardX: boolean): ArmUniforms {
  return {
    uStrike: { value: new THREE.Vector2(0, 0) },
    armSide: { value: side },
    armSwap: { value: forwardX ? 1 : 0 },
    armPivot: { value: pivot },
    armElbow: { value: elbow },
  };
}

const MARCH_GLSL = `
uniform vec2 uGait;
uniform float uMinY;
uniform float uHeight;
`;

/** `strikeExpr` reads the strike for this vertex: a uniform for heroes, an instance attribute for foes. */
export function installArmShader(material: THREE.Material, uniforms: ArmUniforms, strikeExpr: string, key: string, march = false, soft = false) {
  material.customProgramCacheKey = () => key;
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", `#include <common>\n${ARM_GLSL}\n${march ? MARCH_GLSL : ""}\n${strikeExpr}`)
      .replace(
        "#include <beginnormal_vertex>",
        `#include <beginnormal_vertex>
         vec2 armHit = armStrike();
         objectNormal = normalize(mix(objectNormal, armSwingNormal(objectNormal, armE, armHit.x, armHit.y), armW));`
      )
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
         vec3 armSwung = armSwing(transformed - armPivot, armE, armHit.x, armHit.y, armHit.y * 0.2) + armPivot;
         transformed = mix(transformed, armSwung, armW);
         ${march ? `float legYn = (transformed.y - uMinY) / max(uHeight, 0.001);
         float legW = (1.0 - smoothstep(0.38, 0.5, legYn)) * (1.0 - armW) * smoothstep(0.02, 0.07, abs(transformed.x));
         float phase = uGait.x + (transformed.x >= 0.0 ? 0.0 : 3.14159265);
         float stride = sin(phase) * uGait.y * ${soft ? "0.26" : "0.42"};
         float kick = max(sin(phase - 0.65), 0.0) * uGait.y;
         vec3 hip = vec3(transformed.x, uMinY + uHeight * 0.46, transformed.z);
         vec3 leg = transformed - hip;
         float cs = cos(stride);
         float sn = sin(stride);
         leg = vec3(leg.x, leg.y * cs - leg.z * sn, leg.y * sn + leg.z * cs);
         float low = 1.0 - smoothstep(0.18, 0.3, legYn);
         vec3 knee = vec3(0.0, uMinY + uHeight * 0.24 - hip.y, 0.0);
         vec3 shin = leg - knee;
         float kb = -kick * ${soft ? "0.0" : "1.05"};
         float kcs = cos(kb);
         float ksn = sin(kb);
         shin = vec3(shin.x, shin.y * kcs - shin.z * ksn, shin.y * ksn + shin.z * kcs);
         leg = mix(leg, shin + knee, low);
         transformed = mix(transformed, leg + hip, legW);` : ""}`
      );
  };
}

/** Pick the weapon side: the furthest lateral vertex inside the arm band. */
function armSide(getLat: (i: number) => number, getY: (i: number) => number, count: number, minY: number, height: number) {
  let best = 0;
  let side = 1;
  for (let i = 0; i < count; i++) {
    const yN = (getY(i) - minY) / height;
    if (yN < ARM_Y_LO || yN > ARM_Y_FADE) continue;
    const lateral = getLat(i);
    if (Math.abs(lateral) <= Math.abs(best)) continue;
    best = lateral;
    side = lateral < 0 ? -1 : 1;
  }
  return side;
}

type RigExtra = { side?: number; march?: boolean; blade?: boolean; soft?: boolean };

/** Heroes: one draw each, strike comes in as a uniform the frame loop updates. */
function rigArm(mesh: THREE.Mesh, forwardX: boolean, extra?: RigExtra) {
  const cut = paintArmWeights(mesh.geometry, forwardX, extra?.side);
  if (!cut) return;
  if (extra?.blade) weightBlade(mesh.geometry, cut.side);
  const uniforms = armUniforms(cut.side, cut.pivot, cut.elbow, forwardX);
  const material = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
  let expr = "uniform vec2 uStrike;\nvec2 armStrike() { return uStrike; }";
  let key = "arena-hero-arm";
  if (extra?.march) {
    const gait = new THREE.Vector2();
    uniforms.uGait = { value: gait };
    uniforms.uMinY = { value: cut.minY };
    uniforms.uHeight = { value: cut.height };
    mesh.userData.gait = gait;
    expr = "uniform vec2 uStrike;\nvec2 armStrike() { return uStrike; }";
    key = extra?.soft ? "kapi-march-arm-soft" : "kurtar-march-arm-v3";
  }
  installArmShader(material, uniforms, expr, key, Boolean(extra?.march), Boolean(extra?.soft));
  material.needsUpdate = true;
  mesh.userData.armStrike = uniforms.uStrike.value;
}

export function fitHero(scene: THREE.Group, yaw: number, light = false, rig = true, extra?: RigExtra) {
  scene.updateMatrixWorld(true);
  scene.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    const baked = mesh.geometry.clone();
    baked.applyMatrix4(mesh.matrixWorld);
    mesh.geometry.dispose();
    mesh.geometry = dropGroundSlab(baked);
    mesh.position.set(0, 0, 0);
    mesh.quaternion.identity();
    mesh.scale.set(1, 1, 1);
    mesh.updateMatrix();
  });
  scene.position.set(0, 0, 0);
  scene.quaternion.identity();
  scene.scale.set(1, 1, 1);
  scene.updateMatrixWorld(true);
  scene.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    // Packed models keep their geometry unless they are still heavy (split shells resist offline simplify).
    const heavy = mesh.geometry.getAttribute("position").count > 70000;
    lightenMesh(mesh, light ? (heavy ? 0.006 : 0) : 0.008);
  });
  scene.rotation.y = yaw;
  scene.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(scene);
  const span = Math.max(0.001, box.max.y - box.min.y);
  scene.scale.setScalar(HERO_H / span);
  scene.updateMatrixWorld(true);
  const fitted = new THREE.Box3().setFromObject(scene);
  scene.position.set(-(fitted.min.x + fitted.max.x) / 2, -fitted.min.y, -(fitted.min.z + fitted.max.z) / 2);
  scene.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.frustumCulled = false;
    if (rig) rigArm(mesh, false, extra);
  });
  return scene;
}

function ArenaCam() {
  const perspCam = useRef<THREE.PerspectiveCamera | null>(null);
  useFrame(({ camera, clock }) => {
    if ((camera as THREE.PerspectiveCamera).isPerspectiveCamera) perspCam.current = camera as THREE.PerspectiveCamera;
    const persp = perspCam.current;
    if (!persp) return;
    const shot = arenaCam(Math.max(0, clock.elapsedTime - REEL_HOLD));
    persp.fov = shot.fov;
    persp.near = 0.15;
    persp.far = 280;
    persp.updateProjectionMatrix();
    persp.position.set(shot.x, shot.y, shot.z);
    persp.up.set(0, 1, 0);
    persp.lookAt(shot.lx, shot.ly, shot.lz);
  });
  return null;
}

function ArenaSky() {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        toneMapped: false,
        vertexShader: `
          varying vec3 vPos;
          void main() {
            vPos = position;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          varying vec3 vPos;
          void main() {
            float h = normalize(vPos).y;
            vec3 zenith = vec3(0.16, 0.42, 0.86);
            vec3 horizon = vec3(0.62, 0.80, 0.95);
            vec3 below = vec3(0.74, 0.86, 0.96);
            vec3 col = mix(below, horizon, smoothstep(-0.55, -0.02, h));
            col = mix(col, zenith, smoothstep(0.0, 0.55, h));
            gl_FragColor = vec4(col, 1.0);
          }
        `,
      }),
    []
  );
  useEffect(() => () => mat.dispose(), [mat]);
  return (
    <mesh material={mat} frustumCulled={false}>
      <sphereGeometry args={[140, 24, 16]} />
    </mesh>
  );
}

function ArenaModel({ url = ARENA_URL, light = false }: { url?: string; light?: boolean }) {
  const rig = useRef<THREE.Group>(null);
  useEffect(() => {
    const loader = new GLTFLoader();
    let drop = false;
    loadGlb(
      loader,
      url,
      (gltf) => {
        const host = rig.current;
        if (drop || !host) return;
        const model = gltf.scene;
        model.scale.setScalar(ARENA_SCALE);
        model.position.set(0, -ARENA_FLOOR_Y * ARENA_SCALE, 0);
        model.traverse((obj) => {
          const mesh = obj as THREE.Mesh;
          if (mesh.isMesh) lightenMesh(mesh, light ? 0 : 0.006);
        });
        host.add(model);
      },
      (err) => console.warn("arena model failed", url, err)
    );
    return () => {
      drop = true;
      const host = rig.current;
      if (!host) return;
      host.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (!mesh.isMesh) return;
        mesh.geometry?.dispose();
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const mat of mats) {
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
  }, [url, light]);
  return <group ref={rig} />;
}

function ArenaClouds() {
  return (
    <group position={[0, -22, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[70, 24]} />
        <meshBasicMaterial color="#f4f7fb" transparent opacity={0.9} />
      </mesh>
      <mesh position={[18, -3, -12]} rotation={[-Math.PI / 2, 0, 0.2]}>
        <circleGeometry args={[28, 20]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.75} />
      </mesh>
      <mesh position={[-22, -1.5, 8]} rotation={[-Math.PI / 2, 0, -0.4]}>
        <circleGeometry args={[22, 18]} />
        <meshBasicMaterial color="#e7eef6" transparent opacity={0.8} />
      </mesh>
    </group>
  );
}

function romanArm(geo: THREE.BufferGeometry) {
  const pos = geo.getAttribute("position") as THREE.BufferAttribute;
  geo.computeBoundingBox();
  const box = geo.boundingBox;
  if (!pos || !box) return null;
  // Roman faces +X, so its lateral axis is z; the shader swaps into the hero frame.
  const cut = paintArmWeights(geo, true);
  if (!cut) return null;
  const strike = new THREE.InstancedBufferAttribute(new Float32Array(ARENA_FOES * 2), 2);
  strike.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute("aStrike", strike);
  const material = new THREE.MeshLambertMaterial({ vertexColors: true });
  installArmShader(material, armUniforms(cut.side, cut.pivot, cut.elbow, true), "attribute vec2 aStrike;\nvec2 armStrike() { return aStrike; }", "arena-roman-arm-v3");
  return { geo, material, strike };
}

function ArenaFoes({ push = 0 }: { push?: number }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const [foe, setFoe] = useState<ReturnType<typeof romanArm>>(null);
  useEffect(() => {
    let drop = false;
    const loader = new GLTFLoader();
    loader.load("/models/roman.glb", (gltf) => {
      if (drop) return;
      const geo = buildFoe(gltf.scene);
      setFoe(geo ? romanArm(geo) : null);
    });
    return () => {
      drop = true;
    };
  }, []);
  useEffect(
    () => () => {
      foe?.geo.dispose();
      foe?.material.dispose();
    },
    [foe]
  );
  useFrame(({ clock }) => {
    const body = mesh.current;
    const strike = foe?.strike;
    if (!body || !strike) return;
    const t = Math.max(0, clock.elapsedTime - REEL_HOLD);
    let live = 0;
    for (let i = 0; i < ARENA_FOES; i++) {
      arenaFoe(i, t, pose, push);
      if (pose.s <= 0) continue;
      dummy.position.set(pose.x, pose.y, pose.z);
      dummy.rotation.set(pose.rx, pose.ry, pose.rz);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      body.setMatrixAt(live, dummy.matrix);
      const hit = arenaFoeStrike(i, t);
      strike.setXY(live, hit.lift, hit.chop);
      live += 1;
    }
    body.count = live;
    body.instanceMatrix.needsUpdate = true;
    strike.needsUpdate = true;
  });
  if (!foe) return null;
  return <instancedMesh ref={mesh} args={[foe.geo, foe.material, ARENA_FOES]} frustumCulled={false} />;
}

function ArenaNames({ names, heroes = ARENA_HEROES }: { names: string[]; heroes?: number }) {
  const labels = useMemo(() => arenaHeroNames(names, heroes), [names, heroes]);
  const atlas = useMemo<NameAtlas | null>(() => {
    if (!labels.length) return null;
    const items = labels.map((text) => ({ text, commander: false, plain: true, fill: "#ffe14a", frame: true }));
    try {
      return buildNameAtlas(items, true);
    } catch {
      return buildNameAtlas(items);
    }
  }, [labels]);
  const refs = useRef<(THREE.InstancedMesh | null)[]>([]);
  const plate = useMemo<ArenaPose>(() => ({ x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0, s: 1 }), []);
  useEffect(() => () => atlas?.dispose(), [atlas]);
  useFrame(({ camera, clock }) => {
    if (!atlas) return;
    const t = Math.max(0, clock.elapsedTime - REEL_HOLD);
    dummy.quaternion.copy(camera.quaternion);
    dummy.position.set(0, -40, 0);
    dummy.scale.set(0, 0, 1);
    dummy.updateMatrix();
    for (const cell of atlas.cells) {
      const mesh = refs.current[cell.sheet];
      if (mesh) mesh.setMatrixAt(cell.local, dummy.matrix);
    }
    for (let i = 0; i < labels.length; i++) {
      const cell: NameCell | undefined = atlas.cells[i];
      const mesh = cell ? refs.current[cell.sheet] : null;
      if (!cell || !mesh) continue;
      arenaHero(i, t, plate, heroes);
      const width = 2.35 * 0.55;
      const size = width / Math.max(1.15, cell.sx);
      dummy.position.set(plate.x, plate.y + HERO_H + 0.82, plate.z);
      dummy.scale.set(cell.sx * size, cell.sy * size, 1);
      dummy.updateMatrix();
      mesh.setMatrixAt(cell.local, dummy.matrix);
    }
    for (const mesh of refs.current) {
      if (mesh) mesh.instanceMatrix.needsUpdate = true;
    }
  });
  if (!atlas) return null;
  return (
    <group>
      {atlas.sheets.map((sheet, s) =>
        sheet.count > 0 ? (
          <instancedMesh
            key={s}
            ref={(node) => {
              refs.current[s] = node;
            }}
            args={[sheet.geometry, sheet.material, sheet.count]}
            frustumCulled={false}
            renderOrder={24}
          />
        ) : null
      )}
    </group>
  );
}

/**
 * `light`: packed models (arena3). Each hero appears as soon as it loads and a
 * failed file only loses that hero; the heavy modes wait for the full set.
 */
function ArenaHeroes({ urls, light = false }: { urls: readonly string[]; light?: boolean }) {
  const [bodies, setBodies] = useState<(THREE.Object3D | null)[] | null>(null);
  const keep = useRef<THREE.Group[]>([]);
  useEffect(() => {
    let drop = false;
    const loader = new GLTFLoader();
    let left = urls.length;
    const loaded: (THREE.Group | null)[] = new Array(urls.length).fill(null);
    const settle = () => {
      left -= 1;
      if (light || left <= 0) {
        keep.current = loaded.filter((g): g is THREE.Group => Boolean(g));
        setBodies(loaded.slice(0, urls.length));
      }
    };
    urls.forEach((url, index) => {
      loadGlb(
        loader,
        url,
        (gltf) => {
          if (drop) return;
          loaded[index] = fitHero(gltf.scene, HERO_YAW[index] ?? 0, light);
          settle();
        },
        (err) => {
          if (drop) return;
          console.warn("arena hero failed", url, err);
          settle();
        }
      );
    });
    return () => {
      drop = true;
      for (const scene of keep.current) {
        scene.traverse((obj) => {
          const mesh = obj as THREE.Mesh;
          if (!mesh.isMesh) return;
          mesh.geometry?.dispose();
          const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          for (const mat of mats) {
            const std = mat as THREE.MeshStandardMaterial;
            std.map?.dispose();
            std.normalMap?.dispose();
            std.roughnessMap?.dispose();
            std.metalnessMap?.dispose();
            mat.dispose();
          }
        });
      }
      keep.current = [];
    };
  }, [urls, light]);
  if (!bodies) return null;
  return (
    <group>
      {bodies.map((body, i) => (body ? <ArenaHero key={i} index={i} body={body} heroes={urls.length} /> : null))}
    </group>
  );
}

function ArenaHero({ index, body, heroes }: { index: number; body: THREE.Object3D; heroes: number }) {
  const ref = useRef<THREE.Group>(null);
  const arms = useMemo(() => {
    const list: THREE.Vector2[] = [];
    body.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.isMesh && mesh.userData.armStrike) list.push(mesh.userData.armStrike as THREE.Vector2);
    });
    return list;
  }, [body]);
  useFrame(({ clock }) => {
    const node = ref.current;
    if (!node) return;
    const t = Math.max(0, clock.elapsedTime - REEL_HOLD);
    arenaHero(index, t, pose, heroes);
    node.position.set(pose.x, pose.y, pose.z);
    node.rotation.set(pose.rx, pose.ry, pose.rz);
    const hit: ArmStrike = arenaHeroStrike(index, t);
    for (const arm of arms) arm.set(hit.lift, hit.chop);
  });
  return (
    <group ref={ref}>
      <primitive object={body} />
    </group>
  );
}

export function ArenaBattle({
  names = [],
  urls = ARENA_HERO_URLS,
  foePush = 0,
  arenaUrl = ARENA_URL,
  light = false,
}: {
  names?: string[];
  urls?: readonly string[];
  foePush?: number;
  arenaUrl?: string;
  light?: boolean;
}) {
  return (
    <group>
      <ArenaSky />
      <ArenaClouds />
      <hemisphereLight args={["#d5e7ff", "#8a7048", 0.72]} />
      <ambientLight intensity={0.28} />
      <directionalLight position={[6, 11, 4]} intensity={2.2} color="#fff2dc" />
      <directionalLight position={[-5, 4, -3]} intensity={0.45} color="#9eb6ff" />
      <ArenaModel url={arenaUrl} light={light} />
      <ArenaFoes push={foePush} />
      <ArenaHeroes urls={urls} light={light} />
      <ArenaNames names={names} heroes={urls.length} />
    </group>
  );
}

export { ArenaCam };
