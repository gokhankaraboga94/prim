import { useEffect, useMemo, useRef, type RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import * as THREE from "three";
import { REEL_HOLD } from "../../recordCanvas";
import { simplifySkinned } from "../../knightSoldier";
import {
  KONG_H,
  KONG_HITS,
  KONG_HOME,
  ORC_FALL,
  ORC_H,
  ORC_HITS,
  ORC_HOME,
  boutCam,
  boutHp,
  boutRecoil,
  boutStrike,
} from "../../boutReel";

const KONG_URL = "/models/bigfoot.glb";
const ORC_URL = "/models/orc.glb";
const SHOULDER = new THREE.Vector3(0.16, 0.64, 0.02);
const LEFT = new THREE.Vector3(-0.15, 0.6, 0.02);
const RIGHT = new THREE.Vector3(0.15, 0.6, 0.02);
const qSwing = new THREE.Quaternion();
const euler = new THREE.Euler();
const tmp = new THREE.Vector3();
const spot = new THREE.Vector3();

type Swing = {
  geo: THREE.BufferGeometry | null;
  pos: THREE.BufferAttribute | null;
  rest: Float32Array | null;
  weight: Float32Array | null;
  side: Float32Array | null;
  club: THREE.Group | null;
};

function cheapMaterial(src: THREE.Material) {
  const mat = (Array.isArray(src) ? src[0] : src) as THREE.MeshStandardMaterial;
  const next = new THREE.MeshLambertMaterial({
    map: mat.map ?? null,
    color: mat.color ? mat.color.clone() : "#ffffff",
  });
  mat.map = null;
  mat.normalMap?.dispose();
  mat.roughnessMap?.dispose();
  mat.metalnessMap?.dispose();
  mat.dispose();
  return next;
}

function fittedBody(root: THREE.Object3D, height: number) {
  let mesh: THREE.Mesh | null = null;
  root.traverse((obj) => {
    const item = obj as THREE.Mesh;
    if (item.isMesh && !mesh) mesh = item;
  });
  if (!mesh) return null;
  const source = mesh as THREE.Mesh;
  source.updateWorldMatrix(true, false);
  const geo = source.geometry.clone();
  geo.applyMatrix4(source.matrixWorld);
  geo.computeBoundingBox();
  const span = geo.boundingBox ? Math.max(0.001, geo.boundingBox.max.y - geo.boundingBox.min.y) : 1;
  const next = simplifySkinned(geo, span * 0.013);
  geo.dispose();
  source.geometry.dispose();
  const body = new THREE.Mesh(next, cheapMaterial(Array.isArray(source.material) ? source.material[0] : source.material));
  body.frustumCulled = false;
  const box = new THREE.Box3().setFromBufferAttribute(next.getAttribute("position") as THREE.BufferAttribute);
  const fit = height / Math.max(0.001, box.max.y - box.min.y);
  const host = new THREE.Group();
  host.add(body);
  host.scale.setScalar(fit);
  host.position.set(-((box.min.x + box.max.x) / 2) * fit, -box.min.y * fit, -((box.min.z + box.max.z) / 2) * fit);
  return { host, geo: next };
}

function spikedClub() {
  const pivot = new THREE.Group();
  pivot.position.copy(SHOULDER);
  const spin = new THREE.Group();
  pivot.add(spin);
  const hold = new THREE.Group();
  hold.position.set(0.145, -0.16, 0.04);
  spin.add(hold);
  const wood = new THREE.MeshStandardMaterial({ color: "#5a3818", roughness: 0.68 });
  const iron = new THREE.MeshStandardMaterial({ color: "#d5dde6", metalness: 0.82, roughness: 0.22 });
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.022, 0.22, 8), wood);
  shaft.rotation.x = Math.PI / 2;
  shaft.position.z = 0.11;
  hold.add(shaft);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.046, 10, 8), iron);
  head.position.z = 0.24;
  hold.add(head);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.013, 0.062, 5), iron);
    spike.position.set(Math.cos(a) * 0.052, Math.sin(a) * 0.052, 0.24);
    spike.rotation.z = a - Math.PI / 2;
    hold.add(spike);
  }
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.015, 0.07, 5), iron);
  nose.rotation.x = Math.PI / 2;
  nose.position.z = 0.31;
  hold.add(nose);
  return { pivot, spin, wood, iron };
}

function armWeights(pos: THREE.BufferAttribute, rightOnly: boolean) {
  const rest = new Float32Array((pos.array as Float32Array).length);
  rest.set(pos.array as Float32Array);
  const weight = new Float32Array(pos.count);
  const side = new Float32Array(pos.count);
  for (let i = 0; i < pos.count; i++) {
    const x = rest[i * 3];
    const y = rest[i * 3 + 1];
    const ax = Math.abs(x);
    if (rightOnly) {
      if (x < 0.18 || y < 0.3 || y > 0.7) continue;
      side[i] = 1;
      const u = Math.min(1, (x - 0.18) / 0.12);
      weight[i] = u * u * (3 - 2 * u);
      continue;
    }
    if (ax < 0.16 || y < 0.14 || y > 0.7) continue;
    side[i] = x < 0 ? -1 : 1;
    const u = Math.min(1, (ax - 0.16) / 0.14);
    weight[i] = u * u * (3 - 2 * u);
  }
  return { rest, weight, side };
}

function swingVerts(swing: Swing, angle: number, both: boolean) {
  const pos = swing.pos;
  const rest = swing.rest;
  const weight = swing.weight;
  const side = swing.side;
  if (!pos || !rest || !weight || !side) return;
  for (let i = 0; i < side.length; i++) {
    const w = weight[i];
    if (w <= 0) continue;
    const o = i * 3;
    const pivot = both ? (side[i] < 0 ? LEFT : RIGHT) : SHOULDER;
    const yaw = both ? -side[i] * angle : -angle;
    euler.set(0, yaw, 0);
    qSwing.setFromEuler(euler);
    tmp.set(rest[o], rest[o + 1], rest[o + 2]).sub(pivot);
    tmp.applyQuaternion(qSwing).add(pivot);
    pos.setXYZ(i, rest[o] + (tmp.x - rest[o]) * w, rest[o + 1] + (tmp.y - rest[o + 1]) * w, rest[o + 2] + (tmp.z - rest[o + 2]) * w);
  }
  pos.needsUpdate = true;
  if (Math.abs(angle) > 0.04) swing.geo?.computeVertexNormals();
}

function dropHost(host: THREE.Object3D | null) {
  if (!host) return;
  host.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.geometry?.dispose();
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const mat of mats) {
      const std = mat as THREE.MeshStandardMaterial;
      std.map?.dispose();
      mat.dispose();
    }
  });
  host.clear();
}

function DuelKong() {
  const root = useRef<THREE.Group>(null);
  const swing = useMemo<Swing>(
    () => ({ geo: null, pos: null, rest: null, weight: null, side: null, club: null }),
    []
  );
  useEffect(() => {
    const loader = new GLTFLoader();
    let drop = false;
    loader.load(KONG_URL, (gltf) => {
      const host = root.current;
      if (drop || !host) return;
      const fitted = fittedBody(gltf.scene, KONG_H);
      if (!fitted) return;
      const club = spikedClub();
      fitted.host.add(club.pivot);
      swing.geo = fitted.geo;
      swing.pos = fitted.geo.getAttribute("position") as THREE.BufferAttribute;
      const arms = armWeights(swing.pos, true);
      swing.rest = arms.rest;
      swing.weight = arms.weight;
      swing.side = arms.side;
      swing.club = club.spin;
      host.add(fitted.host);
    });
    return () => {
      drop = true;
      const host = root.current;
      swing.geo = null;
      swing.pos = null;
      swing.rest = null;
      swing.weight = null;
      swing.side = null;
      swing.club = null;
      dropHost(host);
    };
  }, [root, swing]);
  useFrame(({ clock }) => {
    const node = root.current;
    if (!node) return;
    const t = Math.max(0, clock.elapsedTime - REEL_HOLD);
    const strike = boutStrike(t, KONG_HITS);
    const recoil = boutRecoil(t, ORC_HITS);
    const lunge = Math.max(0, strike);
    node.position.set(KONG_HOME + lunge * 1.25 - recoil * 0.85, Math.abs(Math.sin(t * 2.1)) * 0.16, recoil * 0.2);
    node.rotation.set(lunge * 0.12, Math.PI / 2 + strike * 0.16, -recoil * 0.1);
    if (swing.club) swing.club.rotation.y = -strike * 1.15;
    swingVerts(swing, strike * 1.15, false);
  });
  return (
    <>
      <group ref={root} />
      <HpPlate host={root} lift={KONG_H + 1.8} label="KONG" side="kong" />
    </>
  );
}

function DuelOrc() {
  const root = useRef<THREE.Group>(null);
  const swing = useMemo<Swing>(
    () => ({ geo: null, pos: null, rest: null, weight: null, side: null, club: null }),
    []
  );
  useEffect(() => {
    const loader = new GLTFLoader();
    let drop = false;
    loader.load(ORC_URL, (gltf) => {
      const host = root.current;
      if (drop || !host) return;
      const fitted = fittedBody(gltf.scene, ORC_H);
      if (!fitted) return;
      swing.geo = fitted.geo;
      swing.pos = fitted.geo.getAttribute("position") as THREE.BufferAttribute;
      const arms = armWeights(swing.pos, false);
      swing.rest = arms.rest;
      swing.weight = arms.weight;
      swing.side = arms.side;
      host.add(fitted.host);
    });
    return () => {
      drop = true;
      swing.geo = null;
      swing.pos = null;
      swing.rest = null;
      swing.weight = null;
      swing.side = null;
      dropHost(root.current);
    };
  }, [root, swing]);
  useFrame(({ clock }) => {
    const node = root.current;
    if (!node) return;
    const t = Math.max(0, clock.elapsedTime - REEL_HOLD);
    const fallen = Math.max(0, Math.min(1, (t - ORC_FALL) / 2.6));
    const strike = fallen > 0 ? 0 : boutStrike(t, ORC_HITS);
    const recoil = fallen > 0 ? 0 : boutRecoil(t, KONG_HITS);
    const lunge = Math.max(0, strike);
    node.position.set(ORC_HOME - lunge * 1.05 + recoil * 0.7, 0, 0);
    node.rotation.order = "YXZ";
    node.rotation.set(fallen * 1.5 + lunge * 0.08, -Math.PI / 2 - strike * 0.18, fallen * 0.42 + recoil * 0.12);
    swingVerts(swing, strike * 1.15, true);
  });
  return (
    <>
      <group ref={root} />
      <HpPlate host={root} lift={ORC_H + 1.6} label="ORK" side="orc" />
    </>
  );
}

function HpPlate({
  host,
  lift,
  label,
  side,
}: {
  host: RefObject<THREE.Group | null>;
  lift: number;
  label: string;
  side: "kong" | "orc";
}) {
  const mesh = useRef<THREE.Mesh>(null);
  const tex = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 128;
    const map = new THREE.CanvasTexture(canvas);
    map.colorSpace = THREE.SRGBColorSpace;
    return map;
  }, []);
  useEffect(() => () => tex.dispose(), [tex]);
  useFrame(({ camera, clock }) => {
    const node = mesh.current;
    const body = host.current;
    if (!node || !body) return;
    const t = Math.max(0, clock.elapsedTime - REEL_HOLD);
    const hp = boutHp(t)[side];
    const canvas = tex.image as HTMLCanvasElement;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.clearRect(0, 0, 512, 128);
      ctx.fillStyle = "rgba(6,8,12,0.78)";
      ctx.fillRect(8, 18, 496, 96);
      ctx.fillStyle = "#3a1515";
      ctx.fillRect(28, 58, 456, 36);
      ctx.fillStyle = hp > 55 ? "#3ddc6a" : hp > 28 ? "#f0c14a" : "#ff3b2f";
      ctx.fillRect(28, 58, Math.max(0, 456 * (hp / 100)), 36);
      ctx.strokeStyle = "#ffe14a";
      ctx.lineWidth = 6;
      ctx.strokeRect(22, 52, 468, 48);
      ctx.font = "700 36px Inter, sans-serif";
      ctx.textBaseline = "middle";
      ctx.textAlign = "left";
      ctx.fillStyle = "#ffffff";
      ctx.fillText(label, 28, 40);
      ctx.textAlign = "right";
      ctx.fillText(String(hp), 478, 40);
      tex.needsUpdate = true;
    }
    spot.set(0, lift, 0);
    body.localToWorld(spot);
    node.position.copy(spot);
    node.quaternion.copy(camera.quaternion);
  });
  return (
    <mesh ref={mesh} renderOrder={8}>
      <planeGeometry args={[6.8, 1.7]} />
      <meshBasicMaterial map={tex} transparent depthTest={false} toneMapped={false} />
    </mesh>
  );
}

export function DuelCam() {
  const perspCam = useRef<THREE.PerspectiveCamera | null>(null);
  useFrame(({ camera, clock }) => {
    if ((camera as THREE.PerspectiveCamera).isPerspectiveCamera) perspCam.current = camera as THREE.PerspectiveCamera;
    const persp = perspCam.current;
    if (!persp) return;
    const shot = boutCam(Math.max(0, clock.elapsedTime - REEL_HOLD));
    persp.fov = shot.fov;
    persp.near = 0.4;
    persp.far = 2400;
    persp.updateProjectionMatrix();
    persp.position.set(shot.x, shot.y, shot.z);
    persp.up.set(0, 1, 0);
    persp.lookAt(shot.lx, shot.ly, shot.lz);
  });
  return null;
}

export function DuelBattle() {
  return (
    <group>
      <DuelKong />
      <DuelOrc />
    </group>
  );
}
