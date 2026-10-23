import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Hud, OrthographicCamera } from "@react-three/drei";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import * as THREE from "three";
import { formatCount } from "../../game";
import { buildKnightSoldier } from "../../knightSoldier";
import { buildNameAtlas, type NameAtlas, type NameCell } from "../../nameAtlas";
import { REEL_HOLD } from "../../recordCanvas";
import { armUniforms, buildFoe, fitHero, installArmShader, paintArmWeights } from "./ArenaBattle";
import {
  KARSI_HERO_FOE,
  KARSI_HERO_ME,
  KARSI_ME,
  karsiCam,
  karsiChief,
  karsiTpsCam,
  karsiEndAt,
  karsiFar,
  karsiFoe,
  karsiFriend,
  makeKarsiLayout,
  type KarsiChief,
  type KarsiLayout,
  type KarsiPose,
  type Rival,
} from "../../karsiReel";

const dummy = new THREE.Object3D();
const pose: KarsiPose = { x: 0, z: 0, yaw: 0, fall: 0, lift: 0, chop: 0 };
const chief: KarsiChief = { x: 0, z: 0, yaw: 0, kneel: 0, lift: 0, chop: 0 };
const ROMAN_H = 1.66;
/** buildFoe fits the roman to the arena height; the field armies stand taller. */
const ROMAN_SCALE = ROMAN_H / 1.22;
const CHIEF_H = 2.7;
/** fitHero fits heroes to 1.58. */
const CHIEF_SCALE = CHIEF_H / 1.58;
const NAME_Y = 2.94;

function upper(name: string) {
  return `@${name.replace(/^@+/, "").toUpperCase()}`;
}

function paintColor(geo: THREE.BufferGeometry, hex: string) {
  const c = new THREE.Color(hex);
  const n = geo.getAttribute("position").count;
  const colors = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  return geo;
}

type Rig = { geo: THREE.BufferGeometry; material: THREE.Material; strike: THREE.InstancedBufferAttribute };

/** One draw per army: body, helm and sword merged so the sword swings with the arm. */
function rigKnight(root: THREE.Object3D, count: number): Rig | null {
  const parts = buildKnightSoldier(root);
  const body = paintColor(parts.body, "#1a56e8");
  const helm = paintColor(parts.helm, "#e7eef5");
  const geo = mergeGeometries([body, helm], false);
  body.dispose();
  helm.dispose();
  if (!geo) return null;
  const cut = paintArmWeights(geo, false);
  if (!cut) return null;
  const strike = new THREE.InstancedBufferAttribute(new Float32Array(Math.max(1, count) * 2), 2);
  strike.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute("aStrike", strike);
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.34, metalness: 0.55, envMapIntensity: 0.9 });
  installArmShader(material, armUniforms(cut.side, cut.pivot, cut.elbow, false), "attribute vec2 aStrike;\nvec2 armStrike() { return aStrike; }", "karsi-knight-arm");
  return { geo, material, strike };
}

function rigRoman(root: THREE.Object3D, count: number): Rig | null {
  const geo = buildFoe(root);
  if (!geo) return null;
  const cut = paintArmWeights(geo, true);
  if (!cut) return null;
  const strike = new THREE.InstancedBufferAttribute(new Float32Array(Math.max(1, count) * 2), 2);
  strike.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute("aStrike", strike);
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.46, metalness: 0.4, envMapIntensity: 0.7 });
  installArmShader(material, armUniforms(cut.side, cut.pivot, cut.elbow, true), "attribute vec2 aStrike;\nvec2 armStrike() { return aStrike; }", "karsi-roman-arm");
  return { geo, material, strike };
}

function useRig(url: string, build: (root: THREE.Object3D, count: number) => Rig | null, count: number) {
  const [rig, setRig] = useState<Rig | null>(null);
  useEffect(() => {
    let drop = false;
    new GLTFLoader().load(url, (gltf) => {
      const next = build(gltf.scene, count);
      if (drop) {
        next?.geo.dispose();
        next?.material.dispose();
        return;
      }
      setRig(next);
    });
    return () => {
      drop = true;
    };
  }, [url, build, count]);
  useEffect(
    () => () => {
      rig?.geo.dispose();
      rig?.material.dispose();
    },
    [rig]
  );
  return rig;
}

function KarsiArmies({ layout }: { layout: KarsiLayout }) {
  const knight = useRig("/models/knight.glb", rigKnight, layout.us.n);
  const roman = useRig("/models/roman.glb", rigRoman, layout.them.n);
  const usRef = useRef<THREE.InstancedMesh>(null);
  const themRef = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    usRef.current?.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    themRef.current?.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  }, [knight, roman]);

  useFrame(({ clock }) => {
    const t = Math.max(0, clock.elapsedTime - REEL_HOLD);
    dummy.rotation.order = "YXZ";
    const us = usRef.current;
    for (let i = 0; i < layout.us.n; i++) {
      karsiFriend(layout, i, t, pose);
      layout.liveX[i] = pose.x;
      layout.liveZ[i] = pose.z;
      layout.liveFall[i] = pose.fall;
      if (!us || !knight) continue;
      dummy.position.set(pose.x, 0.05, pose.z);
      dummy.rotation.set(-1.45 * pose.fall, pose.yaw, 0);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      us.setMatrixAt(i, dummy.matrix);
      knight.strike.setXY(i, pose.lift, pose.chop);
    }
    if (us && knight) {
      us.instanceMatrix.needsUpdate = true;
      knight.strike.needsUpdate = true;
    }
    const them = themRef.current;
    if (layout.invite) return;
    for (let i = 0; i < layout.them.n; i++) {
      karsiFoe(layout, i, t, pose);
      layout.foeX[i] = pose.x;
      layout.foeZ[i] = pose.z;
      layout.foeFall[i] = pose.fall;
      if (!them || !roman) continue;
      dummy.position.set(pose.x, 0.05, pose.z);
      dummy.rotation.set(0, Math.PI / 2, 1.45 * pose.fall);
      dummy.scale.setScalar(ROMAN_SCALE);
      dummy.updateMatrix();
      them.setMatrixAt(i, dummy.matrix);
      roman.strike.setXY(i, pose.lift, pose.chop);
    }
    if (them && roman) {
      them.instanceMatrix.needsUpdate = true;
      roman.strike.needsUpdate = true;
    }
  });

  return (
    <group>
      {knight && layout.us.n > 0 && <instancedMesh ref={usRef} args={[knight.geo, knight.material, layout.us.n]} frustumCulled={false} />}
      {!layout.invite && roman && layout.them.n > 0 && <instancedMesh ref={themRef} args={[roman.geo, roman.material, layout.them.n]} frustumCulled={false} />}
    </group>
  );
}

/** Follower names: yellow on black for us, red on black for the rival list. */
function KarsiNames({ names, layout, foe = false, tight = false }: { names: string[]; layout: KarsiLayout; foe?: boolean; tight?: boolean }) {
  const count = foe ? layout.them.n : layout.us.n;
  const labels = useMemo(() => {
    const out: { slot: number; text: string }[] = [];
    for (let i = 0; i < count; i++) {
      const text = String(names[i] ?? "").trim().replace(/^@+/, "");
      if (text) out.push({ slot: i, text });
    }
    return out;
  }, [names, count]);
  const atlas = useMemo<NameAtlas>(() => {
    const items = labels.map((n) => ({ text: n.text, commander: false, plain: true, fill: foe ? "#ff2a22" : "#ffe14a", frame: true }));
    const sharp = items.length <= 80;
    const crisp = items.length <= 220;
    try {
      return buildNameAtlas(items, crisp, sharp);
    } catch {
      return buildNameAtlas(items);
    }
  }, [labels, foe]);
  const refs = useRef<(THREE.InstancedMesh | null)[]>([]);
  const lookDir = useMemo(() => new THREE.Vector3(), []);
  useEffect(() => () => atlas.dispose(), [atlas]);

  useFrame(({ camera }) => {
    const persp = camera as THREE.PerspectiveCamera;
    const fov = persp.isPerspectiveCamera ? persp.fov : 50;
    const tanH = Math.tan(THREE.MathUtils.degToRad(fov / 2)) * (1080 / 1920);
    camera.getWorldDirection(lookDir);
    dummy.quaternion.copy(camera.quaternion);
    for (let k = 0; k < labels.length; k++) {
      const cell: NameCell | undefined = atlas.cells[k];
      const mesh = cell ? refs.current[cell.sheet] : null;
      if (!cell || !mesh) continue;
      const slot = labels[k].slot;
      const x = foe ? layout.foeX[slot] : layout.liveX[slot];
      const z = foe ? layout.foeZ[slot] : layout.liveZ[slot];
      const dx = x - camera.position.x;
      const dz = z - camera.position.z;
      const ahead = dx * lookDir.x + (NAME_Y - camera.position.y) * lookDir.y + dz * lookDir.z;
      const dist = Math.hypot(dx, camera.position.y - NAME_Y, dz);
      const hide = ahead < (tight ? 5 : 2.4) || dist < (tight ? 10.5 : 2.4) || (foe ? layout.foeFall[slot] : layout.liveFall[slot]) > 0.35;
      const pitch = foe ? layout.them.spread : layout.us.spread;
      const want = Math.min(pitch * (tight ? 0.48 : 1.08), dist * tanH * (tight ? 0.28 : foe ? 0.984 : 0.84));
      const size = want / Math.max(2.05, cell.sx);
      dummy.position.set(x, NAME_Y, z);
      dummy.scale.set(hide ? 0 : cell.sx * size, hide ? 0 : cell.sy * size, 1);
      dummy.updateMatrix();
      mesh.setMatrixAt(cell.local, dummy.matrix);
    }
    for (const mesh of refs.current) {
      if (mesh) mesh.instanceMatrix.needsUpdate = true;
    }
  });

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
            renderOrder={40}
          />
        ) : null
      )}
    </group>
  );
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

function canvasTexture(canvas: HTMLCanvasElement) {
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.generateMipmaps = false;
  map.minFilter = THREE.LinearFilter;
  map.magFilter = THREE.LinearFilter;
  return map;
}

/** Commander tag: yellow on black for us, red on black for the rival. */
function chiefTag(text: string, foe = false) {
  const ink = foe ? "#ff2a22" : "#ffe14a";
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 200;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    let size = 128;
    ctx.font = `900 ${size}px Inter, sans-serif`;
    while (size > 40 && ctx.measureText(text).width > 900) {
      size -= 4;
      ctx.font = `900 ${size}px Inter, sans-serif`;
    }
    const w = Math.min(1004, ctx.measureText(text).width + 90);
    roundRect(ctx, (1024 - w) / 2, 14, w, 172, 34);
    ctx.fillStyle = "#000000";
    ctx.fill();
    ctx.lineWidth = 8;
    ctx.strokeStyle = ink;
    ctx.stroke();
    ctx.fillStyle = ink;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, 512, 104);
  }
  return canvasTexture(canvas);
}

function disposeScene(scene: THREE.Object3D) {
  scene.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.geometry?.dispose();
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const mat of mats) {
      (mat as THREE.MeshStandardMaterial).map?.dispose();
      mat.dispose();
    }
  });
}

/** Pitch around the hilt. The raise goes up; the chop carries the blade forward, then follows through to the hang. */
function poseBlade(blade: THREE.Object3D, lift: number, chop: number) {
  const raise = -2.35;
  const hit = -3.75;
  let angle: number;
  if (lift > 0 && chop > 0) angle = raise * lift + hit * chop;
  else if (chop > 0) angle = -Math.PI * 2 + (hit + Math.PI * 2) * chop;
  else angle = raise * lift;
  blade.rotation.x = angle;
}

/**
 * The blade hangs below the arm band, so the shoulder shader swings the other arm and the torso.
 * Split the thin blade and rotate that mesh only. The body stays in the bind pose.
 */
function takeSword(root: THREE.Object3D) {
  const blades: THREE.Object3D[] = [];
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh || mesh.userData.blade) return;
    const split = splitBlade(mesh.geometry);
    if (!split) return;
    const previous = mesh.geometry;
    mesh.geometry = split.body;
    previous.dispose();
    const blade = new THREE.Mesh(split.sword, mesh.material);
    blade.position.copy(split.hilt);
    blade.frustumCulled = false;
    blade.castShadow = false;
    blade.receiveShadow = false;
    blade.userData.blade = true;
    mesh.add(blade);
    blades.push(blade);
  });
  if (!blades.length) console.warn("commander sword was not found");
  return blades;
}

function splitBlade(geo: THREE.BufferGeometry) {
  const pos = geo.getAttribute("position");
  if (!pos || pos.count < 80) return null;
  let minY = Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < pos.count; i++) {
    minY = Math.min(minY, pos.getY(i));
    maxY = Math.max(maxY, pos.getY(i));
  }
  const height = maxY - minY;
  if (height < 1e-4) return null;
  const chestX: number[] = [];
  const chestZ: number[] = [];
  for (let i = 0; i < pos.count; i++) {
    const yn = (pos.getY(i) - minY) / height;
    if (yn < 0.5 || yn > 0.72) continue;
    chestX.push(pos.getX(i));
    chestZ.push(pos.getZ(i));
  }
  if (chestX.length < 30) return null;
  chestX.sort((a, b) => a - b);
  chestZ.sort((a, b) => a - b);
  const centerX = chestX[chestX.length >> 1];
  const centerZ = chestZ[chestZ.length >> 1];
  let tipI = -1;
  let tipD = -1;
  for (let i = 0; i < pos.count; i++) {
    const yn = (pos.getY(i) - minY) / height;
    if (yn > 0.16) continue;
    const d = Math.hypot(pos.getX(i) - centerX, pos.getZ(i) - centerZ);
    if (d <= tipD) continue;
    tipD = d;
    tipI = i;
  }
  if (tipI < 0 || tipD < height * 0.15) return null;
  const tipX = pos.getX(tipI);
  const tipY = pos.getY(tipI);
  const tipZ = pos.getZ(tipI);
  let dx = 0;
  let dy = 0;
  let dz = 0;
  let near = 0;
  const nearLo = height * 0.03;
  const nearHi = height * 0.08;
  for (let i = 0; i < pos.count; i++) {
    const d = Math.hypot(pos.getX(i) - tipX, pos.getY(i) - tipY, pos.getZ(i) - tipZ);
    if (d < nearLo || d > nearHi) continue;
    dx += pos.getX(i) - tipX;
    dy += pos.getY(i) - tipY;
    dz += pos.getZ(i) - tipZ;
    near += 1;
  }
  const dirLen = Math.hypot(dx, dy, dz);
  if (near < 8 || dirLen < 1e-6) return null;
  const dirX = dx / dirLen;
  const dirY = dy / dirLen;
  const dirZ = dz / dirLen;
  // Walk the thin blade from the tip and stop at the hand, where the cross-section thickens.
  const step = height * 0.025;
  const rad = height * 0.028;
  const shell = height * 0.04;
  const stopSpread = height * 0.038;
  const maxTravel = height * 0.5;
  const sword = new Uint8Array(pos.count);
  const centers: number[] = [];
  let cx = tipX;
  let cy = tipY;
  let cz = tipZ;
  let hx = dirX;
  let hy = dirY;
  let hz = dirZ;
  let traveled = 0;
  const hilt = new THREE.Vector3(tipX, tipY, tipZ);
  const take = (x: number, y: number, z: number, limit: number) => {
    let n = 0;
    let sx = 0;
    let sy = 0;
    let sz = 0;
    let spread = 0;
    const hit: number[] = [];
    for (let i = 0; i < pos.count; i++) {
      const dist = Math.hypot(pos.getX(i) - x, pos.getY(i) - y, pos.getZ(i) - z);
      if (dist > limit) continue;
      hit.push(i);
      sx += pos.getX(i);
      sy += pos.getY(i);
      sz += pos.getZ(i);
      n += 1;
    }
    if (n) {
      sx /= n;
      sy /= n;
      sz /= n;
      for (const i of hit) {
        spread = Math.max(spread, Math.hypot(pos.getX(i) - sx, pos.getY(i) - sy, pos.getZ(i) - sz));
      }
    }
    return { n, sx, sy, sz, spread, hit };
  };
  for (const i of take(tipX, tipY, tipZ, rad).hit) sword[i] = 1;
  for (let s = 0; s < 40; s++) {
    const probe = take(cx + hx * step, cy + hy * step, cz + hz * step, rad);
    if (probe.n < 8) break;
    const vx = probe.sx - cx;
    const vy = probe.sy - cy;
    const vz = probe.sz - cz;
    const hop = Math.hypot(vx, vy, vz) || 1;
    const dot = (vx / hop) * dirX + (vy / hop) * dirY + (vz / hop) * dirZ;
    if (s > 1 && (probe.spread > stopSpread || dot < 0.75 || traveled + hop > maxTravel)) break;
    traveled += hop;
    for (const i of probe.hit) sword[i] = 1;
    hx = vx / hop;
    hy = vy / hop;
    hz = vz / hop;
    cx = probe.sx;
    cy = probe.sy;
    cz = probe.sz;
    hilt.set(cx, cy, cz);
    centers.push(cx, cy, cz);
  }
  for (let i = 0; i < pos.count; i++) {
    if (sword[i]) continue;
    for (let c = 0; c < centers.length; c += 3) {
      const dist = Math.hypot(pos.getX(i) - centers[c], pos.getY(i) - centers[c + 1], pos.getZ(i) - centers[c + 2]);
      if (dist > shell) continue;
      sword[i] = 1;
      break;
    }
  }
  let marked = 0;
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (let i = 0; i < pos.count; i++) {
    if (!sword[i]) continue;
    marked += 1;
    minX = Math.min(minX, pos.getX(i));
    maxX = Math.max(maxX, pos.getX(i));
    minZ = Math.min(minZ, pos.getZ(i));
    maxZ = Math.max(maxZ, pos.getZ(i));
  }
  if (marked < 80 || marked > 6000) return null;
  if (maxX - minX > height * 0.7 || maxZ - minZ > height * 0.7) return null;
  const index = geo.getIndex();
  const triCount = index ? index.count / 3 : pos.count / 3;
  const bladeTris: number[] = [];
  const bodyTris: number[] = [];
  for (let t = 0; t < triCount; t++) {
    const a = index ? index.getX(t * 3) : t * 3;
    const b = index ? index.getX(t * 3 + 1) : t * 3 + 1;
    const c = index ? index.getX(t * 3 + 2) : t * 3 + 2;
    const n = (sword[a] ? 1 : 0) + (sword[b] ? 1 : 0) + (sword[c] ? 1 : 0);
    (n >= 1 ? bladeTris : bodyTris).push(a, b, c);
  }
  if (bladeTris.length < 40 || !bodyTris.length) return null;
  return { body: bakePart(geo, bodyTris, null), sword: bakePart(geo, bladeTris, hilt), hilt };
}

function bakePart(geo: THREE.BufferGeometry, tris: number[], shift: THREE.Vector3 | null) {
  const map = new Map<number, number>();
  const order: number[] = [];
  const nextIndex: number[] = [];
  for (const v of tris) {
    let id = map.get(v);
    if (id == null) {
      id = order.length;
      map.set(v, id);
      order.push(v);
    }
    nextIndex.push(id);
  }
  const next = new THREE.BufferGeometry();
  for (const name in geo.attributes) {
    const attr = geo.getAttribute(name);
    const item = attr.itemSize;
    const arr = new Float32Array(order.length * item);
    for (let i = 0; i < order.length; i++) {
      for (let k = 0; k < item; k++) arr[i * item + k] = attr.getComponent(order[i], k);
    }
    if (shift && name === "position") {
      for (let i = 0; i < order.length; i++) {
        arr[i * item] -= shift.x;
        arr[i * item + 1] -= shift.y;
        arr[i * item + 2] -= shift.z;
      }
    }
    next.setAttribute(name, new THREE.BufferAttribute(arr, item, attr.normalized));
  }
  next.setIndex(nextIndex);
  return next;
}

function KarsiChiefUnit({ layout, mine, name, compact = false }: { layout: KarsiLayout; mine: boolean; name: string; compact?: boolean }) {
  const [body, setBody] = useState<THREE.Group | null>(null);
  const node = useRef<THREE.Group>(null);
  const tag = useRef<THREE.Mesh>(null);
  const tex = useMemo(() => chiefTag(upper(name), !mine), [name, mine]);
  useEffect(() => () => tex.dispose(), [tex]);
  useEffect(() => {
    let drop = false;
    new GLTFLoader().load(mine ? KARSI_HERO_ME : KARSI_HERO_FOE, (gltf) => {
      const fitted = fitHero(gltf.scene, 0, true, false);
      takeSword(fitted);
      if (drop) {
        disposeScene(fitted);
        return;
      }
      setBody(fitted);
    });
    return () => {
      drop = true;
    };
  }, [mine]);
  useEffect(() => () => {
    if (body) disposeScene(body);
  }, [body]);
  const blades = useMemo(() => {
    const list: THREE.Object3D[] = [];
    body?.traverse((obj) => {
      if (obj.userData.blade) list.push(obj);
    });
    return list;
  }, [body]);
  useFrame(({ clock, camera }) => {
    const t = Math.max(0, clock.elapsedTime - REEL_HOLD);
    karsiChief(layout, mine, t, chief);
    const g = node.current;
    if (g) {
      g.position.set(chief.x, -0.55 * chief.kneel, chief.z);
      g.rotation.set(0.38 * chief.kneel * (mine ? 1 : -1), chief.yaw, 0);
    }
    for (const blade of blades) poseBlade(blade, chief.lift, chief.chop);
    const plate = tag.current;
    if (plate) {
      plate.position.set(chief.x, CHIEF_H + (compact ? 0.42 : 0.75) - 0.55 * chief.kneel, chief.z);
      plate.quaternion.copy(camera.quaternion);
    }
  });
  return (
    <group>
      <group ref={node}>
        <group scale={CHIEF_SCALE}>{body && <primitive object={body} />}</group>
      </group>
      <mesh ref={tag} scale={compact ? 0.16 : 1} renderOrder={45}>
        <planeGeometry args={[4.6, 0.9]} />
        <meshBasicMaterial map={tex} transparent depthTest={false} toneMapped={false} />
      </mesh>
    </group>
  );
}

function KarsiHud({ layout, rival }: { layout: KarsiLayout; rival: string }) {
  const size = useThree((s) => s.size);
  const score = useRef<THREE.Mesh>(null);
  const banner = useRef<THREE.Mesh>(null);
  const scoreTex = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 2048;
    canvas.height = 420;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      roundRect(ctx, 28, 28, 1992, 364, 48);
      ctx.fillStyle = "rgba(8, 4, 2, 0.86)";
      ctx.fill();
      ctx.lineWidth = 22;
      ctx.strokeStyle = "#ffe14a";
      ctx.stroke();
      const parts = layout.invite
        ? [
            { text: formatCount(layout.us.real), font: 150, fill: "#ffe14a" },
            { text: ` ${upper(KARSI_ME)}  `, font: 66, fill: "#fff4c4" },
            { text: "HAZIR", font: 120, fill: "#ffffff" },
          ]
        : [
        { text: formatCount(layout.them.real), font: 150, fill: "#ff3b30" },
        { text: ` ${upper(rival)}  `, font: 66, fill: "#ff2a22" },
        { text: "VS", font: 120, fill: "#ffffff" },
        { text: `  ${formatCount(layout.us.real)}`, font: 150, fill: "#ffe14a" },
        { text: ` ${upper(KARSI_ME)}`, font: 66, fill: "#fff4c4" },
      ];
      let scale = 1;
      const widthAt = (s: number) => {
        let sum = 0;
        for (const part of parts) {
          ctx.font = `900 ${Math.round(part.font * s)}px Inter, sans-serif`;
          sum += ctx.measureText(part.text).width;
        }
        return sum;
      };
      while (scale > 0.4 && widthAt(scale) > 1880) scale -= 0.02;
      let cursor = (2048 - widthAt(scale)) / 2;
      ctx.textBaseline = "middle";
      ctx.lineJoin = "round";
      for (const part of parts) {
        const font = Math.round(part.font * scale);
        ctx.font = `900 ${font}px Inter, sans-serif`;
        const tw = ctx.measureText(part.text).width;
        if (part.text === "VS") {
          roundRect(ctx, cursor - 8, 210 - font * 0.48, tw + 16, font * 0.96, 22);
          ctx.fillStyle = "#c41616";
          ctx.fill();
        }
        ctx.lineWidth = Math.max(8, font * 0.09);
        ctx.strokeStyle = "rgba(0,0,0,0.9)";
        ctx.strokeText(part.text, cursor, 210);
        ctx.fillStyle = part.fill;
        ctx.fillText(part.text, cursor, 210);
        cursor += tw;
      }
    }
    return canvasTexture(canvas);
  }, [layout.invite, layout.them.real, layout.us.real, rival]);
  const bannerTex = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 2048;
    canvas.height = 640;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      const winner = layout.weWin ? upper(KARSI_ME) : upper(rival);
      const loser = layout.weWin ? upper(rival) : upper(KARSI_ME);
      roundRect(ctx, 28, 28, 1992, 584, 56);
      ctx.fillStyle = "rgba(0, 0, 0, 0.86)";
      ctx.fill();
      ctx.lineWidth = 22;
      ctx.strokeStyle = "#ffe14a";
      ctx.stroke();
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const line = (text: string, y: number, font: number, fill: string) => {
        let s = font;
        ctx.font = `900 ${s}px Inter, sans-serif`;
        while (s > 40 && ctx.measureText(text).width > 1880) {
          s -= 4;
          ctx.font = `900 ${s}px Inter, sans-serif`;
        }
        ctx.fillStyle = fill;
        ctx.fillText(text, 1024, y);
      };
      if (layout.invite) {
        line("YORUMA ⚔️", 190, 180, "#ffe14a");
        line("CESARETİN VARSA BIRAK", 360, 92, "#ffffff");
        line("GÜÇLÜ OLAN KAZANIR", 500, 80, "#ffb020");
      } else {
        line("ZAFER", 150, 190, "#ffe14a");
        line(winner, 310, 130, "#ffffff");
        line(`${loser} ORDUSU RÖVANŞ İSTİYOR ⚔️`, 490, 92, "#ffb020");
      }
    }
    return canvasTexture(canvas);
  }, [layout.invite, layout.weWin, rival]);
  useEffect(() => () => scoreTex.dispose(), [scoreTex]);
  useEffect(() => () => bannerTex.dispose(), [bannerTex]);
  useFrame(({ clock }) => {
    const t = Math.max(0, clock.elapsedTime - REEL_HOLD);
    const pulse = 1 + Math.sin(t * 3.4) * 0.04;
    score.current?.scale.set(pulse, pulse, 1);
    const show = Math.max(0, Math.min(1, (t - karsiEndAt(layout.invite) - 0.9) / 0.5));
    const b = banner.current;
    if (b) {
      b.visible = show > 0;
      (b.material as THREE.MeshBasicMaterial).opacity = show;
      const pop = 0.86 + 0.14 * show;
      b.scale.set(pop, pop, 1);
    }
  });
  const w = size.width * 0.96;
  const h = w * (420 / 2048);
  const bh = w * (640 / 2048);
  return (
    <Hud renderPriority={3}>
      <OrthographicCamera makeDefault position={[0, 0, 10]} />
      <mesh ref={score} position={[0, size.height / 2 - h * 0.5 - 22, 4]} renderOrder={30}>
        <planeGeometry args={[w, h]} />
        <meshBasicMaterial map={scoreTex} transparent depthTest={false} toneMapped={false} />
      </mesh>
      <mesh ref={banner} position={[0, -size.height * 0.18, 4]} renderOrder={31} visible={false}>
        <planeGeometry args={[w, bh]} />
        <meshBasicMaterial map={bannerTex} transparent opacity={0} depthTest={false} toneMapped={false} />
      </mesh>
    </Hud>
  );
}

export function useKarsiLayout(soldiers: number, rival: Rival) {
  return useMemo(() => makeKarsiLayout(soldiers, rival.foes, Boolean(rival.invite)), [soldiers, rival.foes, rival.invite]);
}

export function KarsiCam({ soldiers, rival }: { soldiers: number; rival: Rival }) {
  const layout = useKarsiLayout(soldiers, rival);
  const perspCam = useRef<THREE.PerspectiveCamera | null>(null);
  useFrame(({ camera, clock }) => {
    if ((camera as THREE.PerspectiveCamera).isPerspectiveCamera) perspCam.current = camera as THREE.PerspectiveCamera;
    const persp = perspCam.current;
    if (!persp) return;
    const t = Math.max(0, clock.elapsedTime - REEL_HOLD);
    const shot = (rival.tps ? karsiTpsCam : karsiCam)(layout, t);
    persp.fov = shot.fov;
    persp.near = 0.35;
    persp.far = karsiFar(layout);
    persp.updateProjectionMatrix();
    persp.position.set(shot.x, shot.y, shot.z);
    persp.up.set(0, 1, 0);
    persp.lookAt(shot.lx, shot.ly, shot.lz);
  });
  return null;
}

function huntBody(layout: KarsiLayout, mine: boolean, t: number) {
  const side = mine ? layout.us : layout.them;
  if (side.n <= 0) {
    const chief = karsiChief(layout, mine, t, { x: 0, z: 0, yaw: 0, kneel: 0, lift: 0, chop: 0 });
    return { x: chief.x, z: chief.z };
  }
  let best = 0;
  let score = -1;
  for (let i = 0; i < side.n; i++) {
    const s = (side.row[i] <= 1 ? 8 : 0) + (Math.abs(side.x[i]) > 0.7 ? 3 : 0) + Math.min(side.die[i], 40) / 20;
    if (s <= score) continue;
    score = s;
    best = i;
  }
  const out: KarsiPose = { x: 0, z: 0, yaw: 0, fall: 0, lift: 0, chop: 0 };
  const body = mine ? karsiFriend(layout, best, t, out) : karsiFoe(layout, best, t, out);
  return { x: body.x, z: body.z };
}

/** Six gold flags sit in a shot. The seventh lies in the grass by our commander's heel. */
function huntSpots(layout: KarsiLayout) {
  const me = karsiChief(layout, true, 0, { x: 0, z: 0, yaw: 0, kneel: 0, lift: 0, chop: 0 });
  const foe0 = karsiChief(layout, false, 0, { x: 0, z: 0, yaw: 0, kneel: 0, lift: 0, chop: 0 });
  const foe = karsiChief(layout, false, 7.5, { x: 0, z: 0, yaw: 0, kneel: 0, lift: 0, chop: 0 });
  const us = huntBody(layout, true, 12.4);
  const them = huntBody(layout, false, 15.2);
  return [
    { x: me.x + 1.85, z: me.z + 2.5 },
    { x: me.x - 0.92, z: me.z - 1.25, hard: true },
    { x: -Math.max(6, layout.width * 0.22), z: me.z - 3.2 - layout.us.depth * 0.55 },
    { x: Math.max(6, layout.width * 0.24), z: foe0.z + 3.4 + layout.them.depth * 0.4 },
    { x: foe.x + 1.7, z: foe.z - 1.8 },
    { x: us.x - 1.15, z: us.z + 0.9 },
    { x: them.x + 1.15, z: them.z - 0.9 },
  ];
}

function PlantedFlag({ x, z, hard = false }: { x: number; z: number; hard?: boolean }) {
  const pole = hard ? 0.72 : 1.62;
  const flagW = hard ? 0.34 : 0.7;
  const flagH = hard ? 0.2 : 0.42;
  return (
    <group position={[x, hard ? 0.04 : 0.02, z]} rotation={hard ? [1.22, 0.55, 0.15] : [0, 0.5, 0]}>
      <mesh position={[0, pole / 2, 0]}>
        <boxGeometry args={[hard ? 0.035 : 0.055, pole, hard ? 0.035 : 0.055]} />
        <meshStandardMaterial color={hard ? "#6f8f48" : "#3a2a16"} roughness={0.86} />
      </mesh>
      <mesh position={[flagW * 0.48, pole - flagH * 0.45, 0]}>
        <boxGeometry args={[flagW, flagH, 0.025]} />
        <meshStandardMaterial
          color={hard ? "#7da85a" : "#ffe14a"}
          roughness={hard ? 0.96 : 0.42}
          metalness={hard ? 0 : 0.12}
          emissive={hard ? "#000000" : "#7a5a00"}
          emissiveIntensity={hard ? 0 : 0.35}
        />
      </mesh>
    </group>
  );
}

function drawHuntCard(canvas: HTMLCanvasElement, badge: boolean) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  if (badge) {
    ctx.fillStyle = "#ffd54f";
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, w * 0.42, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 16;
    ctx.strokeStyle = "#111111";
    ctx.stroke();
    ctx.font = "900 230px Inter, Montserrat, Helvetica, Arial, sans-serif";
    ctx.fillStyle = "#111111";
    ctx.fillText("7", w / 2, h / 2 + 8);
    return;
  }
  roundRect(ctx, 28, 24, w - 56, h - 48, 36);
  ctx.fillStyle = "#ffd54f";
  ctx.fill();
  ctx.lineWidth = 10;
  ctx.strokeStyle = "#111111";
  ctx.stroke();
  ctx.fillStyle = "#111111";
  ctx.font = "900 168px Inter, Montserrat, Helvetica, Arial, sans-serif";
  ctx.fillText("7 BAYRAK", w / 2, h * 0.4);
  ctx.font = "800 72px Inter, Montserrat, Helvetica, Arial, sans-serif";
  ctx.fillText("birini kaçırırsın", w / 2, h * 0.72);
}

function HuntCard() {
  const size = useThree((s) => s.size);
  const cardMat = useRef<THREE.MeshBasicMaterial>(null);
  const badgeMat = useRef<THREE.MeshBasicMaterial>(null);
  const cardTex = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 1080;
    canvas.height = 420;
    drawHuntCard(canvas, false);
    return canvasTexture(canvas);
  }, []);
  const badgeTex = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 360;
    canvas.height = 360;
    drawHuntCard(canvas, true);
    return canvasTexture(canvas);
  }, []);
  useEffect(() => () => {
    cardTex.dispose();
    badgeTex.dispose();
  }, [cardTex, badgeTex]);
  useFrame(({ clock }) => {
    const t = Math.max(0, clock.elapsedTime - REEL_HOLD);
    const card = t < 0.2 ? t / 0.2 : t < 2.55 ? 1 : Math.max(0, 1 - (t - 2.55) / 0.4);
    const badge = t < 2.7 ? 0 : Math.min(1, (t - 2.7) / 0.35);
    if (cardMat.current) cardMat.current.opacity = card;
    if (badgeMat.current) badgeMat.current.opacity = badge;
  });
  const w = size.width * 0.84;
  const h = w * (420 / 1080);
  const badgeW = size.width * 0.13;
  return (
    <Hud renderPriority={4}>
      <OrthographicCamera makeDefault position={[0, 0, 10]} />
      <mesh position={[0, size.height * 0.22, 5]} renderOrder={40}>
        <planeGeometry args={[w, h]} />
        <meshBasicMaterial ref={cardMat} map={cardTex} transparent opacity={0} depthTest={false} toneMapped={false} />
      </mesh>
      <mesh position={[-size.width / 2 + badgeW * 0.72, -size.height / 2 + badgeW * 0.72, 5]} renderOrder={41}>
        <planeGeometry args={[badgeW, badgeW]} />
        <meshBasicMaterial ref={badgeMat} map={badgeTex} transparent opacity={0} depthTest={false} toneMapped={false} />
      </mesh>
    </Hud>
  );
}

function KarsiHunt({ layout }: { layout: KarsiLayout }) {
  const spots = useMemo(() => huntSpots(layout), [layout]);
  return (
    <group>
      {spots.map((spot) => (
        <PlantedFlag key={`${spot.x.toFixed(2)}:${spot.z.toFixed(2)}`} x={spot.x} z={spot.z} hard={spot.hard} />
      ))}
      <HuntCard />
    </group>
  );
}

export function KarsiBattle({ names, soldiers, rival }: { names: string[]; soldiers: number; rival: Rival }) {
  const layout = useKarsiLayout(soldiers, rival);
  return (
    <group>
      <KarsiHud layout={layout} rival={rival.name} />
      <KarsiArmies layout={layout} />
      <KarsiNames names={names} layout={layout} tight={Boolean(rival.tps)} />
      {!!rival.foeNames?.length && <KarsiNames names={rival.foeNames} layout={layout} foe tight={Boolean(rival.tps)} />}
      <KarsiChiefUnit layout={layout} mine name={KARSI_ME} compact={Boolean(rival.tps)} />
      {!layout.invite && <KarsiChiefUnit layout={layout} mine={false} name={rival.name} compact={Boolean(rival.tps)} />}
      {rival.hunt && <KarsiHunt layout={layout} />}
    </group>
  );
}
