import { useEffect, useMemo, useRef } from "react";
import { Hud, OrthographicCamera } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { formatCount } from "../../game";
import { REEL_HOLD } from "../../recordCanvas";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { devAlive, devClubHit, devGiantAt, devMaceSwing, devSnakeBite, devSwordPose, devTailLash, devTroopHit, devTroopSlot, devWaitArrow, TROOP_N, TROOP_SCALE } from "../../devReel";

const dummy = new THREE.Object3D();
const ARROWS = 18;

function DreadShell({ plate, iron, eye, horn }: { plate: THREE.Material; iron: THREE.Material; eye: THREE.Material; horn: THREE.Material }) {
  return (
    <group>
      <mesh position={[-1.05, 2.4, 0.15]} rotation={[0.1, 0, 0.1]} material={plate}>
        <cylinderGeometry args={[0.78, 1.05, 4.2, 6]} />
      </mesh>
      <mesh position={[1.15, 2.4, 0.05]} rotation={[0.08, 0, -0.12]} material={plate}>
        <cylinderGeometry args={[0.82, 1.08, 4.3, 6]} />
      </mesh>
      <mesh position={[-1.2, 0.42, 0.55]} rotation={[0.2, 0.1, 0]} material={iron}>
        <boxGeometry args={[1.25, 0.5, 1.9]} />
      </mesh>
      <mesh position={[1.3, 0.38, 0.42]} rotation={[0.15, -0.15, 0]} material={iron}>
        <boxGeometry args={[1.35, 0.54, 2.05]} />
      </mesh>
      {[-0.35, 0.05, 0.42].map((x) => (
        <mesh key={`l${x}`} position={[-1.15 + x, 0.22, 1.35]} rotation={[1.15, 0, 0.2]} material={horn}>
          <coneGeometry args={[0.1, 0.55, 4]} />
        </mesh>
      ))}
      {[-0.28, 0.12, 0.48].map((x) => (
        <mesh key={`r${x}`} position={[1.2 + x, 0.2, 1.28]} rotation={[1.15, 0, -0.15]} material={horn}>
          <coneGeometry args={[0.11, 0.62, 4]} />
        </mesh>
      ))}
      <mesh position={[0, 5.7, 0.1]} material={plate}>
        <boxGeometry args={[3.6, 1.7, 2.15]} />
      </mesh>
      <mesh position={[0.1, 8.35, 0.42]} rotation={[0.22, 0, 0]} material={plate}>
        <boxGeometry args={[4.7, 4.15, 2.7]} />
      </mesh>
      <mesh position={[-0.2, 9.05, 1.35]} rotation={[0.38, 0.04, 0.06]} material={iron}>
        <boxGeometry args={[3.3, 2.5, 0.38]} />
      </mesh>
      <mesh position={[1.15, 7.7, 1.25]} rotation={[0.45, -0.15, -0.1]} material={iron}>
        <boxGeometry args={[1.7, 1.45, 0.32]} />
      </mesh>
      <mesh position={[-1.7, 8.6, 0.2]} rotation={[0, 0, 0.35]} material={plate}>
        <boxGeometry args={[1.1, 2.2, 1.3]} />
      </mesh>
      <mesh position={[1.85, 8.55, 0.15]} rotation={[0, 0, -0.32]} material={plate}>
        <boxGeometry args={[1.15, 2.3, 1.35]} />
      </mesh>
      <mesh position={[0, 10.7, -0.05]} material={iron}>
        <boxGeometry args={[5.8, 1.05, 2.05]} />
      </mesh>
      <mesh position={[-2.55, 11.05, 0.15]} rotation={[0.12, 0, 0.28]} material={plate}>
        <boxGeometry args={[2.05, 1.05, 2.25]} />
      </mesh>
      <mesh position={[2.7, 11.15, 0.05]} rotation={[-0.08, 0, -0.26]} material={plate}>
        <boxGeometry args={[2.25, 1.15, 2.4]} />
      </mesh>
      <mesh position={[-3.15, 11.55, 0.15]} rotation={[0.2, 0, 0.7]} material={horn}>
        <coneGeometry args={[0.22, 1.25, 4]} />
      </mesh>
      <mesh position={[3.35, 11.85, 0.2]} rotation={[0.35, 0.2, -0.85]} material={horn}>
        <coneGeometry args={[0.26, 1.55, 4]} />
      </mesh>
      <mesh position={[2.7, 11.15, 0.85]} rotation={[0.8, 0, -0.2]} material={horn}>
        <coneGeometry args={[0.14, 0.7, 4]} />
      </mesh>
      {[-0.55, 0.05, 0.65, 1.25].map((y, i) => (
        <mesh key={y} position={[(i - 1.5) * 0.18, 7.1 + y, -1.05]} rotation={[-0.7, 0, 0]} material={horn}>
          <coneGeometry args={[0.16, 0.85, 4]} />
        </mesh>
      ))}
      <mesh position={[0, 12.45, 0.05]} material={plate}>
        <cylinderGeometry args={[0.72, 1.05, 1.2, 6]} />
      </mesh>
      <mesh position={[0.05, 13.85, 0.15]} rotation={[0.18, 0, 0]} material={plate}>
        <cylinderGeometry args={[0.95, 1.25, 2.35, 7]} />
      </mesh>
      <mesh position={[0.05, 15.15, 0.05]} material={iron}>
        <cylinderGeometry args={[0.22, 0.85, 0.85, 6]} />
      </mesh>
      <mesh position={[-0.85, 14.7, 0.15]} rotation={[0.35, 0, 0.85]} material={horn}>
        <coneGeometry args={[0.22, 2.15, 5]} />
      </mesh>
      <mesh position={[0.95, 14.85, 0.25]} rotation={[0.45, 0, -0.95]} material={horn}>
        <coneGeometry args={[0.24, 2.45, 5]} />
      </mesh>
      <mesh position={[0.08, 13.55, 1.28]} material={eye}>
        <boxGeometry args={[1.45, 0.16, 0.1]} />
      </mesh>
      <mesh position={[0.08, 12.95, 1.22]} material={iron}>
        <boxGeometry args={[0.85, 0.22, 0.12]} />
      </mesh>
    </group>
  );
}

const HEAD_BAR = 2.5;

function HeadHp({ soldiers }: { soldiers: number }) {
  const fill = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    const alive = devAlive(Math.max(0, clock.elapsedTime - REEL_HOLD), soldiers, true, true, false, false);
    const u = Math.max(0, Math.min(1, alive / Math.max(1, soldiers)));
    const mesh = fill.current;
    if (!mesh) return;
    mesh.scale.x = Math.max(0.04, u);
    mesh.position.x = (u - 1) * HEAD_BAR * 0.5;
  });
  return (
    <group position={[0.05, 16.2, 0]}>
      <mesh>
        <boxGeometry args={[HEAD_BAR + 0.1, 0.32, 0.05]} />
        <meshBasicMaterial color="#8f1c1c" side={THREE.DoubleSide} />
      </mesh>
      <mesh ref={fill}>
        <boxGeometry args={[HEAD_BAR, 0.18, 0.1]} />
        <meshBasicMaterial color="#ff1a1a" toneMapped={false} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

type FleshKit = {
  hide: THREE.Material;
  bone: THREE.Material;
  horn: THREE.Material;
  eye: THREE.Material;
  pit: THREE.Material;
  skin: THREE.Material;
  torso: THREE.BufferGeometry;
  legL: THREE.BufferGeometry;
  legR: THREE.BufferGeometry;
  arm: THREE.BufferGeometry;
  head: THREE.BufferGeometry;
  hornL: THREE.BufferGeometry;
  hornR: THREE.BufferGeometry;
  foot: THREE.BufferGeometry;
  maul: THREE.BufferGeometry;
};

const FLESH = new THREE.Color("#6b5648");
const FLESH_DARK = new THREE.Color("#1c1613");
const FLESH_BLOOD = new THREE.Color("#6a1a14");
const FLESH_BONE = new THREE.Color("#cbb89a");
const FLESH_BRUISE = new THREE.Color("#3c2a36");

function lathe(profile: number[][], n = 18) {
  return new THREE.LatheGeometry(
    profile.map(([r, y]) => new THREE.Vector2(r, y)),
    n
  );
}

function paintVert(colors: Float32Array, i: number, light: number, blood = 0, bone = 0, bruise = 0) {
  const col = FLESH.clone();
  col.lerp(FLESH_DARK, THREE.MathUtils.clamp(1 - light, 0, 0.78));
  if (bruise > 0) col.lerp(FLESH_BRUISE, Math.min(1, bruise));
  if (blood > 0) col.lerp(FLESH_BLOOD, Math.min(1, blood));
  if (bone > 0) col.lerp(FLESH_BONE, Math.min(1, bone));
  colors[i * 3] = col.r;
  colors[i * 3 + 1] = col.g;
  colors[i * 3 + 2] = col.b;
}

function finishHide(geo: THREE.BufferGeometry, colors: Float32Array) {
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
}

function hornGeo(side: number) {
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(side * 0.22, 0.42, 0.04),
    new THREE.Vector3(side * 0.62, 0.95, -0.12),
    new THREE.Vector3(side * 1.05, 0.58, -0.42),
  ]);
  const steps = 14;
  const radial = 6;
  const frames = curve.computeFrenetFrames(steps, false);
  const positions: number[] = [];
  const indices: number[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const radius = 0.2 * (1 - t) * (1 - t) + 0.025;
    const center = curve.getPoint(t);
    const n = frames.normals[i];
    const b = frames.binormals[i];
    for (let j = 0; j <= radial; j++) {
      const a = (j / radial) * Math.PI * 2;
      positions.push(
        center.x + (Math.cos(a) * n.x + Math.sin(a) * b.x) * radius,
        center.y + (Math.cos(a) * n.y + Math.sin(a) * b.y) * radius,
        center.z + (Math.cos(a) * n.z + Math.sin(a) * b.z) * radius
      );
    }
  }
  const row = radial + 1;
  for (let i = 0; i < steps; i++) {
    for (let j = 0; j < radial; j++) {
      const a = i * row + j;
      indices.push(a, a + row, a + 1, a + 1, a + row, a + row + 1);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function footGeo() {
  const shape = new THREE.Shape();
  shape.moveTo(-0.42, -0.2);
  shape.bezierCurveTo(-0.55, 0.4, -0.4, 0.95, -0.08, 1.2);
  shape.bezierCurveTo(0.18, 1.32, 0.48, 1.02, 0.5, 0.5);
  shape.bezierCurveTo(0.5, 0.1, 0.36, -0.28, 0.02, -0.34);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.34, bevelEnabled: true, bevelThickness: 0.07, bevelSize: 0.06, bevelSegments: 1, curveSegments: 8 });
  geo.translate(0, 0, -0.17);
  geo.rotateX(-Math.PI / 2);
  geo.computeVertexNormals();
  return geo;
}

function sculptFoot(geo: THREE.BufferGeometry) {
  const p = geo.attributes.position;
  const colors = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    let y = p.getY(i);
    const x = p.getX(i);
    const z = p.getZ(i);
    if (y > 0.01 && z > 0.4) y += Math.max(0, Math.sin((x + 0.12) * 12)) * 0.065 * Math.min(1, (z - 0.4) / 0.55);
    p.setY(i, y);
    paintVert(colors, i, 0.58 + y, z > 1.05 ? 0.3 : 0);
  }
  finishHide(geo, colors);
}

function sculptTorso(geo: THREE.BufferGeometry) {
  const p = geo.attributes.position;
  const colors = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i);
    let y = p.getY(i);
    let z = p.getZ(i);
    const rad = Math.hypot(x, z) || 1;
    const yn = y / 6.75;
    const front = Math.max(0, z / rad);
    const back = Math.max(0, -z / rad);
    if (yn > 0.62 && yn < 0.84) x *= 1 + 0.34 * Math.sin(((yn - 0.62) / 0.22) * Math.PI);
    if (yn > 0.5) z += (yn - 0.5) * 0.4;
    if (yn > 0.5 && yn < 0.72 && z > 0) {
      const pec = Math.exp(-((Math.abs(x) - 0.62) ** 2) / 0.2) * Math.exp(-((y - 4.2) ** 2) / 0.32);
      z += 0.46 * pec;
    }
    if (Math.abs(x) < 0.15 && yn > 0.5 && yn < 0.74 && z > 0.3) z -= 0.16;
    if (yn > 0.08 && yn < 0.4 && z > 0) {
      const gut = Math.sin(((yn - 0.08) / 0.32) * Math.PI);
      z += 0.52 * gut * front;
      y -= 0.24 * gut * front;
      z += Math.max(0, Math.sin(y * 6.4)) * 0.055 * gut;
    }
    if (back > 0.4 && yn > 0.12 && yn < 0.9) {
      const ridge = Math.exp(-(x * x) / 0.07);
      z -= 0.22 * ridge;
    }
    if (yn > 0.66 && yn < 0.76 && z > 0 && Math.abs(x) > 0.3 && Math.abs(x) < 1.55) {
      z += 0.1;
      y += 0.045;
    }
    const wound = Math.exp(-((x + 1.28) ** 2) / 0.16 - ((y - 3.5) ** 2) / 0.2);
    if (wound > 0.04 && z > -0.4) {
      x *= 1 - wound * 0.18;
      z *= 1 - wound * 0.12;
    }
    p.setXYZ(i, x, y, z);
    paintVert(colors, i, 0.44 + front * 0.36 - back * 0.16, wound * 0.85, back > 0.62 && Math.abs(x) < 0.22 ? 0.45 : 0, x > 1 && yn < 0.32 ? 0.28 : 0);
  }
  finishHide(geo, colors);
}

function sculptLeg(geo: THREE.BufferGeometry, side: number) {
  const p = geo.attributes.position;
  const colors = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i);
    let y = p.getY(i);
    let z = p.getZ(i);
    const yn = y / 5.05;
    if (yn > 0.55 && yn < 0.92 && z > -0.08) {
      const k = Math.sin(((yn - 0.55) / 0.37) * Math.PI);
      z += 0.28 * k;
      x += side * 0.15 * k;
    }
    if (yn > 0.58 && yn < 0.9 && z < 0) z -= 0.14 * Math.sin(((yn - 0.58) / 0.32) * Math.PI);
    const knee = Math.exp(-((yn - 0.45) ** 2) / 0.0016);
    if (z > -0.2) z += 0.2 * knee;
    if (yn > 0.14 && yn < 0.4 && z < 0.08) z -= 0.32 * Math.sin(((yn - 0.14) / 0.26) * Math.PI);
    if (yn > 0.12 && yn < 0.42 && z > 0 && Math.abs(x) < 0.24) z += 0.1;
    let gash = 0;
    if (side < 0 && yn > 0.18 && yn < 0.36) {
      gash = Math.exp(-((x - 0.12) ** 2) / 0.018 - ((yn - 0.27) ** 2) / 0.0035);
      z -= 0.18 * gash;
    }
    p.setXYZ(i, x, y, z);
    paintVert(colors, i, 0.5 + (z > 0 ? 0.18 : -0.1), gash * 0.8, knee * 0.6);
  }
  finishHide(geo, colors);
}

function sculptArm(geo: THREE.BufferGeometry) {
  const p = geo.attributes.position;
  const colors = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i);
    let y = p.getY(i);
    let z = p.getZ(i);
    const yn = y / 3.4;
    if (yn > 0.72) {
      const k = (yn - 0.72) / 0.28;
      x *= 1 + 0.3 * k;
      z *= 1 + 0.14 * k;
    }
    if (yn > 0.55 && yn < 0.78 && z > -0.15) z += 0.18 * Math.sin(((yn - 0.55) / 0.23) * Math.PI);
    const elbow = Math.exp(-((yn - 0.5) ** 2) / 0.0011);
    if (z > -0.25) z += 0.12 * elbow;
    if (yn > 0.16 && yn < 0.46) {
      x *= 1.14;
      z += z > 0 ? 0.07 : -0.09;
    }
    if (yn < 0.13) {
      x *= 1.75;
      z *= 0.72;
      if (z < 0) z -= Math.max(0, Math.sin(x * 15)) * 0.055;
    }
    p.setXYZ(i, x, y, z);
    paintVert(colors, i, 0.5 + (yn > 0.62 ? 0.12 : 0), yn < 0.18 ? 0.5 : yn < 0.36 ? 0.16 : 0, elbow * 0.45);
  }
  finishHide(geo, colors);
}

function skullGeo() {
  const geo = new THREE.SphereGeometry(1, 40, 28);
  const p = geo.attributes.position;
  const colors = new Float32Array(p.count * 3);
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const ox = v.x;
    const oy = v.y;
    const oz = v.z;
    v.y *= 1.1;
    const brow = Math.exp(-((oy - 0.28) ** 2) / 0.016) * Math.max(0, oz);
    v.z += 0.46 * brow;
    v.y += 0.04 * brow * (ox > 0.05 ? 0.45 : 1);
    const socketAt = (cx: number, cy: number) => {
      const d = Math.hypot(ox - cx, oy - cy);
      return d < 0.32 && oz > 0.15 ? (1 - d / 0.32) ** 1.45 : 0;
    };
    const sock = Math.max(socketAt(-0.32, 0.05), socketAt(0.34, -0.02));
    v.z -= 0.5 * sock;
    if (Math.abs(ox) < 0.14 && oy > -0.18 && oy < 0.16 && oz > 0.25) {
      v.z += 0.3 * (1 - Math.abs(ox) / 0.14);
      v.x *= 0.4;
    }
    if (Math.abs(ox) > 0.3 && Math.abs(ox) < 0.7 && oy < 0.06 && oy > -0.36 && oz > 0) {
      v.z -= 0.22;
      v.x *= 0.88;
    }
    if (oy < 0) {
      const jaw = Math.min(1, -oy * 1.25);
      v.y -= 0.3 * jaw;
      if (oz > 0) v.z += 0.5 * jaw;
      v.x *= 1 + 0.16 * jaw;
    }
    if (oy > 0.42) v.x *= 0.84;
    if (oz < 0) v.z *= 0.76;
    if (Math.abs(ox) > 0.7 && Math.abs(oy) < 0.26 && Math.abs(oz) < 0.28) v.x += Math.sign(ox) * 0.14;
    if (ox > 0.72 && oy < 0.08) v.x *= 0.86;
    const mouth = Math.exp(-((oy + 0.36) ** 2) / 0.01) * Math.max(0, oz);
    v.z -= 0.24 * mouth;
    const crack = Math.exp(-((ox - 0.12) ** 2) / 0.008) * Math.max(0, oy - 0.4) * Math.exp(-((oz + 0.1) ** 2) / 0.05);
    v.y -= 0.18 * crack;
    p.setXYZ(i, v.x, v.y, v.z);
    paintVert(colors, i, 0.46 + Math.max(0, oz) * 0.32 + oy * 0.08 - sock * 0.5, mouth * 0.9, Math.max(brow * 0.4, crack), Math.abs(ox) > 0.45 && oy < -0.05 ? 0.32 : 0);
  }
  finishHide(geo, colors);
  return geo;
}

function buildFleshKit(): FleshKit {
  const hide = new THREE.MeshStandardMaterial({ vertexColors: true, color: "#ffffff", roughness: 0.84, metalness: 0.02 });
  const bone = new THREE.MeshStandardMaterial({ color: "#d4c4a8", roughness: 0.62, metalness: 0.04 });
  const horn = new THREE.MeshStandardMaterial({ color: "#241c16", roughness: 0.4, metalness: 0.3 });
  const eye = new THREE.MeshStandardMaterial({ color: "#ff3a18", emissive: "#ff1206", emissiveIntensity: 1.8, roughness: 0.28 });
  const pit = new THREE.MeshStandardMaterial({ color: "#0c0908", roughness: 1 });
  const skin = new THREE.MeshStandardMaterial({ color: "#6b5648", roughness: 0.84, metalness: 0.02 });
  const torso = lathe(
    [
      [1.22, 0],
      [1.48, 0.5],
      [1.66, 1.15],
      [1.46, 1.95],
      [1.18, 2.6],
      [1.52, 3.25],
      [1.82, 3.95],
      [1.96, 4.5],
      [1.48, 5.1],
      [0.7, 5.6],
      [0.48, 6.25],
      [0.4, 6.75],
    ],
    28
  );
  sculptTorso(torso);
  const legL = lathe(
    [
      [0.34, 0],
      [0.48, 0.35],
      [0.62, 1.15],
      [0.42, 1.9],
      [0.5, 2.35],
      [0.86, 3.15],
      [0.98, 4.15],
      [0.72, 5.05],
    ],
    18
  );
  const legR = legL.clone();
  sculptLeg(legL, -1);
  sculptLeg(legR, 1);
  const arm = lathe(
    [
      [0.16, 0],
      [0.36, 0.14],
      [0.28, 0.42],
      [0.24, 0.85],
      [0.38, 1.45],
      [0.28, 1.9],
      [0.5, 2.4],
      [0.56, 3.05],
      [0.4, 3.4],
    ],
    16
  );
  sculptArm(arm);
  const foot = footGeo();
  sculptFoot(foot);
  const maul = new THREE.IcosahedronGeometry(1.05, 1);
  const mp = maul.attributes.position;
  for (let i = 0; i < mp.count; i++) {
    const n = 0.78 + Math.abs(Math.sin(i * 2.4 + 1.7)) * 0.4;
    mp.setXYZ(i, mp.getX(i) * n, mp.getY(i) * (0.7 + (i % 4) * 0.08), mp.getZ(i) * n);
  }
  maul.computeVertexNormals();
  return { hide, bone, horn, eye, pit, skin, torso, legL, legR, arm, head: skullGeo(), hornL: hornGeo(-1), hornR: hornGeo(1), foot, maul };
}

function FleshShell({ kit }: { kit: FleshKit }) {
  return (
    <group>
      <mesh geometry={kit.legL} material={kit.hide} position={[-0.96, 0.2, 0.1]} rotation={[0.14, 0.02, 0.07]} />
      <mesh geometry={kit.legR} material={kit.hide} position={[1.06, 0.16, -0.02]} rotation={[0.05, -0.03, -0.09]} />
      <mesh geometry={kit.foot} material={kit.hide} position={[-1.0, 0.1, 0.7]} rotation={[0.1, 0.04, 0]} />
      <mesh geometry={kit.foot} material={kit.hide} position={[1.14, 0.08, 0.64]} rotation={[0.08, -0.1, 0]} />
      <mesh geometry={kit.torso} material={kit.hide} position={[0.02, 5.02, 0]} />
      <group position={[0.03, 13.4, 0.38]}>
        <mesh geometry={kit.head} material={kit.hide} scale={1.18}>
          <mesh geometry={kit.hornL} material={kit.horn} position={[-0.4, 0.4, 0.08]} />
          <mesh geometry={kit.hornR} material={kit.horn} position={[0.48, 0.34, 0.06]} />
          <mesh position={[-0.3, 0.02, 0.52]} material={kit.eye}>
            <boxGeometry args={[0.15, 0.04, 0.035]} />
          </mesh>
          <mesh position={[0.33, -0.04, 0.5]} material={kit.eye}>
            <boxGeometry args={[0.17, 0.038, 0.035]} />
          </mesh>
          <mesh position={[0.02, -0.48, 0.58]} material={kit.pit}>
            <boxGeometry args={[0.38, 0.06, 0.07]} />
          </mesh>
          <mesh position={[-0.1, -0.55, 0.74]} rotation={[0.75, 0, -0.2]} material={kit.bone}>
            <coneGeometry args={[0.055, 0.4, 5]} />
          </mesh>
          <mesh position={[0.12, -0.52, 0.76]} rotation={[0.65, 0, 0.25]} material={kit.bone}>
            <coneGeometry args={[0.05, 0.26, 5]} />
          </mesh>
          <mesh position={[0.24, -0.34, 0.7]} rotation={[2.5, 0.2, 0.5]} material={kit.bone}>
            <coneGeometry args={[0.04, 0.16, 4]} />
          </mesh>
        </mesh>
      </group>
    </group>
  );
}

function FleshLimb({ kit, mace = false }: { kit: FleshKit; mace?: boolean }) {
  const fingers = [-0.16, -0.05, 0.06, 0.17];
  return (
    <mesh geometry={kit.arm} material={kit.hide} position={mace ? [0.06, -3.15, 0.88] : [0.02, -3.2, 0.3]} rotation={[mace ? -0.3 : -0.1, 0, mace ? -0.05 : 0.04]}>
      {fingers.map((x, i) => (
        <mesh key={i} position={[x, 0.01, 0.16]} rotation={[1.25, 0, (i - 1.5) * 0.1]} material={kit.skin}>
          <capsuleGeometry args={[0.055, 0.28, 3, 5]} />
        </mesh>
      ))}
      <mesh position={[mace ? -0.22 : 0.22, -0.02, 0.1]} rotation={[1.05, mace ? 0.45 : -0.45, mace ? 0.7 : -0.7]} material={kit.skin}>
        <capsuleGeometry args={[0.06, 0.22, 3, 5]} />
      </mesh>
      {fingers.map((x, i) => (
        <mesh key={`n${i}`} position={[x, -0.08, 0.38]} rotation={[1.45, 0, 0]} material={kit.horn}>
          <coneGeometry args={[0.03, 0.12, 4]} />
        </mesh>
      ))}
    </mesh>
  );
}

const COLOSSUS_URL = "/models/colossus.glb";
const COLOSSUS_HEIGHT = 15.6;
const COLOSSUS_SPAN_Y = 2.711936;
const COLOSSUS_MIN_Y = -1.520994;
const COLOSSUS_CENTER_X = -0.291638;
const COLOSSUS_CENTER_Z = -0.259902;

function splitAbove(geo: THREE.BufferGeometry, cut: number) {
  const src = geo.toNonIndexed();
  const pos = src.getAttribute("position");
  const norm = src.getAttribute("normal");
  const uv = src.getAttribute("uv");
  const topP: number[] = [];
  const topN: number[] = [];
  const topU: number[] = [];
  const lowP: number[] = [];
  const lowN: number[] = [];
  const lowU: number[] = [];
  for (let i = 0; i < pos.count; i += 3) {
    const y = (pos.getY(i) + pos.getY(i + 1) + pos.getY(i + 2)) / 3;
    const P = y >= cut ? topP : lowP;
    const N = y >= cut ? topN : lowN;
    const U = y >= cut ? topU : lowU;
    for (let k = 0; k < 3; k++) {
      P.push(pos.getX(i + k), pos.getY(i + k), pos.getZ(i + k));
      if (norm) N.push(norm.getX(i + k), norm.getY(i + k), norm.getZ(i + k));
      if (uv) U.push(uv.getX(i + k), uv.getY(i + k));
    }
  }
  const pack = (P: number[], N: number[], U: number[]) => {
    if (!P.length) return null;
    const next = new THREE.BufferGeometry();
    next.setAttribute("position", new THREE.Float32BufferAttribute(P, 3));
    if (N.length) next.setAttribute("normal", new THREE.Float32BufferAttribute(N, 3));
    else next.computeVertexNormals();
    if (U.length) next.setAttribute("uv", new THREE.Float32BufferAttribute(U, 2));
    return next;
  };
  return { top: pack(topP, topN, topU), rest: pack(lowP, lowN, lowU) };
}

function colossusSword() {
  const group = new THREE.Group();
  const steel = new THREE.MeshStandardMaterial({ color: "#d7dee6", metalness: 0.92, roughness: 0.22, side: THREE.DoubleSide });
  const wrap = new THREE.MeshStandardMaterial({ color: "#3a3e46", metalness: 0.4, roughness: 0.5 });
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.045, 0.32, 6), wrap);
  grip.rotation.x = Math.PI / 2;
  const guard = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.07, 0.08), steel);
  guard.position.z = 0.18;
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.028, 1.55), steel);
  blade.position.z = 0.98;
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.26, 4), steel);
  tip.rotation.x = Math.PI / 2;
  tip.position.z = 1.86;
  group.add(grip, guard, blade, tip);
  group.position.set(-0.42, -0.64, 0.98);
  group.rotation.x = 0.42;
  return group;
}

function isStrikingPart(center: THREE.Vector3) {
  return center.z > 0.55 && center.y < 0.65 && center.y > -0.95 && center.x < 0.15;
}

function ColossusModel({ soldiers }: { soldiers: number }) {
  const rig = useRef<THREE.Group>(null);
  const strike = useMemo(() => ({ arm: null as THREE.Group | null }), []);
  useEffect(() => {
    const loader = new GLTFLoader();
    let drop = false;
    const metal = new THREE.MeshStandardMaterial({ color: "#a7b0b8", metalness: 0.84, roughness: 0.32, side: THREE.DoubleSide });
    const ink = new THREE.MeshStandardMaterial({ color: "#3a3e46", metalness: 0.4, roughness: 0.48, side: THREE.DoubleSide });
    const sword = colossusSword();
    loader.load(COLOSSUS_URL, (gltf) => {
      const host = rig.current;
      if (drop || !host) return;
      const model = gltf.scene;
      const arm = new THREE.Group();
      arm.position.set(-0.2, 0.78, 0.38);
      model.add(arm);
      model.updateMatrixWorld(true);
      const limb: THREE.Object3D[] = [];
      const meshes: THREE.Mesh[] = [];
      model.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (mesh.isMesh) meshes.push(mesh);
      });
      for (const mesh of meshes) {
        mesh.frustumCulled = false;
        const box = new THREE.Box3().setFromObject(mesh);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        const hand = isStrikingPart(center) || (center.x > 0.28 && center.y > 0.02 && center.y < 0.55 && size.y < 0.4);
        const foot = center.y < -0.82 || (center.y < -0.7 && size.y < 0.4 && center.z < 0.55);
        const head = box.min.y > 0.62;
        if (hand || foot || head) mesh.material = ink;
        else if (box.max.y > 0.88 && box.min.y < 0.55) {
          const parts = splitAbove(mesh.geometry, 0.74);
          if (parts.top) {
            const crown = new THREE.Mesh(parts.top, ink);
            crown.frustumCulled = false;
            mesh.add(crown);
          }
          if (parts.rest) mesh.geometry = parts.rest;
          mesh.material = metal;
        } else mesh.material = metal;
        if (isStrikingPart(center)) limb.push(mesh);
      }
      for (const mesh of limb) arm.attach(mesh);
      model.add(sword);
      arm.attach(sword);
      strike.arm = arm;
      host.add(model);
    });
    return () => {
      drop = true;
      strike.arm = null;
      metal.dispose();
      ink.dispose();
      sword.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (!mesh.isMesh) return;
        mesh.geometry.dispose();
        const mat = mesh.material as THREE.Material;
        mat.dispose();
      });
      rig.current?.clear();
    };
  }, []);
  useFrame(({ clock }) => {
    const arm = strike.arm;
    if (!arm) return;
    const t = Math.max(0, clock.elapsedTime - REEL_HOLD);
    const s = devMaceSwing(t, soldiers);
    arm.rotation.x = s.pitch * 0.82;
    arm.rotation.y = s.twist * 0.35;
    arm.rotation.z = -s.sweep * 0.4;
  });
  const scale = COLOSSUS_HEIGHT / COLOSSUS_SPAN_Y;
  return <group ref={rig} scale={scale} position={[-COLOSSUS_CENTER_X * scale, -COLOSSUS_MIN_Y * scale, -COLOSSUS_CENTER_Z * scale]} />;
}

function GiantBody({ soldiers, big, sword, dread, flesh = false, crown = false }: { soldiers: number; big: boolean; sword: boolean; dread: boolean; flesh?: boolean; crown?: boolean }) {
  const root = useRef<THREE.Group>(null);
  const arm = useRef<THREE.Group>(null);
  const mace = useRef<THREE.Group>(null);
  const blade = useRef<THREE.Group>(null);
  const plate = useMemo(() => new THREE.MeshStandardMaterial({ color: "#121216", metalness: 0.78, roughness: 0.32 }), []);
  const iron = useMemo(() => new THREE.MeshStandardMaterial({ color: "#2a2a30", metalness: 0.7, roughness: 0.4 }), []);
  const slit = useMemo(() => new THREE.MeshStandardMaterial({ color: "#ff2a14", emissive: "#ff1a10", emissiveIntensity: 1.4, roughness: 0.4 }), []);
  const eye = useMemo(() => new THREE.MeshStandardMaterial({ color: "#ff3a18", emissive: "#ff1a08", emissiveIntensity: 2.4, roughness: 0.28 }), []);
  const horn = useMemo(() => new THREE.MeshStandardMaterial({ color: "#1a1816", metalness: 0.45, roughness: 0.55 }), []);
  useFrame(({ clock }) => {
    const t = Math.max(0, clock.elapsedTime - REEL_HOLD);
    const g = devGiantAt(t);
    if (big) {
      const s = devMaceSwing(t, soldiers);
      const step = Math.abs(Math.sin(t * 5.6)) * 0.18;
      const fx = Math.sin(g.yaw);
      const fz = Math.cos(g.yaw);
      if (root.current) {
        root.current.position.set(g.x + fx * s.lunge * 1.6, step - s.dip, g.z + fz * s.lunge * 1.6);
        root.current.rotation.y = g.yaw + s.twist;
        root.current.rotation.z = s.sweep * 0.07;
      }
      if (sword) {
        const slash = devSwordPose(t);
        if (arm.current) {
          arm.current.rotation.x = slash.armX;
          arm.current.rotation.z = slash.armZ;
        }
        if (blade.current) blade.current.rotation.x = slash.blade;
      } else if (arm.current) {
        arm.current.rotation.x = 0;
        arm.current.rotation.z = 0.16 - s.twist * 0.6;
      }
      if (mace.current) {
        mace.current.rotation.x = s.pitch;
        mace.current.rotation.y = s.sweep * 0.22;
        mace.current.rotation.z = s.sweep;
      }
    } else {
      const hit = devClubHit(t, soldiers);
      const pace = Math.sin(t * 7.2);
      if (root.current) {
        root.current.position.set(g.x, Math.abs(Math.sin(t * 5.6)) * 0.32, g.z);
        root.current.rotation.y = g.yaw;
        root.current.rotation.z = pace * 0.045;
      }
      if (arm.current) {
        arm.current.rotation.x = 0;
        arm.current.rotation.z = 0.14 + pace * 0.22 - hit * 0.42;
      }
      if (mace.current) {
        mace.current.rotation.x = -0.12 - hit * 2.25;
        mace.current.rotation.y = 0;
        mace.current.rotation.z = 0;
      }
    }
  });
  const spikes = [0, 45, 90, 135, 180, 225, 270, 315];
  return (
    <group ref={root} scale={big ? 1.52 : 1}>
      {flesh ? (
        <ColossusModel soldiers={soldiers} />
      ) : dread ? (
        <DreadShell plate={plate} iron={iron} eye={eye} horn={horn} />
      ) : (
        <>
      <mesh position={[-1.15, 3.1, 0.15]} material={plate}>
        <cylinderGeometry args={[0.72, 0.95, 5.4, 6]} />
      </mesh>
      <mesh position={[1.15, 3.1, 0.15]} material={plate}>
        <cylinderGeometry args={[0.72, 0.95, 5.4, 6]} />
      </mesh>
      <mesh position={[-1.15, 0.45, 0.35]} material={iron}>
        <boxGeometry args={[1.35, 0.7, 2.1]} />
      </mesh>
      <mesh position={[1.15, 0.45, 0.35]} material={iron}>
        <boxGeometry args={[1.35, 0.7, 2.1]} />
      </mesh>
      <mesh position={[0, 6.15, 0.05]} material={plate}>
        <boxGeometry args={[4.4, 1.5, 2.3]} />
      </mesh>
      <mesh position={[0, 9.15, 0]} material={plate}>
        <boxGeometry args={[4.1, 4.6, 2.35]} />
      </mesh>
      <mesh position={[0, 11.7, 0.15]} material={iron}>
        <boxGeometry args={[3.3, 0.55, 2.5]} />
      </mesh>
      <mesh position={[-2.55, 10.7, 0]} rotation={[0, 0, 0.35]} material={plate}>
        <boxGeometry args={[1.7, 0.55, 2.2]} />
      </mesh>
      <mesh position={[2.55, 10.7, 0]} rotation={[0, 0, -0.35]} material={plate}>
        <boxGeometry args={[1.7, 0.55, 2.2]} />
      </mesh>
      <mesh position={[-3.15, 11.15, 0]} rotation={[0, 0, 0.4]} material={iron}>
        <coneGeometry args={[0.28, 1.15, 5]} />
      </mesh>
      <mesh position={[3.15, 11.15, 0]} rotation={[0, 0, -0.4]} material={iron}>
        <coneGeometry args={[0.28, 1.15, 5]} />
      </mesh>
      <mesh position={[0, 13.55, 0.05]} material={plate}>
        <cylinderGeometry args={[1.25, 1.55, 2.5, 8]} />
      </mesh>
      <mesh position={[0, 15.15, 0.05]} material={iron}>
        <cylinderGeometry args={[0.35, 1.35, 1.15, 8]} />
      </mesh>
      {spikes.map((deg) => {
        const rad = (deg * Math.PI) / 180;
        return (
          <mesh key={deg} position={[Math.sin(rad) * 1.2, 14.9, Math.cos(rad) * 1.2]} rotation={[Math.cos(rad) * 0.9, 0, -Math.sin(rad) * 0.9]} material={iron}>
            <coneGeometry args={[0.16, 1.15, 4]} />
          </mesh>
        );
      })}
      <mesh position={[0, 13.35, 1.22]} material={slit}>
        <boxGeometry args={[1.15, 0.12, 0.08]} />
      </mesh>
        </>
      )}
      {!flesh && (
        <>
      <group ref={arm} position={[-2.7, 10.4, 0.2]}>
        {dread ? (
          <>
            <mesh position={[-0.18, -0.95, 0.12]} rotation={[0.12, 0, 0.08]} material={plate}>
              <cylinderGeometry args={[0.62, 0.82, 1.95, 6]} />
            </mesh>
            <mesh position={[-0.34, -2.4, 0.32]} rotation={[0.28, 0, 0.06]} material={iron}>
              <cylinderGeometry args={[0.5, 0.66, 1.8, 5]} />
            </mesh>
            <mesh position={[-0.22, -1.85, 0.55]} rotation={[0.4, 0, 0.6]} material={horn}>
              <coneGeometry args={[0.12, 0.55, 4]} />
            </mesh>
          </>
        ) : (
          <mesh position={[-0.25, -1.7, 0.2]} rotation={[0.2, 0, 0.15]} material={plate}>
            <cylinderGeometry args={[0.42, 0.55, 3.2, 6]} />
          </mesh>
        )}
        {sword && (
          <group ref={blade} position={[-0.4, -3.25, 0.45]}>
            <mesh position={[0, 0, 0.28]} material={iron}>
              <boxGeometry args={[0.46, 0.46, 0.7]} />
            </mesh>
            <mesh position={[0, 0, 0.82]} material={plate}>
              <boxGeometry args={[1.7, 0.4, 0.42]} />
            </mesh>
            <mesh position={[0, 0, 4.45]} material={iron}>
              <boxGeometry args={[0.62, 0.32, 6.8]} />
            </mesh>
          </group>
        )}
      </group>
      <group ref={mace} position={[2.7, 10.5, 0.25]}>
        {dread ? (
          <>
            <mesh position={[0.22, -0.9, 0.18]} rotation={[0.2, 0, -0.08]} material={plate}>
              <cylinderGeometry args={[0.68, 0.86, 1.85, 6]} />
            </mesh>
            <mesh position={[0.38, -2.25, 0.42]} rotation={[0.42, 0, -0.06]} material={iron}>
              <cylinderGeometry args={[0.52, 0.68, 1.7, 5]} />
            </mesh>
          </>
        ) : (
          <mesh position={[0.25, -1.5, 0.55]} rotation={[0.55, 0, -0.1]} material={plate}>
            <cylinderGeometry args={[0.48, 0.62, 3.1, 6]} />
          </mesh>
        )}
        <mesh position={[0.45, -2.2, 4.6]} rotation={[1.2, 0, 0]} material={iron}>
          <cylinderGeometry args={[0.22, 0.28, 7.4, 6]} />
        </mesh>
        <mesh position={[0.7, -2.7, 8.2]} rotation={[1.2, 0, 0]} material={plate}>
          <sphereGeometry args={[1.15, 8, 6]} />
        </mesh>
        <mesh position={[0.7, -1.5, 8.2]} material={iron}>
          <coneGeometry args={[0.28, 1.1, 4]} />
        </mesh>
        <mesh position={[0.7, -3.9, 8.2]} rotation={[Math.PI, 0, 0]} material={iron}>
          <coneGeometry args={[0.28, 1.1, 4]} />
        </mesh>
        <mesh position={[-0.35, -2.7, 8.2]} rotation={[0, 0, Math.PI / 2]} material={iron}>
          <coneGeometry args={[0.26, 1.05, 4]} />
        </mesh>
        <mesh position={[1.75, -2.7, 8.2]} rotation={[0, 0, -Math.PI / 2]} material={iron}>
          <coneGeometry args={[0.26, 1.05, 4]} />
        </mesh>
      </group>
        </>
      )}
      {crown && <HeadHp soldiers={soldiers} />}
    </group>
  );
}

const BLOOD = 28;
const _drop = Array.from({ length: BLOOD }, () => ({ t: -10, x: 0, y: 0, z: 0, vx: 0, vz: 0 }));
let _dropN = 0;

function ArrowVolley({ big, snake = false, devs = false, soldiers = 0 }: { big: boolean; snake?: boolean; devs?: boolean; soldiers?: number }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const blood = useRef<THREE.InstancedMesh>(null);
  const lastHit = useRef(new Float32Array(ARROWS));
  useFrame(({ clock }) => {
    if (!mesh.current) return;
    const t = Math.max(0, clock.elapsedTime - REEL_HOLD);
    const g = devGiantAt(t);
    const cy = Math.cos(g.yaw);
    const sy = Math.sin(g.yaw);
    const nArrow = devs ? 36 : ARROWS;
    for (let i = 0; i < nArrow; i++) {
      if (devs) {
        const flight = 1.05;
        const phase = (t * 0.95 + i * 0.23) % flight;
        const u = phase / flight;
        const shot = devWaitArrow(soldiers, i, Math.max(0, t - phase));
        const show = !!shot && t > 1.2 && t < LAST_ARROW && u > 0.04 && u < 0.98;
        if (!shot || !show) {
          dummy.position.set(0, -30, 0);
          dummy.scale.set(0, 0, 0);
        } else {
          dummy.position.set(shot.sx + (shot.hx - shot.sx) * u, shot.sy + (shot.hy - shot.sy) * u + Math.sin(u * Math.PI) * 0.7, shot.sz + (shot.hz - shot.sz) * u);
          dummy.lookAt(shot.hx, shot.hy, shot.hz);
          dummy.rotateX(Math.PI / 2);
          dummy.scale.set(0.5, 1.1, 0.5);
        }
        dummy.updateMatrix();
        mesh.current.setMatrixAt(i, dummy.matrix);
        continue;
      }
      const phase = ((t * 0.8 + i * 0.19) % 1.4) / 1.4;
      const ang = (i / ARROWS) * Math.PI * 2;
      const rad = (big ? 32 : 22) + (i % 4) * 1.6;
      const sx = g.x + Math.sin(ang) * rad;
      const sz = g.z + Math.cos(ang) * rad;
      const u = phase;
      if (!snake && !devs) {
        const aimY = big ? 14 : 9.2;
        dummy.position.set(sx + (g.x - sx) * u, 1.6 + (aimY - 1.6) * u + Math.sin(u * Math.PI) * 2.6, sz + (g.z - sz) * u);
        dummy.lookAt(g.x, aimY, g.z);
        dummy.rotateX(Math.PI / 2);
        const show = t > 2 && t < LAST_ARROW && u > 0.06 && u < 0.9;
        dummy.scale.set(show ? 0.56 : 0, show ? 1.15 : 0, show ? 0.56 : 0);
        dummy.updateMatrix();
        mesh.current.setMatrixAt(i, dummy.matrix);
        continue;
      }
      let hx = g.x;
      let hy = 2;
      let hz = g.z;
      if (devs) {
        const troop = devTroopSlot(i % TROOP_N, g, t);
        hx = troop.x + Math.sin(troop.ry) * 1.1;
        hy = 1.2 * TROOP_SCALE;
        hz = troop.z + Math.cos(troop.ry) * 1.1;
      } else {
        const bu = 0.28 + ((i * 5) % 10) / 14;
        const brad = 1.35 * (1 - bu * 0.82);
        const bside = Math.sin(bu * Math.PI * 2.6 + t * 1.35) * (1.15 + bu * 2.1);
        const blz = 5.4 - bu * 22;
        const sc = 1.52;
        hx = g.x + (bside * cy + blz * sy) * sc;
        hy = brad * 1.15 * sc;
        hz = g.z + (-bside * sy + blz * cy) * sc;
      }
      const show = t > 2 && t < LAST_ARROW && u > 0.06 && u < 0.98;
      dummy.position.set(sx + (hx - sx) * u, 1.5 + (hy - 1.5) * u + Math.sin(u * Math.PI) * 0.45, sz + (hz - sz) * u);
      dummy.lookAt(hx, hy, hz);
      dummy.rotateX(Math.PI / 2);
      dummy.scale.set(show ? 0.56 : 0, show ? 1.15 : 0, show ? 0.56 : 0);
      dummy.updateMatrix();
      mesh.current.setMatrixAt(i, dummy.matrix);
      if (snake && show && u > 0.86 && t - lastHit.current[i] > 0.7) {
        lastHit.current[i] = t;
        for (let k = 0; k < 2; k++) {
          const drop = _drop[_dropN % BLOOD];
          _dropN += 1;
          drop.t = t;
          drop.x = hx + (k - 0.5) * 0.18;
          drop.y = hy;
          drop.z = hz;
          drop.vx = (k - 0.5) * 0.55;
          drop.vz = (i % 2 ? 0.25 : -0.25);
        }
      }
    }
    mesh.current.count = nArrow;
    mesh.current.instanceMatrix.needsUpdate = true;
    if (!blood.current) return;
    for (let i = 0; i < BLOOD; i++) {
      const drop = _drop[i];
      const age = t - drop.t;
      const on = snake && age >= 0 && age < 0.5;
      if (!on) {
        dummy.position.set(0, -20, 0);
        dummy.scale.set(0, 0, 0);
      } else {
        const fall = age * age * 6;
        dummy.position.set(drop.x + drop.vx * age, Math.max(0.05, drop.y - fall), drop.z + drop.vz * age);
        const s = 0.34 * (1 - age / 0.5);
        dummy.scale.set(s, s * 1.35, s);
      }
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      blood.current.setMatrixAt(i, dummy.matrix);
    }
    blood.current.count = BLOOD;
    blood.current.instanceMatrix.needsUpdate = true;
  });
  return (
    <group>
      <instancedMesh ref={mesh} args={[undefined, undefined, 36]} frustumCulled={false}>
        <cylinderGeometry args={[0.04, 0.015, 1.35, 5]} />
        <meshStandardMaterial color="#d7c39a" roughness={0.55} />
      </instancedMesh>
      {snake && (
        <instancedMesh ref={blood} args={[undefined, undefined, BLOOD]} frustumCulled={false}>
          <sphereGeometry args={[1, 5, 4]} />
          <meshLambertMaterial color="#c41616" />
        </instancedMesh>
      )}
    </group>
  );
}

const LAST_ARROW = 52.2;

const SNAKE_N = 18;
const _snake: THREE.Vector3[] = Array.from({ length: SNAKE_N }, () => new THREE.Vector3());
const _up = new THREE.Vector3(0, 1, 0);
const _dir = new THREE.Vector3();
const _mid = new THREE.Vector3();

function SnakeBody({ soldiers }: { soldiers: number }) {
  const root = useRef<THREE.Group>(null);
  const links = useRef<(THREE.Mesh | null)[]>([]);
  const joints = useRef<(THREE.Mesh | null)[]>([]);
  const head = useRef<THREE.Group>(null);
  const jaw = useRef<THREE.Group>(null);
  const hide = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.fillStyle = "#3f5c2e";
      ctx.fillRect(0, 0, 256, 256);
      for (let i = 0; i < 56; i++) {
        const brown = i % 3 !== 1;
        ctx.fillStyle = brown ? (i % 2 ? "#6d4a28" : "#4e3218") : "#2a4622";
        ctx.beginPath();
        ctx.ellipse((i * 53) % 256, (i * 37) % 256, 16 + (i % 5) * 7, 9 + (i % 4) * 4, i * 0.55, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    const map = new THREE.CanvasTexture(canvas);
    map.colorSpace = THREE.SRGBColorSpace;
    map.wrapS = THREE.RepeatWrapping;
    map.wrapT = THREE.RepeatWrapping;
    map.repeat.set(2, 1);
    return new THREE.MeshStandardMaterial({ map, color: "#ffffff", roughness: 0.78, metalness: 0.04 });
  }, []);
  const belly = useMemo(() => new THREE.MeshStandardMaterial({ color: "#8a6a3c", roughness: 0.86, metalness: 0.02 }), []);
  const mouth = useMemo(() => new THREE.MeshStandardMaterial({ color: "#5c1414", roughness: 0.48 }), []);
  const fang = useMemo(() => new THREE.MeshStandardMaterial({ color: "#efeae2", roughness: 0.28, metalness: 0.22 }), []);
  const eye = useMemo(() => new THREE.MeshStandardMaterial({ color: "#c9a24a", emissive: "#6a4a10", emissiveIntensity: 0.35, roughness: 0.4 }), []);
  useFrame(({ clock }) => {
    const t = Math.max(0, clock.elapsedTime - REEL_HOLD);
    const g = devGiantAt(t);
    const bite = devSnakeBite(t);
    const fx = Math.sin(g.yaw);
    const fz = Math.cos(g.yaw);
    if (root.current) {
      root.current.position.set(g.x + fx * bite * 8, 0, g.z + fz * bite * 8);
      root.current.rotation.y = g.yaw;
    }
    const lash = devTailLash(t);
    const curl = Math.abs(lash);
    for (let i = 0; i < SNAKE_N; i++) {
      const u = i / (SNAKE_N - 1);
      const neck = i < 5 ? (1 - i / 5) ** 2 : 0;
      const tip = i > 10 ? (i - 10) / (SNAKE_N - 1 - 10) : 0;
      const rad = 1.35 * (1 - u * 0.82) + (i === 0 ? 0.28 : 0);
      const side = Math.sin(u * Math.PI * 2.6 + t * 1.35) * (1.15 + u * 2.1) + lash * tip * tip * 12;
      const y = rad + neck * (0.15 + bite * 7.2) + curl * tip * 2.6;
      const z = 5.4 - u * 22 + neck * bite * 12 + curl * tip * tip * 1.4;
      _snake[i].set(side, y, z);
    }
    for (let i = 0; i < SNAKE_N - 1; i++) {
      const link = links.current[i];
      if (!link) continue;
      const rad = 1.22 * (1 - i / (SNAKE_N - 1) * 0.8);
      _dir.copy(_snake[i + 1]).sub(_snake[i]);
      const len = Math.max(0.4, _dir.length());
      _dir.multiplyScalar(1 / len);
      _mid.copy(_snake[i]).add(_snake[i + 1]).multiplyScalar(0.5);
      link.position.copy(_mid);
      link.quaternion.setFromUnitVectors(_up, _dir);
      link.scale.set(rad, len * 1.12, rad);
    }
    for (let i = 1; i < SNAKE_N; i++) {
      const joint = joints.current[i];
      if (!joint) continue;
      const rad = 1.28 * (1 - i / (SNAKE_N - 1) * 0.82);
      joint.position.copy(_snake[i]);
      joint.scale.setScalar(rad);
    }
    if (head.current) {
      head.current.position.copy(_snake[0]);
      head.current.rotation.set(-0.08 + bite * 0.62, Math.sin(t * 1.35) * 0.08, 0);
    }
    if (jaw.current) jaw.current.rotation.x = 0.08 + bite * 0.95;
  });
  return (
    <group ref={root} scale={1.52}>
      {Array.from({ length: SNAKE_N - 1 }, (_, i) => (
        <mesh key={`l${i}`} ref={(el) => { links.current[i] = el; }} material={hide}>
          <cylinderGeometry args={[1, 1, 1, 7]} />
        </mesh>
      ))}
      {Array.from({ length: SNAKE_N }, (_, i) =>
        i === 0 ? null : (
          <mesh key={`j${i}`} ref={(el) => { joints.current[i] = el; }} material={hide}>
            <sphereGeometry args={[1, 7, 5]} />
          </mesh>
        )
      )}
      <group ref={head}>
        <mesh material={hide}>
          <sphereGeometry args={[1.15, 8, 6]} />
        </mesh>
        <mesh position={[0, -0.28, 0.15]} scale={[0.82, 0.55, 0.9]} material={belly}>
          <sphereGeometry args={[1, 6, 4]} />
        </mesh>
        <mesh position={[0, 0.05, 1.05]} material={hide}>
          <sphereGeometry args={[0.62, 7, 5]} />
        </mesh>
        <mesh position={[-0.28, 0.22, 0.72]} material={eye}>
          <sphereGeometry args={[0.09, 5, 4]} />
        </mesh>
        <mesh position={[0.28, 0.22, 0.72]} material={eye}>
          <sphereGeometry args={[0.09, 5, 4]} />
        </mesh>
        <mesh position={[0, -0.08, 0.85]} material={mouth}>
          <boxGeometry args={[0.55, 0.12, 0.4]} />
        </mesh>
        <group ref={jaw} position={[0, -0.22, 0.45]}>
          <mesh position={[0, -0.08, 0.55]} material={hide}>
            <boxGeometry args={[0.7, 0.2, 0.85]} />
          </mesh>
          <mesh position={[-0.16, 0.02, 0.82]} rotation={[1.2, 0, 0.12]} material={fang}>
            <coneGeometry args={[0.05, 0.42, 4]} />
          </mesh>
          <mesh position={[0.16, 0.02, 0.82]} rotation={[1.2, 0, -0.12]} material={fang}>
            <coneGeometry args={[0.05, 0.42, 4]} />
          </mesh>
        </group>
      </group>
    </group>
  );
}

const _knightColor = new THREE.Color();

function knightPiece(geo: THREE.BufferGeometry, x: number, y: number, z: number, color: string, rx = 0, ry = 0, rz = 0) {
  geo.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(1, 1, 1)));
  const n = geo.getAttribute("position").count;
  const colors = new Float32Array(n * 3);
  _knightColor.set(color);
  for (let i = 0; i < n; i++) {
    colors[i * 3] = _knightColor.r;
    colors[i * 3 + 1] = _knightColor.g;
    colors[i * 3 + 2] = _knightColor.b;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  return geo;
}

function knightGeos() {
  const plate = "#b7c0c8";
  const hi = "#e2e8ee";
  const dk = "#667078";
  const leather = "#3a322b";
  const steel = "#f2f5f8";
  const visor = "#121416";
  const body = mergeGeometries(
    [
      knightPiece(new THREE.BoxGeometry(0.18, 0.1, 0.3), -0.13, 0.06, 0.05, dk),
      knightPiece(new THREE.BoxGeometry(0.18, 0.1, 0.3), 0.13, 0.06, 0.05, dk),
      knightPiece(new THREE.CylinderGeometry(0.075, 0.09, 0.46, 8), -0.13, 0.34, 0.02, plate),
      knightPiece(new THREE.CylinderGeometry(0.075, 0.09, 0.46, 8), 0.13, 0.34, 0.02, plate),
      knightPiece(new THREE.SphereGeometry(0.095, 8, 6), -0.13, 0.56, 0.03, hi),
      knightPiece(new THREE.SphereGeometry(0.095, 8, 6), 0.13, 0.56, 0.03, hi),
      knightPiece(new THREE.CylinderGeometry(0.095, 0.11, 0.42, 8), -0.13, 0.78, 0, plate),
      knightPiece(new THREE.CylinderGeometry(0.095, 0.11, 0.42, 8), 0.13, 0.78, 0, plate),
      knightPiece(new THREE.BoxGeometry(0.5, 0.18, 0.28), 0, 1.02, 0, dk),
      knightPiece(new THREE.BoxGeometry(0.34, 0.16, 0.16), 0, 0.98, 0.02, leather),
      knightPiece(new THREE.BoxGeometry(0.52, 0.46, 0.3), 0, 1.28, 0, plate),
      knightPiece(new THREE.BoxGeometry(0.34, 0.3, 0.08), 0, 1.32, 0.17, hi, 0.18),
      knightPiece(new THREE.BoxGeometry(0.06, 0.38, 0.03), 0, 1.28, 0.2, dk),
      knightPiece(new THREE.SphereGeometry(0.17, 8, 6), -0.34, 1.42, 0, plate),
      knightPiece(new THREE.SphereGeometry(0.17, 8, 6), 0.34, 1.42, 0, plate),
      knightPiece(new THREE.CylinderGeometry(0.075, 0.085, 0.34, 7), -0.46, 1.16, 0.04, plate, 0, 0, 0.4),
      knightPiece(new THREE.CylinderGeometry(0.055, 0.065, 0.28, 7), -0.58, 0.9, 0.1, dk, 0.2, 0, 0.55),
      knightPiece(new THREE.SphereGeometry(0.2, 10, 8), 0, 1.66, 0.02, plate),
      knightPiece(new THREE.CylinderGeometry(0.17, 0.22, 0.1, 8), 0, 1.5, 0, dk),
      knightPiece(new THREE.BoxGeometry(0.24, 0.1, 0.06), 0, 1.56, 0.16, visor),
      knightPiece(new THREE.BoxGeometry(0.16, 0.02, 0.02), 0, 1.58, 0.2, "#9aa3ab"),
    ],
    false
  );
  const sword = mergeGeometries(
    [
      knightPiece(new THREE.CylinderGeometry(0.07, 0.078, 0.38, 8), 0, -0.19, 0.02, plate),
      knightPiece(new THREE.SphereGeometry(0.08, 8, 6), 0, -0.38, 0.04, hi),
      knightPiece(new THREE.CylinderGeometry(0.052, 0.06, 0.35, 8), 0.01, -0.45, 0.2, dk, 1.98),
      knightPiece(new THREE.BoxGeometry(0.11, 0.09, 0.14), 0.02, -0.52, 0.36, plate),
      knightPiece(new THREE.BoxGeometry(0.1, 0.032, 0.1), 0.02, -0.478, 0.38, hi),
      knightPiece(new THREE.SphereGeometry(0.042, 8, 6), 0.02, -0.53, 0.31, dk),
      knightPiece(new THREE.CylinderGeometry(0.024, 0.026, 0.16, 8), 0.02, -0.54, 0.44, leather, Math.PI / 2),
      knightPiece(new THREE.BoxGeometry(0.44, 0.028, 0.038), 0.02, -0.54, 0.54, hi),
      knightPiece(new THREE.BoxGeometry(0.036, 0.062, 0.032), 0.02, -0.54, 0.54, hi),
      knightPiece(new THREE.BoxGeometry(0.046, 0.012, 0.7), 0.02, -0.555, 0.91, steel),
      knightPiece(new THREE.BoxGeometry(0.028, 0.009, 0.42), 0.02, -0.568, 1.45, steel),
      knightPiece(new THREE.BoxGeometry(0.012, 0.004, 0.78), 0.02, -0.546, 1.02, "#e7eef6"),
      knightPiece(new THREE.ConeGeometry(0.016, 0.16, 6), 0.02, -0.575, 1.72, steel, Math.PI / 2),
    ],
    false
  );
  return { body: body || new THREE.BoxGeometry(0.4, 1.6, 0.3), sword: sword || new THREE.BoxGeometry(0.08, 0.08, 1) };
}

function troopCut(i: number, t: number, soldiers: number) {
  const sign = i % 3 === 2 ? -1 : 1;
  const overhead = i % 3 === 0;
  const hit = devTroopHit(i, soldiers, t);
  const idle = Math.sin(t * 1.25 + i * 1.4);
  if (hit < 0) return { armX: -0.2 + idle * 0.03, armY: sign * 0.04, armZ: 0.02, twist: idle * 0.05, lean: 0, step: 0 };
  const dt = t - hit;
  if (dt < -0.16) {
    const u = Math.max(0, Math.min(1, (dt + 0.62) / 0.46));
    const s = Math.sin(u * Math.PI * 0.5);
    return {
      armX: -0.2 - s * (overhead ? 1.35 : 0.95),
      armY: sign * s * 0.2,
      armZ: sign * s * 0.08,
      twist: -sign * s * 0.4,
      lean: s * 0.06,
      step: -s * 0.16,
    };
  }
  if (dt < 0.05) {
    const snap = Math.pow((dt + 0.16) / 0.21, 1.45);
    return {
      armX: (overhead ? -1.55 : -1.15) + snap * (overhead ? 2.5 : 2.05),
      armY: sign * (0.2 - snap * 0.36),
      armZ: sign * (0.08 - snap * 0.18),
      twist: -sign * 0.4 + sign * snap * 0.75,
      lean: 0.06 + snap * 0.2,
      step: -0.16 + snap * 0.9,
    };
  }
  const e = Math.max(0, Math.min(1, (dt - 0.05) / 0.34));
  const s = e * e * (3 - 2 * e);
  return {
    armX: 0.95 - s * 1.15,
    armY: sign * (-0.16 + s * 0.2),
    armZ: sign * (-0.1 + s * 0.12),
    twist: sign * (0.35 - s * 0.35),
    lean: 0.26 * (1 - s),
    step: 0.74 * (1 - s),
  };
}

function DevTroop({ soldiers }: { soldiers: number }) {
  const bodies = useRef<THREE.InstancedMesh>(null);
  const swords = useRef<THREE.InstancedMesh>(null);
  const geos = useMemo(() => knightGeos(), []);
  const plate = useMemo(() => new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.8, roughness: 0.32 }), []);
  const steel = useMemo(() => new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.92, roughness: 0.16 }), []);
  const world = useMemo(() => new THREE.Object3D(), []);
  const swing = useMemo(() => new THREE.Object3D(), []);
  useFrame(({ clock }) => {
    const t = Math.max(0, clock.elapsedTime - REEL_HOLD);
    const g = devGiantAt(t);
    if (!bodies.current || !swords.current) return;
    for (let i = 0; i < TROOP_N; i++) {
      const troop = devTroopSlot(i, g, t);
      const cut = troopCut(i, t, soldiers);
      const bob = Math.abs(Math.sin(t * 3.1 + i * 1.3)) * 0.05;
      world.position.set(troop.x + Math.sin(troop.ry) * cut.step, bob, troop.z + Math.cos(troop.ry) * cut.step);
      world.rotation.set(cut.lean, troop.ry + cut.twist, 0);
      world.scale.setScalar(TROOP_SCALE);
      world.updateMatrix();
      bodies.current.setMatrixAt(i, world.matrix);
      swing.position.set(0.38, 1.36, 0.04);
      swing.rotation.set(cut.armX, cut.armY, cut.armZ);
      swing.scale.set(1, 1, 1);
      swing.updateMatrix();
      swing.matrix.premultiply(world.matrix);
      swords.current.setMatrixAt(i, swing.matrix);
    }
    bodies.current.instanceMatrix.needsUpdate = true;
    swords.current.instanceMatrix.needsUpdate = true;
  });
  return (
    <group>
      <instancedMesh ref={bodies} args={[geos.body, plate, TROOP_N]} frustumCulled={false} />
      <instancedMesh ref={swords} args={[geos.sword, steel, TROOP_N]} frustumCulled={false} />
    </group>
  );
}

export function Giant({ soldiers, big = false, sword = false, dread = false, flesh = false, snake = false, devs = false, crown = false }: { soldiers: number; big?: boolean; sword?: boolean; dread?: boolean; flesh?: boolean; snake?: boolean; devs?: boolean; crown?: boolean }) {
  return (
    <group>
      {devs ? <DevTroop soldiers={soldiers} /> : snake ? <SnakeBody soldiers={soldiers} /> : <GiantBody soldiers={soldiers} big={big} sword={sword} dread={dread} flesh={flesh} crown={crown} />}
      <ArrowVolley big={big} snake={snake} devs={devs} soldiers={soldiers} />
    </group>
  );
}

export function DevHealthBar({ soldiers, big = false, sword = false, snake = false, devs = false }: { soldiers: number; big?: boolean; sword?: boolean; snake?: boolean; devs?: boolean }) {
  return (
    <Hud renderPriority={3}>
      <OrthographicCamera makeDefault position={[0, 0, 10]} />
      <DevHealthPlate soldiers={soldiers} big={big} sword={sword} snake={snake} devs={devs} />
    </Hud>
  );
}

function DevHealthPlate({ soldiers, big, sword, snake, devs }: { soldiers: number; big: boolean; sword: boolean; snake: boolean; devs: boolean }) {
  const size = useThree((s) => s.size);
  const tex = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 180;
    const map = new THREE.CanvasTexture(canvas);
    map.colorSpace = THREE.SRGBColorSpace;
    return map;
  }, []);
  useFrame(({ clock }) => {
    const alive = devAlive(Math.max(0, clock.elapsedTime - REEL_HOLD), soldiers, big, sword, snake, devs);
    const canvas = tex.image as HTMLCanvasElement;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, 1024, 180);
    const innerX = 28;
    const innerY = 46;
    const innerW = 968;
    const innerH = 92;
    const fill = (alive / Math.max(1, soldiers)) * innerW;
    ctx.fillStyle = "#3a1212";
    ctx.fillRect(innerX, innerY, innerW, innerH);
    ctx.fillStyle = "#1d6bff";
    ctx.fillRect(innerX, innerY, Math.max(0, fill), innerH);
    ctx.strokeStyle = "#ffe14a";
    ctx.lineWidth = 16;
    ctx.strokeRect(innerX - 8, innerY - 8, innerW + 16, innerH + 16);
    ctx.font = "900 58px Inter, sans-serif";
    ctx.textBaseline = "middle";
    ctx.lineWidth = 8;
    ctx.strokeStyle = "rgba(0,0,0,0.72)";
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "left";
    ctx.strokeText(formatCount(alive), 48, innerY + innerH / 2);
    ctx.fillText(formatCount(alive), 48, innerY + innerH / 2);
    ctx.font = "900 40px Inter, sans-serif";
    ctx.textAlign = "center";
    ctx.lineWidth = 6;
    ctx.strokeText("ASKER", 512, innerY + innerH / 2);
    ctx.fillText("ASKER", 512, innerY + innerH / 2);
    tex.needsUpdate = true;
  });
  const w = size.width * 0.92;
  const h = w * (180 / 1024);
  return (
    <mesh position={[0, size.height / 2 - h * 0.55 - 18, 4]} renderOrder={30}>
      <planeGeometry args={[w, h]} />
      <meshBasicMaterial map={tex} transparent depthTest={false} toneMapped={false} />
    </mesh>
  );
}
