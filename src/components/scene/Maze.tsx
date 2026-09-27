import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { REEL_HOLD } from "../../recordCanvas";
import { LAB_FOES, LAB_SEGMENTS, labFoeAt } from "../../mazeReel";
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
  tex.repeat.set(8, 10);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

function wallBoxes() {
  const boxes: { x: number; y: number; z: number; w: number; h: number; d: number; ry: number }[] = [];
  for (const seg of LAB_SEGMENTS) {
    const dx = seg.x2 - seg.x1;
    const dz = seg.z2 - seg.z1;
    const len = Math.hypot(dx, dz) || 1;
    const ry = Math.atan2(dx, dz);
    const px = Math.cos(ry);
    const pz = -Math.sin(ry);
    const mx = (seg.x1 + seg.x2) / 2;
    const mz = (seg.z1 + seg.z2) / 2;
    const span = len + seg.half * 1.6;
    const h = 2.7;
    const thick = 1.15;
    for (const side of [-1, 1]) {
      boxes.push({
        x: mx + px * (seg.half + thick * 0.35) * side,
        y: h / 2,
        z: mz + pz * (seg.half + thick * 0.35) * side,
        w: thick,
        h,
        d: span,
        ry,
      });
    }
  }
  return boxes;
}

function Foes({ soldiers }: { soldiers: number }) {
  const bodies = useRef<THREE.InstancedMesh>(null);
  const geo = useMemo(() => getSwordRaiderGeometry(), []);
  useFrame(({ clock }) => {
    if (!bodies.current) return;
    const recT = clock.elapsedTime - REEL_HOLD;
    for (let i = 0; i < LAB_FOES; i++) {
      labFoeAt(i, recT, soldiers, scratch);
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

export function Maze({ soldiers }: { soldiers: number }) {
  const boxes = useMemo(() => wallBoxes(), []);
  const stone = useMemo(() => stoneTexture(), []);
  const dirt = useMemo(() => dirtTexture(), []);
  const stoneMat = useMemo(
    () => new THREE.MeshStandardMaterial({ map: stone ?? undefined, color: stone ? "#ffffff" : "#8d8172", roughness: 0.86, metalness: 0.05 }),
    [stone]
  );
  const capMat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#d9cbb8", roughness: 0.78 }), []);
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[2, -0.04, 34]}>
        <planeGeometry args={[120, 140]} />
        <meshStandardMaterial map={dirt ?? undefined} color={dirt ? "#ffffff" : "#6d5b3e"} roughness={0.94} />
      </mesh>
      {boxes.map((box, i) => (
        <group key={i} position={[box.x, box.y, box.z]} rotation={[0, box.ry, 0]}>
          <mesh material={stoneMat}>
            <boxGeometry args={[box.w, box.h, box.d]} />
          </mesh>
          <mesh position={[0, box.h / 2 + 0.08, 0]} material={capMat}>
            <boxGeometry args={[box.w + 0.18, 0.16, box.d]} />
          </mesh>
        </group>
      ))}
      <ambientLight intensity={0.7} color="#fff6ea" />
      <directionalLight position={[30, 52, 16]} intensity={1.7} color="#fff8ee" />
      <hemisphereLight args={["#fff4e2", "#6a5c4c", 0.75]} />
      <Foes soldiers={soldiers} />
    </group>
  );
}
