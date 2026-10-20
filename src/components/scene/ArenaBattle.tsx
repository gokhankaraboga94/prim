import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import * as THREE from "three";
import { REEL_HOLD } from "../../recordCanvas";
import { buildNameAtlas, type NameAtlas, type NameCell } from "../../nameAtlas";
import { dropGroundSlab } from "../../groundSlab";
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

function buildFoe(root: THREE.Object3D) {
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

type ArmRig = {
  pos: THREE.BufferAttribute;
  rest: Float32Array;
  weights: Float32Array;
  pivotX: number;
  pivotY: number;
  pivotZ: number;
  side: number;
  forwardX: boolean;
  dirty: number;
};

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

function smooth01(a: number, b: number, v: number) {
  const k = Math.max(0, Math.min(1, (v - a) / (b - a)));
  return k * k * (3 - 2 * k);
}

function armWeight(yN: number, latN: number) {
  if (yN < ARM_Y_LO || yN > ARM_Y_HI || latN < ARM_GATE) return 0;
  return smooth01(ARM_GATE, ARM_FULL, latN) * smooth01(ARM_Y_LO, ARM_Y_IN, yN) * (1 - smooth01(ARM_Y_FADE, ARM_Y_HI, yN));
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

/**
 * Shoulder angles for a strike, in the hero frame (lateral x toward the weapon
 * side, up y, forward z). Windup cocks the arm out and back; the chop sweeps it
 * over the outside and lands pointing forward, slightly down, with a short reach.
 * Recovery scales both inputs together so the arm returns straight to rest.
 */
function strikeAngles(side: number, strike: ArmStrike) {
  return {
    rz: side * (strike.lift * 0.9 - strike.chop * 0.5),
    rx: strike.lift * 0.9 - strike.chop * 2.0,
    reach: strike.chop * 0.2,
  };
}

function rigArm(mesh: THREE.Mesh, forwardX: boolean) {
  const pos = mesh.geometry.getAttribute("position") as THREE.BufferAttribute;
  if (!pos) return;
  mesh.geometry.computeBoundingBox();
  const box = mesh.geometry.boundingBox;
  if (!box) return;
  const minY = box.min.y;
  const height = Math.max(0.001, box.max.y - minY);
  const rest = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    rest[i * 3] = pos.getX(i);
    rest[i * 3 + 1] = pos.getY(i);
    rest[i * 3 + 2] = pos.getZ(i);
  }
  const lat = (i: number) => (forwardX ? rest[i * 3 + 2] : rest[i * 3]);
  const side = armSide(lat, (i) => rest[i * 3 + 1], pos.count, minY, height);
  const weights = new Float32Array(pos.count);
  for (let i = 0; i < pos.count; i++) {
    weights[i] = armWeight((rest[i * 3 + 1] - minY) / height, (lat(i) * side) / height);
  }
  const rig: ArmRig = {
    pos,
    rest,
    weights,
    pivotX: forwardX ? height * 0.04 : side * height * ARM_PIVOT_X,
    pivotY: minY + height * ARM_PIVOT_Y,
    pivotZ: forwardX ? side * height * ARM_PIVOT_X : 0,
    side,
    forwardX,
    dirty: 0,
  };
  mesh.userData.arm = rig;
}

function poseArm(rig: ArmRig, strike: ArmStrike) {
  const lift = strike.lift;
  const chop = strike.chop;
  if (lift === 0 && chop === 0) {
    if (rig.dirty === 0) return false;
    for (let i = 0; i < rig.weights.length; i++) rig.pos.setXYZ(i, rig.rest[i * 3], rig.rest[i * 3 + 1], rig.rest[i * 3 + 2]);
    rig.pos.needsUpdate = true;
    rig.dirty = 0;
    return true;
  }
  rig.dirty = 1;
  const { rz, rx, reach } = strikeAngles(rig.side, strike);
  const cz = Math.cos(rz);
  const sz = Math.sin(rz);
  const cx = Math.cos(rx);
  const sx = Math.sin(rx);
  const swap = rig.forwardX;
  for (let i = 0; i < rig.weights.length; i++) {
    const w = rig.weights[i];
    const x0 = rig.rest[i * 3];
    const y0 = rig.rest[i * 3 + 1];
    const z0 = rig.rest[i * 3 + 2];
    if (w < 0.001) {
      rig.pos.setXYZ(i, x0, y0, z0);
      continue;
    }
    // Into the hero frame: lateral x, up y, forward z. Roman swaps x and z.
    const dx = x0 - rig.pivotX;
    const dz = z0 - rig.pivotZ;
    let x = swap ? dz : dx;
    let y = y0 - rig.pivotY;
    let z = swap ? dx : dz;
    // Raise out (about z), then swing back/forward (about x), then reach.
    const x1 = x * cz - y * sz;
    const y1 = x * sz + y * cz;
    x = x1;
    y = y1;
    const y2 = y * cx - z * sx;
    const z2 = y * sx + z * cx + reach;
    y = y2;
    z = z2;
    const ox = swap ? z : x;
    const oz = swap ? x : z;
    rig.pos.setXYZ(i, x0 + (rig.pivotX + ox - x0) * w, y0 + (rig.pivotY + y - y0) * w, z0 + (rig.pivotZ + oz - z0) * w);
  }
  rig.pos.needsUpdate = true;
  return true;
}

function fitHero(scene: THREE.Group, yaw: number, light = false) {
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
    if (mesh.isMesh) lightenMesh(mesh, light ? 0 : 0.008);
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
    rigArm(mesh, false);
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
    loader.load(url, (gltf) => {
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
    });
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
  const minY = box.min.y;
  const height = Math.max(0.001, box.max.y - minY);
  // Roman faces +X, so its lateral axis is z.
  const side = armSide((i) => pos.getZ(i), (i) => pos.getY(i), pos.count, minY, height);
  const weights = new Float32Array(pos.count);
  for (let i = 0; i < pos.count; i++) {
    weights[i] = armWeight((pos.getY(i) - minY) / height, (pos.getZ(i) * side) / height);
  }
  geo.setAttribute("armW", new THREE.BufferAttribute(weights, 1));
  const strike = new THREE.InstancedBufferAttribute(new Float32Array(ARENA_FOES * 2), 2);
  strike.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute("aStrike", strike);
  const pivot = new THREE.Vector3(height * 0.04, minY + height * ARM_PIVOT_Y, side * height * ARM_PIVOT_X);
  const material = new THREE.MeshLambertMaterial({ vertexColors: true });
  material.customProgramCacheKey = () => "arena-roman-arm-v2";
  material.onBeforeCompile = (shader) => {
    shader.uniforms.armSide = { value: side };
    shader.uniforms.armPivot = { value: pivot };
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `#include <common>
         attribute float armW;
         attribute vec2 aStrike;
         uniform float armSide;
         uniform vec3 armPivot;
         // Same strike as strikeAngles(): hero frame is (lateral, up, forward); roman swaps x/z.
         vec3 armSwing(vec3 v, float lift, float chop, float reach) {
           vec3 h = vec3(v.z, v.y, v.x);
           float rz = armSide * (lift * 0.9 - chop * 0.5);
           float rx = lift * 0.9 - chop * 2.0;
           float cz = cos(rz);
           float sz = sin(rz);
           h = vec3(h.x * cz - h.y * sz, h.x * sz + h.y * cz, h.z);
           float cx = cos(rx);
           float sx = sin(rx);
           h = vec3(h.x, h.y * cx - h.z * sx, h.y * sx + h.z * cx + reach);
           return vec3(h.z, h.y, h.x);
         }`
      )
      .replace(
        "#include <beginnormal_vertex>",
        `#include <beginnormal_vertex>
         objectNormal = mix(objectNormal, armSwing(objectNormal, aStrike.x, aStrike.y, 0.0), armW);`
      )
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
         vec3 arm = armSwing(transformed - armPivot, aStrike.x, aStrike.y, aStrike.y * 0.2);
         transformed = mix(transformed, arm + armPivot, armW);`
      );
  };
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
      loader.load(
        url,
        (gltf) => {
          if (drop) return;
          loaded[index] = fitHero(gltf.scene, HERO_YAW[index] ?? 0, light);
          settle();
        },
        undefined,
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
    const list: ArmRig[] = [];
    body.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.isMesh && mesh.userData.arm) list.push(mesh.userData.arm as ArmRig);
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
    const hit = arenaHeroStrike(index, t);
    let moved = false;
    for (const arm of arms) moved = poseArm(arm, hit) || moved;
    if (moved) {
      body.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (mesh.isMesh) mesh.geometry.computeVertexNormals();
      });
    }
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
