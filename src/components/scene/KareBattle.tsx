import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Hud, OrthographicCamera } from "@react-three/drei";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import * as THREE from "three";
import { preloadedGlb } from "../../arenaPreload";
import { buildNameAtlas } from "../../nameAtlas";
import { buildKnightSoldier } from "../../knightSoldier";
import { fitHero } from "./ArenaBattle";
import {
  KARE_HOOK,
  KARE_KNIGHT,
  KARE_OURS,
  KARE_ROMAN,
  KARE_ROMANS,
  kareCam,
  kareCard,
  kareFall,
  kareFriend,
  kareMarkReady,
  kareReset,
  kareRoman,
  kareRoster,
  kareShowNames,
  kareSpear,
  kareT,
  type KareSpear,
} from "../../kareReel";

type Gltf = Parameters<Parameters<GLTFLoader["load"]>[1]>[0];

function loadGlb(loader: GLTFLoader, url: string) {
  const buf = preloadedGlb(url);
  return new Promise<Gltf>((ok, fail) => {
    if (buf) loader.parse(buf.slice(0), "", ok, fail);
    else loader.load(url, ok, undefined, fail);
  });
}

function cutPlinth(root: THREE.Object3D) {
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    const geo = mesh.geometry;
    const pos = geo.getAttribute("position");
    if (!pos || pos.count < 12) return;
    if (!geo.getIndex()) geo.setIndex(Array.from({ length: pos.count }, (_, i) => i));
    const index = geo.getIndex();
    if (!index) return;
    let minY = Infinity;
    let maxY = -Infinity;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
    const h = maxY - minY;
    if (h < 1e-4) return;
    let xa = Infinity;
    let xb = -Infinity;
    let za = Infinity;
    let zb = -Infinity;
    for (let i = 0; i < pos.count; i++) {
      xa = Math.min(xa, pos.getX(i));
      xb = Math.max(xb, pos.getX(i));
      za = Math.min(za, pos.getZ(i));
      zb = Math.max(zb, pos.getZ(i));
    }
    if (xb - xa > h * 1.8 && zb - za > h * 1.8) {
      mesh.visible = false;
      return;
    }
    const cut = minY + h * 0.36;
    let low = 0;
    let x0 = Infinity;
    let x1 = -Infinity;
    let z0 = Infinity;
    let z1 = -Infinity;
    for (let i = 0; i < pos.count; i++) {
      if (pos.getY(i) > cut) continue;
      low += 1;
      x0 = Math.min(x0, pos.getX(i));
      x1 = Math.max(x1, pos.getX(i));
      z0 = Math.min(z0, pos.getZ(i));
      z1 = Math.max(z1, pos.getZ(i));
    }
    if (low < 12 || Math.max(x1 - x0, z1 - z0) < h * 0.22) return;
    const src = index.array;
    const kept: number[] = [];
    for (let i = 0; i < src.length; i += 3) {
      const a = src[i];
      const b = src[i + 1];
      const c = src[i + 2];
      if (Math.max(pos.getY(a), pos.getY(b), pos.getY(c)) <= cut) continue;
      kept.push(a, b, c);
    }
    if (kept.length === src.length) return;
    if (kept.length === 0) {
      mesh.visible = false;
      return;
    }
    geo.setIndex(kept);
    geo.computeVertexNormals();
    geo.computeBoundingBox();
    geo.computeBoundingSphere();
  });
}

function seatFeet(root: THREE.Object3D) {
  root.updateMatrixWorld(true);
  const box = new THREE.Box3();
  let hit = false;
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh || !mesh.visible) return;
    const next = new THREE.Box3().setFromObject(mesh);
    if (next.isEmpty()) return;
    if (!hit) {
      box.copy(next);
      hit = true;
    } else box.union(next);
  });
  if (hit && Number.isFinite(box.min.y)) root.position.y -= box.min.y;
}

function bakeRoman(root: THREE.Object3D) {
  root.updateMatrixWorld(true);
  const parts: THREE.BufferGeometry[] = [];
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh || !mesh.visible) return;
    const src = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
    src.applyMatrix4(mesh.matrixWorld);
    const pos = src.getAttribute("position");
    if (!pos) return;
    const mat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
    const color = (mat as THREE.MeshStandardMaterial).color ?? new THREE.Color("#b08968");
    const col = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      col[i * 3] = color.r;
      col[i * 3 + 1] = color.g;
      col[i * 3 + 2] = color.b;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", pos);
    geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
    parts.push(geo);
  });
  const merged = mergeGeometries(parts, false);
  merged?.computeVertexNormals();
  return merged;
}

function paintCard(lines: readonly string[]) {
  const canvas = document.createElement("canvas");
  canvas.width = 980;
  canvas.height = 280;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  ctx.beginPath();
  ctx.moveTo(60, 22);
  ctx.arcTo(952, 22, 952, 258, 32);
  ctx.arcTo(952, 258, 28, 258, 32);
  ctx.arcTo(28, 258, 28, 22, 32);
  ctx.arcTo(28, 22, 952, 22, 32);
  ctx.closePath();
  ctx.fillStyle = "#ffd54f";
  ctx.fill();
  ctx.lineWidth = 12;
  ctx.strokeStyle = "#111111";
  ctx.stroke();
  ctx.fillStyle = "#111111";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "900 84px Montserrat, Helvetica, Arial, sans-serif";
  lines.forEach((line, i) => ctx.fillText(line, 490, 104 + i * 94));
  return canvas;
}

function KareHud() {
  const size = useThree((s) => s.size);
  const mesh = useRef<THREE.Mesh>(null);
  const map = useMemo(() => {
    const tex = new THREE.CanvasTexture(paintCard(KARE_HOOK));
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.generateMipmaps = false;
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    return tex;
  }, []);
  useEffect(() => {
    document.fonts?.load("900 80px Montserrat").then(() => {
      map.image = paintCard(KARE_HOOK);
      map.needsUpdate = true;
    }).catch(() => undefined);
    return () => map.dispose();
  }, [map]);
  useFrame(() => {
    const card = kareCard(kareT());
    if (!mesh.current) return;
    mesh.current.visible = Boolean(card && card.opacity > 0.02);
    const mat = mesh.current.material as THREE.MeshBasicMaterial;
    mat.opacity = card?.opacity ?? 0;
  });
  const w = size.width * 0.5;
  return (
    <Hud renderPriority={1}>
      <OrthographicCamera makeDefault position={[0, 0, 10]} />
      <mesh ref={mesh} position={[0, size.height * 0.28, 0]}>
        <planeGeometry args={[w, w * (280 / 980)]} />
        <meshBasicMaterial map={map} transparent depthTest={false} toneMapped={false} />
      </mesh>
    </Hud>
  );
}

const dummy = new THREE.Object3D();
const spearTmp: KareSpear = { x: 0, y: 0, z: 0, dx: 0, dy: 0, dz: 0 };
const up = new THREE.Vector3(0, 1, 0);
const dir = new THREE.Vector3();
const liveTint = new THREE.Color("#ffffff");
const deadTint = new THREE.Color("#243056");

function spearGeo() {
  const shaft = new THREE.CylinderGeometry(0.055, 0.04, 3.4, 5);
  shaft.translate(0, 0.2, 0);
  const head = new THREE.ConeGeometry(0.12, 0.42, 5);
  head.translate(0, 2.05, 0);
  return mergeGeometries([shaft, head]) ?? shaft;
}

export function KareBattle({ names }: { names: string[] }) {
  const [pack, setPack] = useState<{ body: THREE.BufferGeometry; helm: THREE.BufferGeometry; roman: THREE.BufferGeometry } | null>(null);
  const roster = useMemo(() => kareRoster(names), [names]);
  const bodies = useRef<THREE.InstancedMesh>(null);
  const helms = useRef<THREE.InstancedMesh>(null);
  const romans = useRef<THREE.InstancedMesh>(null);
  const spears = useRef<THREE.InstancedMesh>(null);
  const spearMesh = useMemo(() => spearGeo(), []);
  const named = useMemo(
    () => roster.map((name, i) => ({ name, i })).filter((row) => row.name),
    [roster],
  );
  const atlas = useMemo(
    () =>
      buildNameAtlas(
        named.map((row) => ({ text: row.name, commander: false, plain: false, fill: "#ffe14a", frame: true })),
        true,
        true,
      ),
    [named],
  );

  useEffect(() => {
    let drop = false;
    kareReset();
    const loader = new GLTFLoader();
    void (async () => {
      try {
        const knightGltf = await loadGlb(loader, KARE_KNIGHT);
        const romanGltf = await loadGlb(loader, KARE_ROMAN);
        if (drop) return;
        const knight = buildKnightSoldier(knightGltf.scene);
        fitHero(romanGltf.scene, -Math.PI / 2, true, false);
        cutPlinth(romanGltf.scene);
        seatFeet(romanGltf.scene);
        const roman = bakeRoman(romanGltf.scene);
        if (drop || !roman) return;
        setPack({ body: knight.body, helm: knight.helm, roman });
      } catch (err) {
        console.warn("kare", err);
      } finally {
        if (!drop) kareMarkReady();
      }
    })();
    return () => {
      drop = true;
      kareReset();
    };
  }, []);

  useEffect(() => {
    for (const sheet of atlas.sheets) sheet.material.depthTest = false;
    return () => atlas.dispose();
  }, [atlas]);

  useFrame(({ camera }) => {
    if (!pack) return;
    const t = kareT();
    const body = bodies.current;
    const helm = helms.current;
    if (body && helm) {
      for (let i = 0; i < KARE_OURS; i++) {
        const seat = kareFriend(i);
        const fall = kareFall(i, t);
        dummy.position.set(seat.x, fall * 0.02, seat.z);
        dummy.rotation.set(fall * 1.35, seat.yaw, fall * 0.12);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        body.setMatrixAt(i, dummy.matrix);
        helm.setMatrixAt(i, dummy.matrix);
        const tint = fall > 0.35 ? deadTint : liveTint;
        body.setColorAt(i, tint);
        helm.setColorAt(i, tint);
      }
      body.instanceMatrix.needsUpdate = true;
      helm.instanceMatrix.needsUpdate = true;
      if (body.instanceColor) body.instanceColor.needsUpdate = true;
      if (helm.instanceColor) helm.instanceColor.needsUpdate = true;
    }
    const wall = romans.current;
    if (wall) {
      for (let i = 0; i < KARE_ROMANS; i++) {
        const seat = kareRoman(i, t);
        dummy.position.set(seat.x, 0, seat.z);
        dummy.rotation.set(0, seat.yaw, 0);
        dummy.scale.set(1.2, 1.2, 1.2);
        dummy.updateMatrix();
        wall.setMatrixAt(i, dummy.matrix);
      }
      wall.instanceMatrix.needsUpdate = true;
    }
    const volley = spears.current;
    if (volley) {
      let n = 0;
      for (let i = 0; i < KARE_OURS; i++) {
        if (n >= 12) break;
        if (!kareSpear(i, t, spearTmp)) continue;
        dir.set(spearTmp.dx, spearTmp.dy, spearTmp.dz);
        if (dir.lengthSq() < 1e-8) continue;
        dummy.position.set(spearTmp.x, spearTmp.y, spearTmp.z);
        dummy.quaternion.setFromUnitVectors(up, dir.normalize());
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        volley.setMatrixAt(n, dummy.matrix);
        n += 1;
      }
      volley.count = n;
      volley.instanceMatrix.needsUpdate = true;
    }
    const show = kareShowNames(t);
    for (const sheet of atlas.sheets) {
      const inst = sheet.geometry.userData.mesh as THREE.InstancedMesh | undefined;
      if (!inst) continue;
      for (let n = 0; n < named.length; n++) {
        const cell = atlas.cells[n];
        if (!cell || cell.sheet !== atlas.sheets.indexOf(sheet)) continue;
        const seat = kareFriend(named[n].i);
        const hide = !show || kareFall(named[n].i, t) > 0.3;
        const w = Math.min(cell.sx, 1.28);
        const h = (cell.sy * w) / Math.max(cell.sx, 0.01);
        dummy.position.set(seat.x, hide ? -8 : 1.78 + (named[n].i % 4) * 0.38, seat.z);
        dummy.quaternion.copy(camera.quaternion);
        dummy.scale.set(hide ? 0.001 : w, hide ? 0.001 : h, 1);
        dummy.updateMatrix();
        inst.setMatrixAt(cell.local, dummy.matrix);
      }
      inst.instanceMatrix.needsUpdate = true;
    }
  });

  if (!pack) return null;

  return (
    <group>
      <hemisphereLight args={["#c5d4e4", "#6a6248", 1.25]} />
      <directionalLight position={[-14, 22, 10]} intensity={1.05} color="#fff2dd" />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <planeGeometry args={[140, 140]} />
        <meshLambertMaterial color="#6d7a58" />
      </mesh>
      <instancedMesh ref={bodies} args={[pack.body, undefined, KARE_OURS]} frustumCulled={false}>
        <meshLambertMaterial color="#1a56e8" />
      </instancedMesh>
      <instancedMesh ref={helms} args={[pack.helm, undefined, KARE_OURS]} frustumCulled={false}>
        <meshLambertMaterial color="#e7eef5" />
      </instancedMesh>
      <instancedMesh ref={romans} args={[pack.roman, undefined, KARE_ROMANS]} frustumCulled={false}>
        <meshLambertMaterial vertexColors />
      </instancedMesh>
      <instancedMesh ref={spears} args={[spearMesh, undefined, 12]} frustumCulled={false} count={0}>
        <meshBasicMaterial color="#f3e6c8" />
      </instancedMesh>
      {atlas.sheets.map((sheet, s) => (
        <instancedMesh
          key={s}
          args={[sheet.geometry, sheet.material, Math.max(1, sheet.count)]}
          frustumCulled={false}
          ref={(node) => {
            sheet.geometry.userData.mesh = node;
          }}
        />
      ))}
      <KareHud />
    </group>
  );
}

export function KareCam() {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  useFrame(() => {
    const shot = kareCam(kareT());
    camera.position.set(shot.x, shot.y, shot.z);
    camera.lookAt(shot.lx, shot.ly, shot.lz);
    if (camera.fov !== shot.fov) {
      camera.fov = shot.fov;
      camera.updateProjectionMatrix();
    }
  });
  return null;
}
