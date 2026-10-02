import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { REEL_HOLD } from "../../recordCanvas";
import { LAB_FOES, LAB_WALLS, labFoeAt, type LabWall } from "../../mazeReel";
import type { New1Pose } from "../../new1Reel";
import { getSwordRaiderGeometry } from "./SallyRaid";

const dummy = new THREE.Object3D();
const scratch: New1Pose = { x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0, s: 1 };

function stoneTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.fillStyle = "#8d8172";
  ctx.fillRect(0, 0, 1024, 1024);
  const cols = 8;
  const rows = 14;
  const bw = 1024 / cols;
  const bh = 1024 / rows;
  for (let y = 0; y < rows; y++) {
    const shift = y % 2 === 0 ? 0 : bw * 0.5;
    for (let x = -1; x < cols + 1; x++) {
      const tone = 118 + ((x + y * 3) % 5) * 10;
      ctx.fillStyle = `rgb(${tone - 8}, ${tone - 16}, ${tone - 28})`;
      ctx.fillRect(x * bw + shift + 3, y * bh + 3, bw - 7, bh - 7);
      ctx.fillStyle = "rgba(255,244,230,0.08)";
      ctx.fillRect(x * bw + shift + 6, y * bh + 6, bw * 0.35, 4);
    }
  }
  ctx.strokeStyle = "rgba(62, 52, 42, 0.55)";
  ctx.lineWidth = 5;
  for (let y = 0; y <= rows; y++) {
    ctx.beginPath();
    ctx.moveTo(0, y * bh);
    ctx.lineTo(1024, y * bh);
    ctx.stroke();
  }
  for (let i = 0; i < 80; i++) {
    ctx.strokeStyle = `rgba(48, 40, 32, ${0.15 + Math.random() * 0.25})`;
    ctx.lineWidth = 1 + Math.random() * 2;
    ctx.beginPath();
    ctx.moveTo(Math.random() * 1024, Math.random() * 1024);
    ctx.lineTo(Math.random() * 1024, Math.random() * 1024);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

function dirtTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.fillStyle = "#6d5b3e";
  ctx.fillRect(0, 0, 1024, 1024);
  for (let i = 0; i < 18000; i++) {
    const n = i % 6;
    ctx.fillStyle = n === 0 ? "#8a734c" : n === 1 ? "#4e422c" : n === 2 ? "#7a643e" : n === 3 ? "#5a4a32" : n === 4 ? "#3e3424" : "#9a8458";
    ctx.fillRect(Math.random() * 1024, Math.random() * 1024, 1 + Math.random() * 5, 1 + Math.random() * 4);
  }
  for (let i = 0; i < 70; i++) {
    ctx.fillStyle = `rgba(40, 30, 18, ${0.12 + Math.random() * 0.2})`;
    ctx.beginPath();
    ctx.ellipse(Math.random() * 1024, Math.random() * 1024, 20 + Math.random() * 70, 10 + Math.random() * 28, Math.random() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(22, 24);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

function Foes() {
  const bodies = useRef<THREE.InstancedMesh>(null);
  const geo = useMemo(() => getSwordRaiderGeometry(), []);
  useFrame(({ clock }) => {
    if (!bodies.current) return;
    const recT = clock.elapsedTime - REEL_HOLD;
    for (let i = 0; i < LAB_FOES; i++) {
      labFoeAt(i, recT, scratch);
      dummy.position.set(scratch.x, scratch.y, scratch.z);
      dummy.rotation.set(scratch.rx, scratch.ry, scratch.rz);
      dummy.scale.setScalar((scratch.s ?? 1) > 0 ? 1.15 : 0);
      dummy.updateMatrix();
      bodies.current.setMatrixAt(i, dummy.matrix);
    }
    bodies.current.count = LAB_FOES;
    bodies.current.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={bodies} args={[geo, undefined, LAB_FOES]} frustumCulled={false}>
      <meshStandardMaterial vertexColors roughness={0.5} metalness={0.12} />
    </instancedMesh>
  );
}

function tileUv(geo: THREE.BufferGeometry, sx: number, sy: number) {
  const uv = geo.getAttribute("uv");
  const s = 0.38;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * sx * s, uv.getY(i) * sy * s);
}

function mazeStone(boxes: LabWall[]) {
  const stone: THREE.BufferGeometry[] = [];
  const caps: THREE.BufferGeometry[] = [];
  for (const box of boxes) {
    const body = new THREE.BoxGeometry(box.w, box.h, box.d);
    tileUv(body, Math.max(box.w, box.d), box.h);
    body.translate(box.x, box.y, box.z);
    stone.push(body);
    const lip = new THREE.BoxGeometry(box.w + 0.22, 0.22, box.d + 0.22);
    lip.translate(box.x, box.y + box.h / 2 + 0.1, box.z);
    caps.push(lip);
    const alongX = box.w >= box.d;
    const span = alongX ? box.w : box.d;
    const n = Math.max(2, Math.floor(span / 1.15));
    for (let i = 0; i < n; i += 2) {
      const u = (i + 0.5) / n - 0.5;
      const mw = alongX ? Math.min(0.64, span / n) : Math.max(0.42, box.w * 0.78);
      const md = alongX ? Math.max(0.42, box.d * 0.78) : Math.min(0.64, span / n);
      const merlon = new THREE.BoxGeometry(mw, 0.78, md);
      merlon.translate(box.x + (alongX ? u * box.w : 0), box.y + box.h / 2 + 0.5, box.z + (alongX ? 0 : u * box.d));
      caps.push(merlon);
    }
  }
  return {
    stone: mergeGeometries(stone, false) ?? new THREE.BoxGeometry(1, 1, 1),
    caps: mergeGeometries(caps, false) ?? new THREE.BoxGeometry(1, 1, 1),
  };
}

export function Maze({ soldiers: _soldiers }: { soldiers: number }) {
  const boxes = useMemo(() => LAB_WALLS, []);
  const geos = useMemo(() => mazeStone(boxes), [boxes]);
  const stone = useMemo(() => stoneTexture(), []);
  const dirt = useMemo(() => dirtTexture(), []);
  const stoneMat = useMemo(
    () => new THREE.MeshStandardMaterial({ map: stone ?? undefined, color: stone ? "#ffffff" : "#8d8172", roughness: 0.9, metalness: 0.04 }),
    [stone]
  );
  const capMat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#cbbba6", roughness: 0.82 }), []);
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.04, 90]}>
        <planeGeometry args={[360, 420]} />
        <meshStandardMaterial map={dirt ?? undefined} color={dirt ? "#ffffff" : "#6d5b3e"} roughness={0.94} />
      </mesh>
      <mesh geometry={geos.stone} material={stoneMat} />
      <mesh geometry={geos.caps} material={capMat} />
      <ambientLight intensity={0.46} color="#f3eadc" />
      <directionalLight position={[36, 28, -18]} intensity={2.35} color="#fff1dc" />
      <directionalLight position={[-22, 14, 40]} intensity={0.45} color="#c4b49a" />
      <hemisphereLight args={["#fff4e2", "#5c4e3e", 0.55]} />
      <Foes />
    </group>
  );
}
