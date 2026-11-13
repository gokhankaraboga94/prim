import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
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
  D1311_FOES,
  D1311_FRIENDS,
  D1311_KNIGHT,
  D1311_ROMAN,
  d1311Cam,
  d1311Card,
  d1311Foe,
  d1311Friend,
  d1311MarkReady,
  d1311Reset,
  d1311Roster,
  d1311ShowNames,
  d1311T,
} from "../../d1311Reel";

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
    const src = index.array;
    const kept: number[] = [];
    for (let i = 0; i < src.length; i += 3) {
      const a = src[i];
      const b = src[i + 1];
      const c = src[i + 2];
      if (Math.max(pos.getY(a), pos.getY(b), pos.getY(c)) <= cut) continue;
      kept.push(a, b, c);
    }
    if (!kept.length || kept.length === src.length) {
      if (!kept.length) mesh.visible = false;
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
  const box = new THREE.Box3().setFromObject(root);
  if (Number.isFinite(box.min.y)) root.position.y -= box.min.y;
}

/** Solid red army — ignore source textures so the wall always reads on phone. */
function bakeRedRoman(root: THREE.Object3D) {
  root.updateMatrixWorld(true);
  const parts: THREE.BufferGeometry[] = [];
  const red = new THREE.Color("#d41818");
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh || !mesh.visible) return;
    const src = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
    src.applyMatrix4(mesh.matrixWorld);
    const pos = src.getAttribute("position");
    if (!pos) return;
    const col = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      col[i * 3] = red.r;
      col[i * 3 + 1] = red.g;
      col[i * 3 + 2] = red.b;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", pos.clone());
    const norm = src.getAttribute("normal");
    if (norm) geo.setAttribute("normal", norm.clone());
    geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
    if (!norm) geo.computeVertexNormals();
    parts.push(geo);
    if (src !== mesh.geometry) src.dispose();
  });
  const merged = mergeGeometries(parts, false);
  for (const part of parts) part.dispose();
  merged?.computeVertexNormals();
  if (merged) {
    const box = new THREE.Box3().setFromBufferAttribute(merged.getAttribute("position") as THREE.BufferAttribute);
    const h = Math.max(0.001, box.max.y - box.min.y);
    const s = 1.66 / h;
    const cx = (box.min.x + box.max.x) / 2;
    const cz = (box.min.z + box.max.z) / 2;
    merged.applyMatrix4(new THREE.Matrix4().makeScale(s, s, s).multiply(new THREE.Matrix4().makeTranslation(-cx, -box.min.y, -cz)));
    merged.computeVertexNormals();
  }
  return merged;
}

const dummy = new THREE.Object3D();
const liveX = new Float32Array(D1311_FRIENDS);
const liveZ = new Float32Array(D1311_FRIENDS);

function paintCard(lines: readonly string[], accent: boolean) {
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 420;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  ctx.clearRect(0, 0, 1080, 420);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  const big = accent && lines.length <= 2;
  lines.forEach((line, i) => {
    const font = big && i === 0 ? 118 : lines.length > 2 ? 54 : 78;
    ctx.font = `900 ${font}px Montserrat, Helvetica, Arial, sans-serif`;
    const y = 210 + (i - (lines.length - 1) / 2) * (big ? 110 : lines.length > 2 ? 72 : 92);
    ctx.lineWidth = Math.max(14, font * 0.16);
    ctx.strokeStyle = "#000000";
    ctx.strokeText(line, 540, y);
    ctx.fillStyle = accent && i === 0 ? "#ff2a1a" : "#ffffff";
    ctx.fillText(line, 540, y);
  });
  return canvas;
}

function D1311Hud({ day }: { day: number }) {
  const size = useThree((s) => s.size);
  const mesh = useRef<THREE.Mesh>(null);
  const map = useMemo(() => {
    const tex = new THREE.CanvasTexture(paintCard([" "], false));
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.generateMipmaps = false;
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    return tex;
  }, []);
  const lastKey = useRef("");
  useEffect(() => () => map.dispose(), [map]);
  useFrame(() => {
    const card = d1311Card(d1311T(), day);
    if (!mesh.current) return;
    const mat = mesh.current.material as THREE.MeshBasicMaterial;
    if (!card || card.opacity < 0.02) {
      mesh.current.visible = false;
      mat.opacity = 0;
      return;
    }
    const key = `${card.lines.join("|")}|${card.accent ? 1 : 0}`;
    if (key !== lastKey.current) {
      lastKey.current = key;
      map.image = paintCard(card.lines, Boolean(card.accent));
      map.needsUpdate = true;
    }
    mesh.current.visible = true;
    mat.opacity = card.opacity;
  });
  const w = size.width * 0.88;
  return (
    <Hud renderPriority={2}>
      <OrthographicCamera makeDefault position={[0, 0, 10]} />
      <mesh ref={mesh} position={[0, size.height * 0.28, 0]} visible={false}>
        <planeGeometry args={[w, w * (420 / 1080)]} />
        <meshBasicMaterial map={map} transparent depthTest={false} toneMapped={false} opacity={0} />
      </mesh>
    </Hud>
  );
}

function GateProp() {
  return (
    <group position={[0, 0, 22]}>
      <mesh position={[0, 2.2, 0]}>
        <boxGeometry args={[18, 4.4, 2.4]} />
        <meshBasicMaterial color="#5a3a22" />
      </mesh>
      <mesh position={[-7.2, 4.6, 0]}>
        <boxGeometry args={[3.2, 3.2, 3.2]} />
        <meshBasicMaterial color="#4a301c" />
      </mesh>
      <mesh position={[7.2, 4.6, 0]}>
        <boxGeometry args={[3.2, 3.2, 3.2]} />
        <meshBasicMaterial color="#4a301c" />
      </mesh>
      <mesh position={[0, 5.4, -0.2]}>
        <boxGeometry args={[4.6, 1.6, 2]} />
        <meshBasicMaterial color="#6b4228" />
      </mesh>
    </group>
  );
}

function applyUnits(
  t: number,
  bodies: THREE.InstancedMesh | null,
  helms: THREE.InstancedMesh | null,
  wall: THREE.InstancedMesh | null,
) {
  if (bodies && helms) {
    for (let i = 0; i < D1311_FRIENDS; i++) {
      const seat = d1311Friend(i, t);
      liveX[i] = seat.x;
      liveZ[i] = seat.z;
      dummy.position.set(seat.x, 0.02, seat.z);
      dummy.rotation.set(0, seat.yaw, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      bodies.setMatrixAt(i, dummy.matrix);
      helms.setMatrixAt(i, dummy.matrix);
    }
    bodies.instanceMatrix.needsUpdate = true;
    helms.instanceMatrix.needsUpdate = true;
  }
  if (wall) {
    for (let i = 0; i < D1311_FOES; i++) {
      const seat = d1311Foe(i, t);
      dummy.position.set(seat.x, 0, seat.z);
      dummy.rotation.set(0, seat.yaw, 0);
      dummy.scale.setScalar(seat.show ? 1.2 : 0.001);
      dummy.updateMatrix();
      wall.setMatrixAt(i, dummy.matrix);
    }
    wall.instanceMatrix.needsUpdate = true;
  }
}

export function D1311Battle({ names, day = 21 }: { names: string[]; day?: number }) {
  const [pack, setPack] = useState<{ body: THREE.BufferGeometry; helm: THREE.BufferGeometry; roman: THREE.BufferGeometry } | null>(null);
  const roster = useMemo(() => d1311Roster(names), [names]);
  const bodies = useRef<THREE.InstancedMesh>(null);
  const helms = useRef<THREE.InstancedMesh>(null);
  const romans = useRef<THREE.InstancedMesh>(null);
  const named = useMemo(
    () => roster.map((name, i) => ({ name, i })).filter((row) => row.name),
    [roster],
  );
  const atlas = useMemo(
    () =>
      buildNameAtlas(
        named.map((row) => ({ text: row.name, commander: false, plain: false, fill: "#ffffff", frame: true })),
        true,
        true,
      ),
    [named],
  );

  useEffect(() => {
    let drop = false;
    d1311Reset();
    const loader = new GLTFLoader();
    void (async () => {
      try {
        const knightGltf = await loadGlb(loader, D1311_KNIGHT);
        const romanGltf = await loadGlb(loader, D1311_ROMAN);
        if (drop) return;
        const knight = buildKnightSoldier(knightGltf.scene);
        fitHero(romanGltf.scene, -Math.PI / 2, true, false);
        cutPlinth(romanGltf.scene);
        seatFeet(romanGltf.scene);
        const roman = bakeRedRoman(romanGltf.scene);
        if (drop || !roman) {
          console.warn("13112026 roman bake failed");
          return;
        }
        setPack({ body: knight.body, helm: knight.helm, roman });
      } catch (err) {
        console.warn("13112026", err);
      } finally {
        if (!drop) d1311MarkReady();
      }
    })();
    return () => {
      drop = true;
      d1311Reset();
    };
  }, []);

  useEffect(() => {
    for (const sheet of atlas.sheets) sheet.material.depthTest = false;
    return () => atlas.dispose();
  }, [atlas]);

  useLayoutEffect(() => {
    if (!pack) return;
    applyUnits(d1311T(), bodies.current, helms.current, romans.current);
  }, [pack]);

  useFrame(({ camera }) => {
    if (!pack) return;
    const t = d1311T();
    applyUnits(t, bodies.current, helms.current, romans.current);
    const show = d1311ShowNames(t);
    for (const sheet of atlas.sheets) {
      const inst = sheet.geometry.userData.mesh as THREE.InstancedMesh | undefined;
      if (!inst) continue;
      const sheetIndex = atlas.sheets.indexOf(sheet);
      for (let n = 0; n < named.length; n++) {
        const cell = atlas.cells[n];
        if (!cell || cell.sheet !== sheetIndex) continue;
        const hide = !show;
        const w = Math.min(cell.sx, 1.15);
        const h = (cell.sy * w) / Math.max(cell.sx, 0.01);
        dummy.position.set(liveX[named[n].i], hide ? -8 : 1.72 + (named[n].i % 3) * 0.28, liveZ[named[n].i]);
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
      <ambientLight intensity={1.35} />
      <hemisphereLight args={["#e8f4ff", "#5a7a3a", 1.1]} />
      <directionalLight position={[-12, 30, 10]} intensity={1.35} color="#fff6e0" />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 2]} receiveShadow={false}>
        <planeGeometry args={[180, 180]} />
        <meshBasicMaterial color="#4fad3a" toneMapped={false} />
      </mesh>
      <GateProp />
      <instancedMesh ref={bodies} args={[pack.body, undefined, D1311_FRIENDS]} frustumCulled={false}>
        <meshLambertMaterial color="#111111" />
      </instancedMesh>
      <instancedMesh ref={helms} args={[pack.helm, undefined, D1311_FRIENDS]} frustumCulled={false}>
        <meshLambertMaterial color="#2a2a2a" />
      </instancedMesh>
      <instancedMesh ref={romans} args={[pack.roman, undefined, D1311_FOES]} frustumCulled={false}>
        <meshLambertMaterial vertexColors />
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
      <D1311Hud day={day} />
    </group>
  );
}

export function D1311Cam() {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  useFrame(() => {
    if (!camera.isPerspectiveCamera) return;
    const shot = d1311Cam(d1311T());
    camera.near = 0.4;
    camera.far = 500;
    camera.fov = shot.fov;
    camera.updateProjectionMatrix();
    camera.position.set(shot.x, shot.y, shot.z);
    camera.up.set(0, 1, 0);
    camera.lookAt(shot.lx, shot.ly, shot.lz);
  });
  return null;
}
